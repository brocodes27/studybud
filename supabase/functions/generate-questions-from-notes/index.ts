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

    const prompt = `Given the following study notes, generate 5 practice questions that help a student actively recall the material. Use a mix of question types (multiple choice, short answer, fill-in-the-blank). Only return the questions, no answers or explanations.\n\nNotes:\n${notes}`;

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

    // Parse questions from Gemini response
    let questions: string[] = [];
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (text) {
      // Split by line breaks or numbers/bullets
      questions = text.split(/\n+|\d+\.\s+/).map(q => q.trim()).filter(q => q.length > 0);
    }

    return new Response(JSON.stringify({ questions }), {
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
