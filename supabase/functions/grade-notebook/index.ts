// deno-lint-ignore-file no-explicit-any
// grade-notebook: OCR + AI-evaluate the captured pages of a grading_sessions
// row (Notebook Grader Machine) and append the result to the student's
// test_results record (visible on teacher/student/parent dashboards).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, callGeminiJSON } from "../_shared/gemini.ts";
import { getCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const BUCKET = "notebook-scans";

function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

interface EvaluationItem {
    question_number: number;
    marks_awarded: number;
    max_marks: number;
    feedback: string;
}

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

    // Parse the request body EXACTLY ONCE.
    let session_id: string | undefined;
    try {
        ({ session_id } = await req.json());
    } catch (_e) {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
    if (!session_id) {
        return new Response(JSON.stringify({ error: "session_id is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    try {
        // 1) Load session + captured pages
        const { data: session, error: sessionErr } = await supabase
            .from("grading_sessions")
            .select("*")
            .eq("id", session_id)
            .single();
        if (sessionErr || !session) throw new Error(`Grading session not found: ${sessionErr?.message || session_id}`);

        const { data: pages, error: pagesErr } = await supabase
            .from("grading_pages")
            .select("*")
            .eq("session_id", session_id)
            .order("page_number", { ascending: true });
        if (pagesErr) throw pagesErr;
        if (!pages || pages.length === 0) throw new Error("No captured pages found for this session. Capture pages first.");

        await supabase.from("grading_sessions")
            .update({ status: "checking", error_message: null })
            .eq("id", session_id);

        // 2) OCR each page individually (avoids the 4000-token cap on long
        //    notebooks), persist ocr_text per page, and concatenate.
        const ocrChunks: string[] = [];
        for (const page of pages) {
            let pageText = page.ocr_text as string | null;
            if (!pageText) {
                const { data: fileData, error: dlErr } = await supabase.storage
                    .from(BUCKET)
                    .download(page.storage_path);
                if (dlErr || !fileData) throw new Error(`Failed to download page ${page.page_number}: ${dlErr?.message}`);
                const bytes = new Uint8Array(await fileData.arrayBuffer());
                const base64 = bytesToBase64(bytes);
                const mime = page.storage_path.endsWith(".png") ? "image/png" : "image/jpeg";

                pageText = await callGemini(
                    [{
                        role: "user",
                        content: [
                            { type: "text", text: "Extract all handwritten answers as clean, plain text in reading order. Preserve question numbers if visible (e.g., Q1, 1., (a)). Remove headers/footers and ignore non-answer artifacts." },
                            { type: "image", dataUrl: `data:${mime};base64,${base64}` },
                        ],
                    }],
                    { maxOutputTokens: 4000 },
                );
                await supabase.from("grading_pages").update({ ocr_text: pageText }).eq("id", page.id);
            }
            ocrChunks.push(`--- Page ${page.page_number} ---\n${pageText}`);
        }
        const studentText = ocrChunks.join("\n\n");

        // 3) Evaluate against the session's question paper (or infer questions)
        const questions = Array.isArray(session.question_paper) ? session.question_paper : [];
        const questionsList = questions.length > 0
            ? questions.map((q: any, idx: number) => `${q.question_number ?? idx + 1}. ${q.question} (${q.marks ?? q.max_marks ?? 1} marks)`).join("\n")
            : "No question paper provided. Infer the questions and reasonable max marks from the student's answers themselves (use the question numbers visible in the text).";

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

        const results = await callGeminiJSON<EvaluationItem[]>(
            [
                { role: "system", content: "You are a strict CBSE examiner. Output strictly JSON." },
                { role: "user", content: prompt },
            ],
            { json: true },
        );
        if (!Array.isArray(results) || results.length === 0) {
            throw new Error("No readable answers were found in the captured pages. Please make sure the camera is pointed correctly at the student notebook.");
        }

        const total = results.reduce((a, r) => a + (Number(r.marks_awarded) || 0), 0);
        const max = results.reduce((a, r) => a + (Number(r.max_marks) || 0), 0);
        const weakTopics = results
            .filter((r) => (Number(r.marks_awarded) || 0) < (Number(r.max_marks) || 0))
            .map((r) => ({
                topic: `Q${r.question_number}: ${(r.feedback || "").slice(0, 80)}`,
                severity: (Number(r.marks_awarded) || 0) === 0 ? "high" : "medium",
            }));

        // 4) Append to the student's record (mirrors analyse-test-result's
        //    resultRecord, but written with service role because the
        //    teacher/device — not the student — triggered the grading).
        let testResultId: string | null = null;
        if (session.student_user_id) {
            // Find the student's active roadmap for correction-sprint chaining
            let roadmapId: string | null = null;
            try {
                const { data: roadmap } = await supabase
                    .from("student_roadmaps")
                    .select("id")
                    .eq("user_id", session.student_user_id)
                    .eq("is_active", true)
                    .limit(1)
                    .maybeSingle();
                roadmapId = roadmap?.id ?? null;
            } catch (_e) { /* roadmap lookup is best-effort */ }

            const { data: testResult, error: insertErr } = await supabase
                .from("test_results")
                .insert({
                    user_id: session.student_user_id,
                    roadmap_id: roadmapId,
                    class_id: session.class_id,
                    test_name: session.test_name || "Notebook Check",
                    test_date: new Date().toISOString(),
                    score_obtained: Math.round(total),
                    score_total: Math.round(max),
                    weak_topics: weakTopics,
                    status: "analyzed",
                })
                .select()
                .single();
            if (insertErr) throw insertErr;
            testResultId = testResult.id;

            // Per-question telemetry (best-effort)
            try {
                await supabase.from("test_attempt_questions").insert(
                    results.map((r) => ({
                        test_result_id: testResultId,
                        question_number: r.question_number,
                        marks_obtained: r.marks_awarded,
                        marks_total: r.max_marks,
                    })),
                );
            } catch (e) {
                console.warn("test_attempt_questions insert skipped:", e);
            }

            // Correction sprint chaining (best-effort)
            if (roadmapId) {
                try {
                    await supabase.functions.invoke("generate-correction-sprint", {
                        body: { test_result_id: testResultId, roadmap_id: roadmapId, weak_topics: weakTopics },
                    });
                } catch (e) {
                    console.warn("generate-correction-sprint invocation failed:", e);
                }
            }
        }

        // 5) Mark the session graded
        await supabase.from("grading_sessions")
            .update({
                status: "graded",
                result: { total, max, per_question: results },
                test_result_id: testResultId,
                error_message: null,
            })
            .eq("id", session_id);

        return new Response(
            JSON.stringify({ success: true, total, max, per_question: results, test_result_id: testResultId }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (error: any) {
        console.error("grade-notebook failed:", error);
        try {
            await supabase.from("grading_sessions")
                .update({ status: "failed", error_message: String(error?.message || error) })
                .eq("id", session_id);
        } catch (_e) { /* best-effort */ }
        const status = error?.message?.includes("No readable answers") ? 400 : 500;
        return new Response(JSON.stringify({ error: error?.message || String(error) }), {
            status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
