import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Supabase client for Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limiter.ts";
import { isEventProcessed, markEventProcessed } from "../_shared/idempotency.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');

async function verifyRazorpaySignature(req: Request, rawBody: string): Promise<boolean> {
    if (!RAZORPAY_WEBHOOK_SECRET) {
        console.warn("⚠️ RAZORPAY_WEBHOOK_SECRET not set; skipping signature verification.");
        return true;
    }
    const signature = req.headers.get('x-razorpay-signature');
    if (!signature) {
        console.error("❌ No X-Razorpay-Signature header found");
        return false;
    }
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(RAZORPAY_WEBHOOK_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const computedHex = Array.from(new Uint8Array(sigBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    return computedHex === signature;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const limit = checkRateLimit(`razorpay-webhook:${clientIp}`, 60, 60000);
  if (!limit.allowed) {
    return rateLimitResponse(limit.remaining, limit.resetAt);
  }

  let event;
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (e) {
    return new Response('Failed to read body', { status: 400 });
  }

  const isValid = await verifyRazorpaySignature(req, rawBody);
  if (!isValid) {
    console.error("❌ Razorpay webhook signature verification failed");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Log the event for debugging
  console.log('Razorpay webhook event:', JSON.stringify(event));

  // Idempotency: skip duplicate events
  const eventId = event.payload?.payment?.entity?.id || event.payload?.subscription?.entity?.id || `razorpay-${crypto.randomUUID()}`;
  const alreadyProcessed = await isEventProcessed(supabase, eventId);
  if (alreadyProcessed) {
    console.log(`⏭️ Razorpay event ${eventId} already processed — skipping.`);
    return new Response(JSON.stringify({ received: true, idempotent: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Check for payment or subscription success
  const eventType = event.event || event.type;
  let notes = {};
  let user_id = null;
  let email = null;

  if (event.payload?.payment?.entity?.notes) {
    notes = event.payload.payment.entity.notes;
    user_id = notes.user_id || notes.User_id;
    email = notes.email || notes.Email;
  } else if (event.payload?.subscription?.entity?.notes) {
    notes = event.payload.subscription.entity.notes;
    user_id = notes.user_id || notes.User_id;
    email = notes.email || notes.Email;
  }

  if (
    (eventType === 'payment.captured' || eventType === 'subscription.activated') &&
    (user_id || email)
  ) {
    // Update the subscriptions table
    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(now.getMonth() + 1);
    const { error } = await supabase
      .from('subscriptions')
      .upsert([
        {
          user_id: user_id,
          email: email,
          status: 'active',
          updated_at: now.toISOString(),
          subscription_start: now.toISOString(),
          subscription_end: oneMonthLater.toISOString(),
        },
      ], { onConflict: 'user_id' });

    if (error) {
      console.error('Supabase upsert error:', error);
      return new Response('Database error', { status: 500 });
    }

    await markEventProcessed(supabase, eventId, "razorpay", eventType, event);

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
          customerId: email,
          externalId: user_id,
          amount: event.payload?.payment?.entity?.amount || 19900,
          currency: "inr",
          paymentProcessor: "razorpay",
          metadata: { email, userId: user_id }
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

    return new Response('OK', { status: 200 });
  }

  // If not a relevant event or missing user info
  return new Response('Ignored', { status: 200 });
}); 