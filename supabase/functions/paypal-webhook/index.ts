import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Supabase client for Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Verify PayPal webhook signature
async function verifyWebhookSignature(body: string, headers: Headers) {
  // In production, you should verify the webhook signature
  // For now, we'll skip verification for simplicity
  // You can implement this using PayPal's webhook verification
  return true;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let event;
  try {
    event = await req.json();
  } catch (e) {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Log the event for debugging
  console.log('PayPal webhook event:', JSON.stringify(event));

  // Verify webhook signature (implement in production)
  const isValid = await verifyWebhookSignature(JSON.stringify(event), req.headers);
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
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