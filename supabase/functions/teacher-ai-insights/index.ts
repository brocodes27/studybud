// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGemini } from "../_shared/gemini.ts";

// Add CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { classId, students, resources, assignments, prompt } = await req.json();

    // Compose the prompt
    const fullPrompt = `Class ID: ${classId}
Students: ${JSON.stringify(students)}
Resources: ${JSON.stringify(resources)}
Assignments: ${JSON.stringify(assignments)}

${prompt}`;

    const summary = await callGemini([
      { role: "system", content: "You are an expert personalized educational consultant for a teacher." },
      { role: "user", content: fullPrompt }
    ]);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), { status: 500, headers: corsHeaders });
  }
});