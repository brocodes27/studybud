import { callMeta } from "../_shared/meta.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getCors } from "../_shared/cors.ts";


// CORS handled per-request via getCors()

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
    const { notes } = await req.json();
    if (!notes || typeof notes !== 'string' || notes.trim().length < 10) {
      return new Response(JSON.stringify({ error: 'Please provide sufficient notes text.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Format the following meeting notes to be clear, structured, and easy to review. Use headings, bullet points, and summaries where appropriate. Do not add information that is not present in the notes.\n\nNotes:\n${notes}`;

    const formatted_notes = await callMeta([{ role: "user", content: prompt }]);

    return new Response(JSON.stringify({ formatted_notes }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 
