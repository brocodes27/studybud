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
    page_numbers?: number[];
}

type AnnotationKind = "underline" | "circle" | "comment" | "score" | "tick" | "strike";
type AnnotationTone = "correct" | "incorrect" | "guidance";

interface VisualAnnotation {
    id: string;
    kind: AnnotationKind;
    tone: AnnotationTone;
    status: "suggested";
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    confidence: number;
    question_number?: number;
}

const ANNOTATION_KINDS = new Set<AnnotationKind>(["underline", "circle", "comment", "score", "tick", "strike"]);
const ANNOTATION_TONES = new Set<AnnotationTone>(["correct", "incorrect", "guidance"]);

function clamp(value: number, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
}

function normalizedCoordinate(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return clamp(parsed > 1 ? parsed / 1000 : parsed);
}

function normalizeVisualAnnotations(value: unknown, pageNumber: number): VisualAnnotation[] {
    if (!Array.isArray(value)) return [];

    return value.slice(0, 40).flatMap((raw: any, index) => {
        const kind = String(raw?.kind || "") as AnnotationKind;
        if (!ANNOTATION_KINDS.has(kind)) return [];

        const x = clamp(normalizedCoordinate(raw.x), 0, 0.985);
        const y = clamp(normalizedCoordinate(raw.y), 0, 0.985);
        const defaultWidth = kind === "tick" ? 0.05 : kind === "comment" ? 0.28 : 0.2;
        const defaultHeight = kind === "underline" ? 0.03 : kind === "score" ? 0.08 : 0.08;
        const width = clamp(normalizedCoordinate(raw.width) || defaultWidth, 0.015, Math.max(0.015, 1 - x));
        const height = clamp(normalizedCoordinate(raw.height) || defaultHeight, 0.015, Math.max(0.015, 1 - y));
        const tone = String(raw?.tone || "") as AnnotationTone;
        const questionNumber = Number(raw?.question_number);

        return [{
            id: `page-${pageNumber}-annotation-${index + 1}`,
            kind,
            tone: ANNOTATION_TONES.has(tone) ? tone : "guidance",
            status: "suggested" as const,
            x,
            y,
            width,
            height,
            text: String(raw?.text || "").trim().slice(0, 500),
            confidence: clamp(Number(raw?.confidence) || 0),
            ...(Number.isFinite(questionNumber) && questionNumber > 0
                ? { question_number: Math.round(questionNumber) }
                : {}),
        }];
    });
}

function isLeaseLoss(error: unknown) {
    return String((error as any)?.message || error).includes("grading lease was lost");
}

