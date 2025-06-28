import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Load Razorpay credentials from environment variables
const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');
// IMPORTANT: Set your Razorpay plan_id in the environment or replace below
const PLAN_ID = 'plan_QlYEtRWPX0ddUj';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // or "http://localhost:5173" for local dev
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Require Authorization header for POST
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ code: 401, message: 'Missing authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return new Response(JSON.stringify({ error: 'Razorpay environment variables not set. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { user_id, email, plan_id } = await req.json();
    if (!user_id || !email) {
      return new Response(JSON.stringify({ error: 'Missing user_id or email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use plan_id from request if provided, else default
    const planIdToUse = plan_id || PLAN_ID;

    // Create Razorpay subscription
    const subPayload = {
      plan_id: planIdToUse,
      customer_notify: 1,
      total_count: 1,
      notes: { user_id, email },
    };
    const auth = `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`;
    const encodedAuth = btoa(auth);
    const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encodedAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subPayload),
    });
    const subData = await subRes.json();
    if (!subRes.ok) {
      return new Response(JSON.stringify({ error: subData.error?.description || 'Failed to create subscription', details: subData }), {
        status: subRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use the short_url from the subscription response
    if (subData.short_url) {
      return new Response(JSON.stringify({ short_url: subData.short_url }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ error: 'No payment link available in subscription response', details: subData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 