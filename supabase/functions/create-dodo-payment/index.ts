import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const DODO_API_KEY = Deno.env.get('DODO_PAYMENTS_API_KEY');
const PRODUCT_ID = Deno.env.get('DODO_PRODUCT_ID') || 'pdt_default';
const RETURN_URL = Deno.env.get('DODO_RETURN_URL') || 'https://studybud.pro/atlas';

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        if (!DODO_API_KEY) {
            throw new Error('DODO_PAYMENTS_API_KEY is not set in Supabase project secrets.');
        }

        const { user_id, email, product_id } = await req.json();

        if (!user_id || !email) {
            return new Response(JSON.stringify({ error: 'Missing user_id or email' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const productIdToUse = product_id || PRODUCT_ID;

        // Dodo Payments Checkout Sessions API (recommended)
        // Base URLs: test.dodopayments.com (test) | live.dodopayments.com (live)
        const DODO_BASE = Deno.env.get('DODO_TEST_MODE') === 'true'
            ? 'https://test.dodopayments.com'
            : 'https://live.dodopayments.com';

        const requestBody = {
            product_cart: [{ product_id: productIdToUse, quantity: 1 }],
            customer: {
                email: email,
                name: email.split('@')[0],
            },
            payment_link: true,
            return_url: RETURN_URL,
            metadata: { user_id },
        };

        console.log('📤 Dodo API Request:', DODO_BASE + '/checkouts');
        console.log('📦 Request Body:', JSON.stringify(requestBody));

        const response = await fetch(`${DODO_BASE}/checkouts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DODO_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        // Read raw text first to handle non-JSON responses
        const responseText = await response.text();
        console.log('📥 Dodo API Response Status:', response.status);
        console.log('📥 Dodo API Response Body:', responseText);

        if (!response.ok) {
            return new Response(JSON.stringify({
                error: 'Dodo API error',
                status: response.status,
                details: responseText,
            }), {
                status: response.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Parse JSON only after confirming we got a valid response
        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            return new Response(JSON.stringify({
                error: 'Invalid JSON from Dodo API',
                raw: responseText.substring(0, 500),
            }), {
                status: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Dodo returns checkout_url for the checkout page
        const paymentUrl = data.checkout_url || data.payment_link || data.url;

        if (!paymentUrl) {
            return new Response(JSON.stringify({
                error: 'No checkout URL in Dodo response',
                data,
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ url: paymentUrl }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err: any) {
        console.error('❌ Create Payment Error:', err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
