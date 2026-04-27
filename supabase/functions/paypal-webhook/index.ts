import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Supabase client for Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limiter.ts";
import { isEventProcessed, markEventProcessed } from "../_shared/idempotency.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PAYPAL_WEBHOOK_ID = Deno.env.get('PAYPAL_WEBHOOK_ID');

async function verifyPayPalSignature(req: Request, rawBody: string): Promise<boolean> {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !PAYPAL_WEBHOOK_ID) {
        console.warn("⚠️ PayPal webhook credentials not fully configured; skipping signature verification.");
        return true;
    }

    // Get access token
    const authResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    if (!authResponse.ok) {
        console.error('❌ Failed to get PayPal access token');
        return false;
    }

    const { access_token } = await authResponse.json();

    const transmissionId = req.headers.get('paypal-transmission-id') || '';
    const certUrl = req.headers.get('paypal-cert-url') || '';
    const authAlgo = req.headers.get('paypal-auth-algo') || '';
    const transmissionTime = req.headers.get('paypal-transmission-time') || '';

    const verifyResponse = await fetch('https://api-m.paypal.com/v1/notifications/verify-webhook-signature', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            auth_algo: authAlgo,
            cert_url: certUrl,
            transmission_id: transmissionId,
            transmission_time: transmissionTime,
            webhook_id: PAYPAL_WEBHOOK_ID,
            webhook_event: JSON.parse(rawBody),
        }),
    });

    if (!verifyResponse.ok) {
        console.error('❌ PayPal webhook verification API error:', verifyResponse.status);
        return false;
    }

    const verifyData = await verifyResponse.json();
    return verifyData.verification_status === 'SUCCESS';
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const limit = checkRateLimit(`paypal-webhook:${clientIp}`, 60, 60000);
  if (!limit.allowed) {
    return rateLimitResponse(limit.remaining, limit.resetAt);
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (e) {
    return new Response('Failed to read body', { status: 400 });
  }

  const isValid = await verifyPayPalSignature(req, rawBody);
  if (!isValid) {
    console.error('❌ PayPal webhook signature verification failed');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Log the event for debugging
  console.log('PayPal webhook event:', JSON.stringify(event));

  // Idempotency: skip duplicate events
  const eventId = event.id || event.resource?.id || `paypal-${crypto.randomUUID()}`;
  const alreadyProcessed = await isEventProcessed(supabase, eventId);
  if (alreadyProcessed) {
    console.log(`⏭️ PayPal event ${eventId} already processed — skipping.`);
    return new Response(JSON.stringify({ received: true, idempotent: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract user information from the subscription
  const eventType = event.event_type;
  let user_id = null;
  let email = null;

  if (event.resource?.custom_id) {
    user_id = event.resource.custom_id;
  }

  if (event.resource?.subscriber?.email_address) {
    email = event.resource.subscriber.email_address;
  }

  // Handle subscription activation
  if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' && (user_id || email)) {
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
          payment_provider: 'paypal',
          subscription_id: event.resource.id
        },
      ], { onConflict: 'user_id' });

    if (error) {
      console.error('Supabase upsert error:', error);
      return new Response('Database error', { status: 500 });
    }

    await markEventProcessed(supabase, eventId, "paypal", eventType, event);

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
          amount: 1599, // standard price
          currency: "usd",
          paymentProcessor: "paypal",
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

  // Handle subscription cancellation
  if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' && (user_id || email)) {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id);

    if (error) {
      console.error('Supabase update error:', error);
      return new Response('Database error', { status: 500 });
    }
    return new Response('OK', { status: 200 });
  }

  // Handle payment completion
  if (eventType === 'PAYMENT.SALE.COMPLETED' && (user_id || email)) {
    // Update subscription status if not already active
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user_id)
      .single();

    if (!existingSubscription || existingSubscription.status !== 'active') {
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
            payment_provider: 'paypal',
            subscription_id: event.resource.billing_agreement_id
          },
        ], { onConflict: 'user_id' });

      if (error) {
        console.error('Supabase upsert error:', error);
        return new Response('Database error', { status: 500 });
      }
    }
    return new Response('OK', { status: 200 });
  }

  // If not a relevant event or missing user info
  return new Response('Ignored', { status: 200 });
}); 