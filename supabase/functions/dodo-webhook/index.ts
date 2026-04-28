import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limiter.ts";
import { isEventProcessed, markEventProcessed } from "../_shared/idempotency.ts";
import { getCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DODO_WEBHOOK_SECRET = Deno.env.get("DODO_PAYMENTS_WEBHOOK_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifyDodoSignature(req: Request, rawBody: string): Promise<boolean> {
    if (!DODO_WEBHOOK_SECRET) {
        console.warn("⚠️ DODO_PAYMENTS_WEBHOOK_KEY not set; skipping signature verification.");
        return true;
    }
    const signature = req.headers.get("webhook-signature") || req.headers.get("x-webhook-signature");
    if (!signature) {
        console.error("❌ No webhook signature header found");
        return false;
    }
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(DODO_WEBHOOK_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const computedSig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
    const expectedSig = signature.replace("sha256=", "").trim();
    if (computedSig.length !== expectedSig.length) {
        // Try hex comparison if lengths differ
        const computedHex = Array.from(new Uint8Array(sigBuffer))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
        return computedHex === expectedSig.toLowerCase();
    }
    return computedSig === expectedSig;
}

serve(async (req) => {
    const cors = getCors(req);
    const corsHeaders = {
        ...cors.headers,
        // Webhooks sometimes send extra headers; allow them explicitly.
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, webhook-id, webhook-signature, webhook-timestamp, x-webhook-signature",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (!cors.allowed) {
        return new Response(JSON.stringify({ error: "CORS origin not allowed" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const limit = checkRateLimit(`dodo-webhook:${clientIp}`, 60, 60000);
    if (!limit.allowed) {
        return rateLimitResponse(limit.remaining, limit.resetAt);
    }

    try {
        if (req.method !== "POST") {
            return new Response("Method not allowed", { status: 405, headers: corsHeaders });
        }

        const rawBody = await req.text();
        const isValid = await verifyDodoSignature(req, rawBody);
        if (!isValid) {
            console.error("❌ Dodo webhook signature verification failed");
            return new Response(JSON.stringify({ error: "Invalid signature" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const payload = JSON.parse(rawBody);
        console.log("🔔 Dodo Webhook Received:", JSON.stringify(payload, null, 2));

        // Idempotency: skip duplicate events
        const eventId = payload.id || payload.data?.id || `dodo-${crypto.randomUUID()}`;
        const alreadyProcessed = await isEventProcessed(supabase, eventId);
        if (alreadyProcessed) {
            console.log(`⏭️ Dodo event ${eventId} already processed — skipping.`);
            return new Response(JSON.stringify({ received: true, idempotent: true }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Handle various Dodo event types for successful payment
        const eventType = payload.type || payload.event;
        const data = payload.data || payload;

        const isSuccess =
            eventType === "payment.succeeded" ||
            eventType === "payment_intent.succeeded" ||
            eventType === "checkout.completed" ||
            payload.status === "succeeded" ||
            payload.payment_status === "paid" ||
            data.status === "succeeded";

        if (isSuccess) {
            // Extract user email from various possible locations in payload
            const userEmail =
                data.customer?.email ||
                data.customer_email ||
                payload.customer_email ||
                data.metadata?.email ||
                payload.metadata?.email;

            // Extract user_id from metadata (we set this during checkout creation)
            let userId =
                data.metadata?.user_id ||
                payload.metadata?.user_id;

            console.log(`✅ Payment success — Email: ${userEmail}, UserID from metadata: ${userId}`);

            // If we don't have userId from metadata, look it up by email
            if (!userId && userEmail) {
                // Try user_profiles first (public table)
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('id')
                    .eq('email', userEmail)
                    .single();

                if (profile?.id) {
                    userId = profile.id;
                } else {
                    // Fallback: use admin API to find user by email
                    const { data: authData } = await supabase.auth.admin.listUsers();
                    const matchedUser = authData?.users?.find(
                        (u: any) => u.email?.toLowerCase() === userEmail.toLowerCase()
                    );
                    userId = matchedUser?.id;
                }
            }

            if (userId) {
                console.log(`🔄 Upgrading user ${userId} to Premium...`);

                // Upsert into the subscriptions table
                // This is what AuthContext.tsx checks: subscriptions.status === 'active'
                const { error: subError } = await supabase
                    .from('subscriptions')
                    .upsert({
                        user_id: userId,
                        status: 'active',
                        payment_provider: 'dodo',
                        subscription_start: new Date().toISOString(),
                        subscription_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // +30 days
                        updated_at: new Date().toISOString(),
                    }, {
                        onConflict: 'user_id',
                    });

                if (subError) {
                    console.error("❌ Subscription upsert failed:", subError);

                    // Fallback: try insert if upsert fails
                    const { error: insertError } = await supabase
                        .from('subscriptions')
                        .insert({
                            user_id: userId,
                            status: 'active',
                            payment_provider: 'dodo',
                            subscription_start: new Date().toISOString(),
                            subscription_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        });

                    if (insertError) {
                        console.error("❌ Subscription insert also failed:", insertError);
                        return new Response(JSON.stringify({ error: insertError.message }), {
                            status: 500,
                            headers: { ...corsHeaders, "Content-Type": "application/json" },
                        });
                    }
                }
                console.log("🎉 User upgraded to Premium successfully!");
                await markEventProcessed(supabase, eventId, "dodo", eventType, payload);

                // Notify Dub.co of the sale
                try {
                    const dubApiKey = Deno.env.get("DUB_API_KEY");
                    if (!dubApiKey) {
                        console.warn("⚠️ DUB_API_KEY not set; skipping Dub.co sale tracking.");
                        return;
                    }

                    const dubResponse = await fetch("https://api.dub.co/track/sale", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${dubApiKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            customerId: userEmail, // Used email as customerId in client tracking
                            externalId: userId,
                            amount: data.total_amount || 1599,
                            currency: "usd",
                            paymentProcessor: "dodo",
                            metadata: { email: userEmail, userId: userId }
                        })
                    });

                    if (!dubResponse.ok) {
                        console.error(`❌ Dub.co sale tracking failed with status: ${dubResponse.status}`);
                    } else {
                        console.log("📈 Tracked sale in Dub.co successfully");
                    }
                } catch (dubErr) {
                    console.error("❌ Failed to track Dub.co sale:", dubErr);
                }

            } else {
                console.warn("⚠️ Could not locate user. Email:", userEmail);
            }
        } else {
            console.log(`ℹ️ Non-payment event received: ${eventType || payload.status || 'unknown'}`);
        }

        return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error("❌ Webhook Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
