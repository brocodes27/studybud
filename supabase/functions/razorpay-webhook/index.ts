import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Supabase client for Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
  console.log('Razorpay webhook event:', JSON.stringify(event));

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

    // Notify Dub.co of the sale
    try {
      const dubApiKey = Deno.env.get("DUB_API_KEY") || "dub_KgTsJoBfJGMT7jDjmxzF1m3I";
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