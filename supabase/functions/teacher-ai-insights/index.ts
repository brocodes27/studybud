// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Add CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Read Gemini API key from environment variable
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { classId, students, resources, assignments, prompt } = await req.json();
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Gemini API key not set." }), { status: 500, headers: corsHeaders });
    }
    // Compose the prompt
    const fullPrompt = `Class ID: ${classId}
Students: ${JSON.stringify(students)}
Resources: ${JSON.stringify(resources)}
Assignments: ${JSON.stringify(assignments)}

${prompt}`;

    // Call Gemini API
    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
      }),
    });
    const geminiData = await geminiRes.json();
    const summary =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      geminiData?.candidates?.[0]?.content?.text ||
      JSON.stringify(geminiData);
    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), { status: 500, headers: corsHeaders });
  }
}); 