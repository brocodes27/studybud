import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getCors } from "../_shared/cors.ts";

const DODO_API_KEY = Deno.env.get('DODO_PAYMENTS_API_KEY');
const PRODUCT_ID = Deno.env.get('DODO_PRODUCT_ID') || 'pdt_default';
const SEMESTER_PRODUCT_ID = Deno.env.get('DODO_SEMESTER_PRODUCT_ID') || PRODUCT_ID;
const RETURN_URL = Deno.env.get('DODO_RETURN_URL') || 'https://elevenfolks.com/subscription';

/**
 * Curve passes sold through Dodo Payments:
 * - monthly  -> DODO_PRODUCT_ID         (one payment, 30 days of access)
 * - semester -> DODO_SEMESTER_PRODUCT_ID (one payment, ~4 months of access)
 * The product ids are server-side secrets configured in the Supabase project
 * so the API key never touches the browser.
 */

const DAYS_BY_PLAN: Record<string, number> = {
  monthly: 30,
  semester: 120,
};

function planToProduct(plan: string): string {
  return plan === 'semester' ? SEMESTER_PRODUCT_ID : PRODUCT_ID;
}

function planToDays(plan: string): number {
  return DAYS_BY_PLAN[plan] ?? 30;
}

serve(async (req) => {
    const cors = getCors(req);
    const corsHeaders = cors.headers;
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (!cors.allowed) {
        return new Response(JSON.stringify({ error: "CORS origin not allowed" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

        const { user_id, email, plan = 'monthly' } = await req.json();

        if (!user_id || !email) {
            return new Response(JSON.stringify({ error: 'Missing user_id or email' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Where the browser lands after payment; the webhook decides premium.
        const origin = req.headers.get('origin') || 'https://elevenfolks.com';
        const returnUrl = `${origin}/subscription?checkout=success&plan=${plan}`;

        // Dodo Payments Checkout Sessions API (recommended)
        // Base URLs: test.dodopayments.com (test) | live.dodopayments.com (live)
        const DODO_BASE = Deno.env.get('DODO_TEST_MODE') === 'true'
            ? 'https://test.dodopayments.com'
            : 'https://live.dodopayments.com';

        const requestBody = {
            product_cart: [{ product_id: planToProduct(plan), quantity: 1 }],
            customer: {
                email: email,
                name: email.split('@')[0],
            },
            payment_link: true,
            return_url: returnUrl,
            metadata: {
                user_id,
                plan,
                access_days: planToDays(plan),
            },
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
