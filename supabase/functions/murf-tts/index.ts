import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getCors } from "../_shared/cors.ts";

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
    // Optional: verify Supabase auth (recommended)
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (authHeader && supabaseUrl && supabaseServiceKey) {
      const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          "Authorization": authHeader,
          "apikey": supabaseServiceKey,
        },
      });
      if (!userResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Invalid authorization token" }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const murfApiKey = Deno.env.get("MURF_API_KEY");
    const murfApiUrl = Deno.env.get("MURF_API_URL");

    if (!murfApiKey || !murfApiUrl) {
      return new Response(
        JSON.stringify({ error: "Murf API configuration missing on server" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();

    // Pass-through to Murf (or your own gateway). Expect JSON body and Bearer auth.
    const upstream = await fetch(murfApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${murfApiKey}`,
      },
      body: JSON.stringify(body),
    });

    // Stream back the upstream response (audio/* or JSON)
    const respHeaders = new Headers(corsHeaders);
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-type') respHeaders.set('Content-Type', value);
      if (key.toLowerCase() === 'content-length') respHeaders.set('Content-Length', value);
      if (key.toLowerCase() === 'content-disposition') respHeaders.set('Content-Disposition', value);
    });

    const respBody = upstream.body;
    return new Response(respBody, { status: upstream.status, headers: respHeaders });
  } catch (err: any) {
    console.error('murf-tts proxy error', err);
    return new Response(JSON.stringify({ error: 'Proxy failed', details: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
