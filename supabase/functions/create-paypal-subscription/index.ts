import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// PayPal credentials from environment variables
const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET');
const PAYPAL_BASE_URL = Deno.env.get('PAYPAL_BASE_URL') || 'https://api-m.sandbox.paypal.com'; // Use sandbox for testing

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get PayPal access token
async function getPayPalAccessToken() {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  
  const data = await response.json();
  
  if (!data.access_token) {
    console.error('❌ No access token received from PayPal');
    throw new Error('Failed to get PayPal access token');
  }
  
  return data.access_token;
}

// Create PayPal subscription
async function createPayPalSubscription(accessToken: string, userData: any, currency: string) {
  const paymentData = {
    intent: 'CAPTURE',
    application_context: {
      brand_name: 'AI Study Planner',
      landing_page: 'LOGIN',
      user_action: 'PAY_NOW',
      return_url: `${Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'}/payment/success`,
      cancel_url: `${Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'}/payment/cancel`
    },
    purchase_units: [
      {
        reference_id: userData.user_id,
        description: 'AI Study Planner Monthly Subscription',
        custom_id: userData.user_id,
        amount: {
          currency_code: currency,
          value: currency === 'USD' ? '5.00' : currency === 'EUR' ? '2.50' : '5.00'
        }
      }
    ]
  };

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(paymentData)
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ PayPal API error:', data?.message || data?.error_description || 'Unknown error');
    throw new Error(`PayPal API error: ${data.error_description || data.message || 'Unknown error'}`);
  }

  return data;
}

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

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    console.error('❌ PayPal credentials not set');
    return new Response(JSON.stringify({ error: 'PayPal environment variables not set. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { user_id, email, currency = 'USD', name, surname } = await req.json();
    
    if (!user_id || !email) {
      return new Response(JSON.stringify({ error: 'Missing user_id or email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create PayPal payment
    const payment = await createPayPalSubscription(accessToken, {
      user_id,
      email,
      name,
      surname
    }, currency);

    // Return the approval link
    const approvalLink = payment.links?.find((link: any) => link.rel === 'approve')?.href;
    
    if (approvalLink) {
      return new Response(JSON.stringify({ 
        approval_url: approvalLink,
        order_id: payment.id,
        status: payment.status
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.error('❌ No approval link found in PayPal response');
      return new Response(JSON.stringify({ 
        error: 'No approval link available in payment response',
        debug: {
          status: payment.status,
          id: payment.id
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('❌ PayPal function error:', err?.message || err);
    return new Response(JSON.stringify({ error: 'Internal server error', details: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 