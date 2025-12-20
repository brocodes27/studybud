// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { action, subject, classLevel, stream, chapters, difficulty, totalMarks, sections, chapterWeightage } = await req.json();

        if (!OPENAI_API_KEY) {
            throw new Error("OpenAI API key not set");
        }

        if (action === "syllabus") {
            // ... (keep current syllabus logic)
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
            // 1. Retrieve relevant PYQs (RAG)
            let similarQuestions: any[] = [];
            try {
                const query = `Class ${classLevel} ${subject} questions about ${chapters.join(", ")}`;

                // Get Embedding
                const embRes = await fetch("https://api.openai.com/v1/embeddings", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: "text-embedding-3-small",
                        input: query
                    })
                });
                const embData = await embRes.json();
                const embedding = embData.data[0].embedding;

                // Vector Search
                const { data: matches, error: matchErr } = await supabase.rpc('match_questions', {
                    query_embedding: embedding,
                    match_threshold: 0.4,
                    match_count: 10,
                    filter_class: classLevel,
                    filter_subject: subject,
                });

                if (!matchErr) {
                    similarQuestions = matches || [];
                }
            } catch (e) {
                console.warn("RAG retrieval failed:", e);
            }

            // 2. Construct Prompt with RAG Context
            const ragContext = similarQuestions.length > 0
                ? `\n\nREFERENCE THESE REAL CBSE QUESTIONS FOR STYLE AND DIFFICULTY:\n${JSON.stringify(similarQuestions.map(q => ({ q: q.question, marks: q.marks, type: q.type })), null, 2)}`
                : "";

            const weightageContext = chapterWeightage
                ? `\n\nSTRICT CHAPTER WEIGHTAGE:\n${JSON.stringify(chapterWeightage)}\nEnsure total marks for each unit align.`
                : "";

            const prompt = `Generate a CBSE Class ${classLevel} ${subject} exam paper with ${totalMarks} marks.

REQUIREMENTS:
1. Difficulty: ${difficulty}
2. Chapters to cover: ${chapters.join(", ")}
3. Include these question types: ${sections.join(", ")}

CBSE QUALITY STANDARDS:
- Use real-world scenarios and application-based questions (competency-based)
- For Math/Science: Use LaTeX notation with $ symbols for formulas
- MCQs must have exactly 4 options labeled A, B, C, D
- Assertion-Reasoning: Include at least 2 Assertion-Reasoning type questions within the MCQ section.
- Follow official CBSE marking scheme distribution
${weightageContext}
${ragContext}

STRICT OUTPUT FORMAT:
Return ONLY a valid JSON object with a "questions" key. Each question object must have:
{
  "section": "A" or "B" or "C",
  "type": "mcq" or "short" or "long",
  "question": "question text here",
  "marks": number,
  "options": ["A text", "B text", "C text", "D text"],
  "correct_answer": "Option letter (A/B/C/D) for MCQs, or full answer for others"
}

Generate approximately ${Math.ceil(totalMarks / 3)} questions to reach ${totalMarks} marks total.`;

            const completion = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: "You are an expert CBSE exam setter." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" }
                })
            });
            const data = await completion.json();
            const text = data.choices[0].message.content;
            return new Response(text, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        else if (action === "ocr") {
            // Optical Character Recognition (Vision)
            const { images } = await req.json(); // Array of base64 strings or strings with data: prefix
            if (!images || !Array.isArray(images)) throw new Error("Images array required");

            // Filter out non-image content if needed or handle PDF
            const contentParts: any[] = [
                { type: "text", text: "Extract all handwritten answers as clean, plain text in reading order. Preserve question numbers if visible (e.g., Q1, 1., (a)). Remove headers/footers and ignore non-answer artifacts." }
            ];

            for (const img of images) {
                if (img.includes('application/pdf') || img.startsWith('JVBERi0')) { // PDF magic bytes
                    // For now, GPT-4o Vision doesn't handle PDF directly in Chat Completions.
                    // Ideally we'd convert it, but as a shortcut we can ask for text if it's digital,
                    // or just ignore if it's a scan until we have a converter.
                    // FOR NOW: Let's treat it as a request to handle PDF.
                    // Since it's handwritten, we really need images.
                    continue;
                }
                contentParts.push({
                    type: "image_url",
                    image_url: { url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}` }
                });
            }

            if (contentParts.length === 1) {
                return new Response(JSON.stringify({ text: "Please upload image files for handwritten OCR. PDF support is coming soon (needs conversion to images)." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

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
