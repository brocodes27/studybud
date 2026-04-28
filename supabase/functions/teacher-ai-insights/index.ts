// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGemini } from "../_shared/gemini.ts";
import { getCors } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = getCors(req);
  const corsHeaders = cors.headers;
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: "CORS origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
