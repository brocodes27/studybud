import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-embeddings-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Shared secret check to prevent public abuse
    const providedSecret = req.headers.get("x-embeddings-secret");
    const sharedSecret = Deno.env.get("EMBEDDINGS_SHARED_SECRET");
    if (!sharedSecret || !providedSecret || providedSecret !== sharedSecret) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured on server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const input = body?.input;
    if (!input) {
      return new Response(
        JSON.stringify({ error: "Invalid request: { input } required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const textToEmbed = Array.isArray(input) ? input[0] : input;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: {
            parts: [{ text: String(textToEmbed) }]
          }
        })
      }
    );

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify(data), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const embedding = data?.embedding?.values || [];
    const openaiLike = {
      object: "list",
      data: [{ object: "embedding", index: 0, embedding }],
      model: "text-embedding-004"
    };

    return new Response(JSON.stringify(openaiLike), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: "Proxy failed", details: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
