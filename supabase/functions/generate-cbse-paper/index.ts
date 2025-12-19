// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { action, subject, classLevel, stream, chapters, difficulty, totalMarks, sections } = await req.json();

        if (!OPENAI_API_KEY) {
            throw new Error("OpenAI API key not set");
        }

        if (action === "syllabus") {
            // Fetch chapters
            const prompt = `Carefully follow the official CBSE syllabus structure for Class ${classLevel} ${subject} ${stream ? `(${stream})` : ''}.
Return a valid JSON object with a "units" key containing an array of units.
Each unit should have:
- unit (string): exact name
- weightage (number): official marks
- chapters: list of objects { "name": "Chapter Name" }

Do not output anything else.`;

            const completion = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: "You are a CBSE syllabus expert. Output strictly JSON." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" }
                })
            });
            const data = await completion.json();
            const text = data.choices[0].message.content;
            return new Response(text, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        } else if (action === "generate") {
            // Generate Paper
            const prompt = `Generate a CBSE Class ${classLevel} ${subject} exam paper with ${totalMarks} marks.
Difficulty: ${difficulty}
Chapters: ${chapters.join(", ")}
Sections: ${sections.join(", ")}

Requirements:
- Use real-world scenarios (competency-based)
- MCQs must have 4 options (A, B, C, D) inside an 'options' array
- Return a JSON object with a "questions" key containing an array of questions.
Each question: { "section": "A/B/C", "type": "mcq/short/long", "question": "text", "marks": number, "options": ["A", "B", "C", "D"], "correct_answer": "A" (if mcq) or text }

Strictly JSON.`;

            const completion = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: "You are an expert CBSE exam setter. Output strictly JSON." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" }
                })
            });
            const data = await completion.json();
            const text = data.choices[0].message.content;
            return new Response(text, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else if (action === "ocr") {
            // Optical Character Recognition (Vision)
            const { images } = await req.json(); // Array of base64 strings
            if (!images || !Array.isArray(images)) throw new Error("Images array required");

            const contentParts = [
                { type: "text", text: "Extract all handwritten answers as clean, plain text in reading order. Preserve question numbers if visible (e.g., Q1, 1., (a)). Remove headers/footers and ignore non-answer artifacts." },
                ...images.map((img: string) => ({
                    type: "image_url",
                    image_url: { url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` }
                }))
            ];

            const completion = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "user", content: contentParts }
                    ],
                    max_tokens: 4000
                })
            });
            const data = await completion.json();
            const text = data.choices[0].message.content;
            return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

        } else if (action === "evaluate") {
            // Evaluate Answers
            const { questions, studentText } = await req.json();

            // Format questions list
            const questionsList = Array.isArray(questions)
                ? questions.map((q: any, idx: number) => `${idx + 1}. ${q.question} (${q.marks} marks)`).join("\n")
                : questions;

            const prompt = `You are a strict CBSE board examiner. Below is a list of exam questions and a student's handwritten answers (extracted as plain text).
Your tasks:
1. For each question, find the corresponding answer from the student's text.
2. Evaluate each answer according to the latest CBSE marking scheme.
3. Return ONLY a valid JSON array. Each item:
{
   "question_number": number,
   "marks_awarded": number,
   "max_marks": number,
   "feedback": "detailed constructive feedback"
}

Questions:
${questionsList}

Student's Answers:
${studentText}`;

            const completion = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: "You are a strict CBSE examiner. Output strictly JSON." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" }
                })
            });
            const data = await completion.json();
            const text = data.choices[0].message.content;
            return new Response(text, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
});
