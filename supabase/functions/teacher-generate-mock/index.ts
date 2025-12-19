// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Add CORS headers
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Read OpenAI API key from environment variable
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { dailyTopics, mockQuestionCount } = await req.json();

        if (!OPENAI_API_KEY) {
            return new Response(JSON.stringify({ error: "OpenAI API key not set in Edge Function secrets." }), { status: 500, headers: corsHeaders });
        }

        const prompt = `You are an expert CBSE question setter. Create a short mock test strictly based on the following topics taught today. Keep it aligned with latest CBSE patterns.

Topics taught today:
${dailyTopics}

Rules:
- Total questions: ${mockQuestionCount}
- Include a balanced mix: MCQs (with 4 options A-D, exactly one correct), Short Answer (2-4 lines), Long Answer (6-10 lines)
- Provide marks per question: MCQ 1 mark, Short 2-3 marks, Long 4-5 marks
- Output strictly a JSON object with a 'questions' key containing the array. Structure: { "questions": [...] }. No markdown formatting.
Each question item: {"index": number, "type": "mcq"|"short"|"long", "question": string, "marks": number, "options"?: string[]}
`;

        // Call OpenAI API
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "You are a helpful assistant that outputs only JSON." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || "OpenAI API error");
        }

        const text = data.choices[0]?.message?.content || "";
        // Clean up potential markdown code blocks if any (though json_object format usually avoids them, it's safe to clean)
        const clean = text.trim().replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();

        // We expect the LLM to return a JSON object like { "questions": [...] } or similar due to json_object constraint,
        // OR just the array. Check what it returns.
        // Actually with response_format: { type: "json_object" }, it MUST return an object associated with keys.
        // My prompt asked for a JSON *array*, which conflicts with json_object mode if the root is an array.
        // json_object mode requires the output to be a valid JSON object (dictionary).
        // I should adjust the prompt to wrapped the array in a key, e.g. { "questions": [...] }

        return new Response(JSON.stringify({ content: clean }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Unknown error" }), { status: 500, headers: corsHeaders });
    }
});