async function writePageAnnotations(
    pageId: string,
    runToken: string,
    annotations: VisualAnnotation[],
    reviewStatus: "pending" | "review",
) {
    const { error } = await supabase.rpc("set_notebook_page_annotations", {
        p_page_id: pageId,
        p_run_token: runToken,
        p_annotations: annotations,
        p_review_status: reviewStatus,
    });
    if (error) throw error;
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

    // This function writes with the service role and is triggered by the
    // trusted physical grader agent. Never allow a browser token to choose an
    // arbitrary grading session for service-role mutation.
    const bearerToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!SUPABASE_SERVICE_ROLE_KEY || bearerToken !== SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(JSON.stringify({ error: "Trusted grader authorization required" }), {
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

    const runToken = crypto.randomUUID();
    let gradingClaimed = false;
    try {
        // 1) Atomically claim this session. The database lease prevents two
        //    agents or retries from grading the same notebook concurrently.
        const { data: session, error: sessionErr } = await supabase
            .rpc("claim_notebook_grading", {
                p_session_id: session_id,
                p_run_token: runToken,
            })
            .single();
        if (sessionErr || !session) throw new Error(`Grading session not found: ${sessionErr?.message || session_id}`);
        if (session.status === "graded") {
            return new Response(
                JSON.stringify({
                    success: true,
                    already_graded: true,
                    ...(session.result || {}),
                    test_result_id: session.test_result_id,
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }
        gradingClaimed = session.grading_run_token === runToken;
        if (!gradingClaimed) throw new Error("Could not acquire the grading session lease");

        const { data: pages, error: pagesErr } = await supabase
            .from("grading_pages")
            .select("*")
            .eq("session_id", session_id)
            .order("page_number", { ascending: true });
        if (pagesErr) throw pagesErr;
        if (!pages || pages.length === 0) throw new Error("No captured pages found for this session. Capture pages first.");

        // 2) OCR each page individually (avoids the 4000-token cap on long
        //    notebooks), persist ocr_text per page, and concatenate.
        const ocrChunks: string[] = [];
        const pageImages = new Map<string, string>();
        const pageTexts = new Map<string, string>();
        for (const page of pages) {
            const { data: fileData, error: dlErr } = await supabase.storage
                .from(BUCKET)
                .download(page.storage_path);
            if (dlErr || !fileData) throw new Error(`Failed to download page ${page.page_number}: ${dlErr?.message}`);
            const bytes = new Uint8Array(await fileData.arrayBuffer());
            const base64 = bytesToBase64(bytes);
            const mime = page.storage_path.endsWith(".png") ? "image/png" : "image/jpeg";
            const dataUrl = `data:${mime};base64,${base64}`;
            pageImages.set(page.id, dataUrl);

            let pageText = page.ocr_text as string | null;
            if (!pageText) {
                pageText = await callGemini(
                    [{
                        role: "user",
                        content: [
                            { type: "text", text: "Extract all handwritten answers as clean, plain text in reading order. Preserve question numbers if visible (e.g., Q1, 1., (a)). Remove headers/footers and ignore non-answer artifacts." },
                            { type: "image", dataUrl },
                        ],
                    }],
                    { maxOutputTokens: 4000 },
                );
                const { error: ocrWriteError } = await supabase.rpc("set_notebook_page_ocr", {
                    p_page_id: page.id,
                    p_run_token: runToken,
                    p_ocr_text: pageText,
                });
                if (ocrWriteError) throw ocrWriteError;
            }
            pageTexts.set(page.id, pageText);
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
   "feedback": "detailed constructive feedback",
   "page_numbers": [page numbers where this answer is visibly written]
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

        // 4) Revisit every source image with the grading result and produce
        //    non-destructive visual annotations. Coordinates are normalized so
        //    overlays stay attached to the same handwriting at any display size.
        const annotationWarnings: string[] = [];
        let annotationsGenerated = 0;
        for (const page of pages) {
            const pageImage = pageImages.get(page.id);
            if (!pageImage) continue;

            try {
                const pageText = pageTexts.get(page.id) || "";
                const pageEvaluation = results.filter((result) => {
                    const resultPages = Array.isArray(result.page_numbers)
                        ? result.page_numbers.map(Number).filter(Number.isFinite)
                        : [];
                    return resultPages.includes(Number(page.page_number)) ||
                        (pages.length === 1 && Number(page.page_number) === 1);
                });
                if (pageEvaluation.length === 0) {
                    annotationWarnings.push(`Page ${page.page_number} could not be matched confidently to a graded answer.`);
                    await writePageAnnotations(page.id, runToken, [], "review");
                    continue;
                }
                const rawAnnotations = await callGeminiJSON<unknown[]>(
                    [{
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `You are placing a teacher's red-pen marks on this exact handwritten answer-sheet page.

Use the assessment below as the source of truth. Locate the precise handwritten words, equations, or blank margin areas that each mark refers to.

Return ONLY a JSON array. Every item must use this schema:
{
  "kind": "underline" | "circle" | "comment" | "score" | "tick" | "strike",
  "tone": "correct" | "incorrect" | "guidance",
  "x": integer 0..1000,
  "y": integer 0..1000,
  "width": integer 15..1000,
  "height": integer 15..1000,
  "text": "short teacher-facing annotation",
  "confidence": number 0..1,
  "question_number": number
}

Coordinates describe the visible annotation itself, measured from the top-left of this page. Keep every box within the page.
- Use underline or circle on the exact evidence being discussed.
- Use strike only for a clearly incorrect written step.
- Put comment text in nearby blank space or a margin; keep it short and do not cover handwriting.
- Use tick for a correct key step.
- Use score beside the completed answer, formatted like "1.5 / 3".
- Do not invent errors or annotate unreadable content.
- If placement confidence is below 0.55, omit that annotation.
- Prefer 2–6 useful annotations per answered question rather than marking every line.

Page OCR:
${pageText || "No readable OCR text"}

Assessment:
${JSON.stringify(pageEvaluation)}`,
                            },
                            { type: "image", dataUrl: pageImage },
                        ],
                    }],
                    { json: true, temperature: 0.1, maxOutputTokens: 5000 },
                );
                const annotations = normalizeVisualAnnotations(rawAnnotations, page.page_number);
                annotationsGenerated += annotations.length;
                await writePageAnnotations(page.id, runToken, annotations, "review");
            } catch (annotationError: any) {
                if (isLeaseLoss(annotationError)) throw annotationError;
                console.warn(`Annotation generation failed for page ${page.page_number}:`, annotationError);
                annotationWarnings.push(`Page ${page.page_number} needs manual annotation review.`);
                await writePageAnnotations(page.id, runToken, [], "review");
            }
        }

        // 5) Append to the student's record (mirrors analyse-test-result's
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

            const { data: resultRecord, error: insertErr } = await supabase
                .rpc("create_notebook_test_result", {
                    p_session_id: session_id,
                    p_run_token: runToken,
                    p_roadmap_id: roadmapId,
                    p_score_obtained: Math.round(total),
                    p_score_total: Math.round(max),
                    p_weak_topics: weakTopics,
                })
                .single();
            if (insertErr || !resultRecord) throw insertErr || new Error("Failed to create the test result");
            testResultId = resultRecord.result_id;
            const createdTestResult = resultRecord.created === true;

            if (createdTestResult) {
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
        }

        // 6) Mark the session graded
        const { data: finalizedSession, error: finalizeError } = await supabase.from("grading_sessions")
            .update({
                status: "graded",
                result: {
                    total,
                    max,
                    per_question: results,
                    annotations_generated: annotationsGenerated,
                    annotation_warnings: annotationWarnings,
                },
                test_result_id: testResultId,
                error_message: null,
                grading_run_token: null,
                grading_started_at: null,
            })
            .eq("id", session_id)
            .eq("grading_run_token", runToken)
            .select("id")
            .maybeSingle();
        if (finalizeError || !finalizedSession) {
            throw finalizeError || new Error("The grading lease was lost before finalization");
        }
        gradingClaimed = false;

        return new Response(
            JSON.stringify({
                success: true,
                total,
                max,
                per_question: results,
                annotations_generated: annotationsGenerated,
                annotation_warnings: annotationWarnings,
                test_result_id: testResultId,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (error: any) {
        console.error("grade-notebook failed:", error);
        if (gradingClaimed) {
            try {
                await supabase.from("grading_sessions")
                    .update({
                        status: "failed",
                        error_message: String(error?.message || error),
                        grading_run_token: null,
                        grading_started_at: null,
                    })
                    .eq("id", session_id)
                    .eq("grading_run_token", runToken);
            } catch (_e) { /* best-effort */ }
        }
        const status = error?.message?.includes("No readable answers")
            ? 400
            : error?.message?.includes("already in progress")
                ? 409
                : 500;
        return new Response(JSON.stringify({ error: error?.message || String(error) }), {
            status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
