import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify Supabase JWT to ensure only authenticated users can call
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

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

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const geminiModel = Deno.env.get("GEMINI_MODEL") || "gemini-3-flash-preview";
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured on server" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Allow the client to specify the same body used for chat completions
    const body = await req.json();

    // Basic sanitization: ensure messages array exists
    if (!body || !Array.isArray(body.messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const messages = body.messages || [];
    const systemParts = messages.filter((m: any) => m.role === 'system').map((m: any) => m.content).join('\n');
    const convoParts = messages.filter((m: any) => m.role !== 'system').map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const fullPrompt = `${systemParts ? `SYSTEM INSTRUCTION: ${systemParts}\n\n` : ''}${convoParts}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: body.temperature ?? 0.7,
          maxOutputTokens: body.max_tokens ?? body.max_completion_tokens ?? 2048
        }
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify(data), { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const openaiLike = {
      id: 'gemini-proxy',
      object: 'chat.completion',
      choices: [{ message: { role: 'assistant', content: text } }]
    };

    return new Response(JSON.stringify(openaiLike), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('openai-proxy error', err);
    return new Response(JSON.stringify({ error: 'Proxy failed', details: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
