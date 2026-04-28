import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getCors } from "../_shared/cors.ts";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

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

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) {
      return new Response(JSON.stringify({ error: geminiData.error?.message || 'Gemini API error', details: geminiData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse formatted notes from Gemini response
    const formatted_notes = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

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
