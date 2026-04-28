// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCors } from "../_shared/cors.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
// CORS handled per-request via getCors()
// CBSE Exam Patterns (Section-wise distribution)
const CBSE_PATTERNS = {
  // ========== CLASS 10 (Secondary) - 80 marks ==========
  
  "10_Mathematics": {
    total_marks: 80,
    sections: [
      { name: "A", type: "mcq",   count: 20, marks_each: 1 },  // MCQs
      { name: "A", type: "mcq",   count: 2,  marks_each: 1 },  // Assertion-Reasoning
      { name: "B", type: "short", count: 5,  marks_each: 2 },  // VSA
      { name: "C", type: "short", count: 6,  marks_each: 3 },  // SA
      { name: "D", type: "long",  count: 4,  marks_each: 5 },  // LA
      { name: "E", type: "short", count: 3,  marks_each: 4 },  // Case-based
    ]
  },
  
  "10_Science": {
    total_marks: 80,
    sections: [
      { name: "A", type: "mcq",   count: 20, marks_each: 1 },  // Objective
      { name: "B", type: "short", count: 6,  marks_each: 2 },  // VSA
      { name: "C", type: "short", count: 7,  marks_each: 3 },  // SA
      { name: "D", type: "long",  count: 3,  marks_each: 5 },  // LA
      { name: "E", type: "short", count: 3,  marks_each: 4 },  // Case-based
    ]
  },
  
  "10_Social_Science": {
    total_marks: 80,
    sections: [
      { name: "A", type: "mcq",   count: 20, marks_each: 1 },  // MCQs
      { name: "B", type: "short", count: 4,  marks_each: 2 },  // VSA
      { name: "C", type: "short", count: 5,  marks_each: 3 },  // SA
      { name: "D", type: "long",  count: 4,  marks_each: 5 },  // LA
      { name: "E", type: "short", count: 3,  marks_each: 4 },  // Case-based
      { name: "F", type: "short", count: 1,  marks_each: 5 },  // Map-based
    ]
  },
  
  "10_English": {
    total_marks: 80,
    sections: [
      { name: "A", type: "mcq",   count: 20, marks_each: 1 },  // Reading MCQs
      { name: "B", type: "short", count: 5,  marks_each: 2 },  // Grammar
      { name: "C", type: "short", count: 5,  marks_each: 2 },  // Writing
      { name: "D", type: "mcq",   count: 10, marks_each: 1 },  // Literature extracts MCQs
      { name: "E", type: "short", count: 6,  marks_each: 3 },  // Literature SA
      { name: "F", type: "long",  count: 2,  marks_each: 6 },  // Literature LA
    ]
  },
  
  "10_Hindi": {
    total_marks: 80,
    sections: [
      { name: "A", type: "short", count: 7,  marks_each: 2 },  // Unseen comprehension
      { name: "B", type: "short", count: 8,  marks_each: 2 },  // Grammar
      { name: "C", type: "short", count: 10, marks_each: 3 },  // Textbooks
      { name: "D", type: "long",  count: 4,  marks_each: 5 },  // Creative Writing
    ]
  },
  
  // ========== CLASS 12 (Senior Secondary) ==========
  
  "12_Physics": {
    total_marks: 70,
    sections: [
      { name: "A", type: "mcq",   count: 18, marks_each: 1 },
      { name: "B", type: "short", count: 5,  marks_each: 2 },
      { name: "C", type: "short", count: 6,  marks_each: 3 },
      { name: "D", type: "long",  count: 3,  marks_each: 5 },
      { name: "E", type: "short", count: 3,  marks_each: 3 },  // Case-based/Competency
    ]
  },
  
  "12_Chemistry": {
    total_marks: 70,
    sections: [
      { name: "A", type: "mcq",   count: 18, marks_each: 1 },
      { name: "B", type: "short", count: 5,  marks_each: 2 },
      { name: "C", type: "short", count: 6,  marks_each: 3 },
      { name: "D", type: "long",  count: 3,  marks_each: 5 },
      { name: "E", type: "short", count: 3,  marks_each: 3 },  // Case-based/Competency
    ]
  },
  
  "12_Mathematics": {
    total_marks: 80,
    sections: [
      { name: "A", type: "mcq",   count: 20, marks_each: 1 },
      { name: "B", type: "short", count: 5,  marks_each: 2 },
      { name: "C", type: "short", count: 6,  marks_each: 3 },
      { name: "D", type: "long",  count: 4,  marks_each: 5 },
      { name: "E", type: "short", count: 3,  marks_each: 4 },  // Case-based
    ]
  },
  
  "12_Biology": {
    total_marks: 70,
    sections: [
      { name: "A", type: "mcq",   count: 16, marks_each: 1 },
      { name: "B", type: "short", count: 5,  marks_each: 2 },
      { name: "C", type: "short", count: 7,  marks_each: 3 },
      { name: "D", type: "long",  count: 3,  marks_each: 5 },
      { name: "E", type: "short", count: 3,  marks_each: 3 },  // Case-based
    ]
  },
  
  "12_Accountancy": {
    total_marks: 80,
    sections: [
      { name: "A", type: "mcq",   count: 16, marks_each: 1 },
      { name: "B", type: "short", count: 5,  marks_each: 2 },
      { name: "C", type: "short", count: 8,  marks_each: 3 },  // 6 numerical + 2 theoretical
      { name: "D", type: "long",  count: 4,  marks_each: 5 },  // 3 numerical + 1 theoretical
      { name: "E", type: "short", count: 2,  marks_each: 5 },  // Case-based numerical
    ]
  },
  
  "12_Business_Studies": {
    total_marks: 80,
    sections: [
      { name: "A", type: "mcq",   count: 20, marks_each: 1 },
      { name: "B", type: "short", count: 5,  marks_each: 2 },
      { name: "C", type: "short", count: 6,  marks_each: 3 },
      { name: "D", type: "long",  count: 4,  marks_each: 5 },
      { name: "E", type: "short", count: 3,  marks_each: 4 },  // Case-based
    ]
  },
  
  "12_Economics": {
    total_marks: 80,
    sections: [
      { name: "A", type: "mcq",   count: 20, marks_each: 1 },
      { name: "B", type: "short", count: 4,  marks_each: 2 },
      { name: "C", type: "short", count: 6,  marks_each: 3 },
      { name: "D", type: "long",  count: 4,  marks_each: 5 },
      { name: "E", type: "short", count: 3,  marks_each: 4 },  // Case/Source-based
    ]
  },
  
  "12_Computer_Science": {
    total_marks: 70,
    sections: [
      { name: "A", type: "mcq",   count: 18, marks_each: 1 },
      { name: "B", type: "short", count: 7,  marks_each: 2 },
      { name: "C", type: "short", count: 5,  marks_each: 3 },
      { name: "D", type: "long",  count: 3,  marks_each: 5 },
      { name: "E", type: "short", count: 2,  marks_each: 4 },  // Case-based (Python/SQL)
    ]
  },
  
  "12_Political_Science": {
    total_marks: 80,
    sections: [
      { name: "A", type: "mcq",   count: 20, marks_each: 1 },
      { name: "B", type: "short", count: 4,  marks_each: 2 },
      { name: "C", type: "short", count: 6,  marks_each: 3 },
      { name: "D", type: "long",  count: 4,  marks_each: 5 },
      { name: "E", type: "short", count: 3,  marks_each: 4 },  // Source-based
      { name: "F", type: "short", count: 1,  marks_each: 2 },  // Map question
    ]
  },
  
  "12_History": {
    total_marks: 80,
    sections: [
      { name: "A", type: "mcq",   count: 20, marks_each: 1 },
      { name: "B", type: "short", count: 4,  marks_each: 2 },
      { name: "C", type: "short", count: 6,  marks_each: 3 },
      { name: "D", type: "long",  count: 4,  marks_each: 5 },
      { name: "E", type: "short", count: 3,  marks_each: 4 },  // Source-based
      { name: "F", type: "short", count: 1,  marks_each: 2 },  // Map question
    ]
  },
  
  "12_Geography": {
    total_marks: 70,
    sections: [
      { name: "A", type: "mcq",   count: 18, marks_each: 1 },
      { name: "B", type: "short", count: 5,  marks_each: 2 },
      { name: "C", type: "short", count: 6,  marks_each: 3 },
      { name: "D", type: "long",  count: 3,  marks_each: 5 },
      { name: "E", type: "short", count: 2,  marks_each: 3 },  // Map-based
    ]
  },
  
  "12_Psychology": {
    total_marks: 70,
    sections: [
      { name: "A", type: "mcq",   count: 18, marks_each: 1 },
      { name: "B", type: "short", count: 6,  marks_each: 2 },
      { name: "C", type: "short", count: 5,  marks_each: 3 },
      { name: "D", type: "long",  count: 3,  marks_each: 5 },
      { name: "E", type: "short", count: 2,  marks_each: 4 },  // Case-based
    ]
  },
  
  "12_Sociology": {
    total_marks: 80,
    sections: [
      { name: "A", type: "mcq",   count: 20, marks_each: 1 },
      { name: "B", type: "short", count: 5,  marks_each: 2 },
      { name: "C", type: "short", count: 6,  marks_each: 3 },
      { name: "D", type: "long",  count: 4,  marks_each: 5 },
      { name: "E", type: "short", count: 3,  marks_each: 4 },  // Source-based
    ]
  },
  
  // Default pattern for unlisted subjects
  default: {
    total_marks: 80,
    sections: [
      { name: "A", type: "mcq",   count: 20, marks_each: 1 },
      { name: "B", type: "short", count: 6,  marks_each: 2 },
      { name: "C", type: "short", count: 6,  marks_each: 3 },
      { name: "D", type: "long",  count: 4,  marks_each: 5 },
      { name: "E", type: "short", count: 3,  marks_each: 4 },
    ]
  }
};
function getCBSEPattern(class_level, subject) {
  const key = `${class_level}_${subject.replace(/\s+/g, '_')}`;
  return CBSE_PATTERNS[key] || CBSE_PATTERNS["default"];
}
function computeTwoMonthCycle(date = new Date()) {
  const m = date.getUTCMonth();
  const y = date.getUTCFullYear();
  const startMonth = Math.floor(m / 2) * 2; // 0,2,4,6,8,10
  const start = new Date(Date.UTC(y, startMonth, 1));
  const end = new Date(Date.UTC(y, startMonth + 2, 0));
  return {
    cycle_start: start.toISOString().slice(0, 10),
    cycle_end: end.toISOString().slice(0, 10)
  };
}
async function fetchUserId(req) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: SUPABASE_SERVICE_ROLE_KEY
      }
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.id || null;
  } catch  {
    return null;
  }
}
function shuffleInPlace(arr) {
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [
      arr[j],
      arr[i]
    ];
  }
  return arr;
}
function sample(arr, k) {
  if (k <= 0) return [];
  if (arr.length <= k) return shuffleInPlace(arr.slice());
  const copy = arr.slice();
  const res = [];
  for(let i = 0; i < k; i++){
    const idx = Math.floor(Math.random() * copy.length);
    res.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return res;
}

async function ensurePoolExists(class_level: string, subject: string, cycle_start: string, cycle_end: string) {
  const { data: pools, error } = await supabase
    .from("question_pools")
    .select("id")
    .eq("class_level", class_level)
    .eq("subject", subject)
    .eq("cycle_start", cycle_start)
    .limit(1);
  if (error) throw new Error(error.message);
  if (pools && pools.length > 0) return pools[0].id;
  const { data: ins, error: insErr } = await supabase
    .from("question_pools")
    .insert({
      class_level,
      subject,
      status: "active",
      cycle_start,
      cycle_end
    })
    .select("id")
    .limit(1);
  if (insErr) throw new Error(insErr.message);
  return ins?.[0]?.id;
}

function coerceQType(qtype: string): string {
  const t = (qtype || "mcq").toLowerCase();
  if (t.includes("mcq") || t === "mcq") return "mcq";
  if (t.includes("short")) return "short";
  if (t.includes("long")) return "long";
  return "mcq";
}

function normalizeMcqOptions(options: any): string[] | null {
  if (!Array.isArray(options)) return null;
  const four = options.map(String).slice(0, 4);
  if (four.length !== 4) return null;
  return four;
}

function letterToIndex(letter: string): number | null {
  const m = String(letter || "").trim().toUpperCase();
  if (m === "A") return 0;
  if (m === "B") return 1;
  if (m === "C") return 2;
  if (m === "D") return 3;
  return null;
}

async function fetchSyllabus(class_level: string, subject: string): Promise<string> {
  const { data } = await supabase
    .from("cbse_syllabi")
    .select("syllabus_data")
    .eq("class_level", class_level)
    .eq("subject", subject)
    .limit(1)
    .maybeSingle();
  const sy = (data as any)?.syllabus_data;
  return sy ? JSON.stringify(sy).slice(0, 6000) : "";
}

async function fetchPyqs(class_level: string, subject: string, limit = 10): Promise<string> {
  const { data } = await supabase
    .from("pyq_bank")
    .select("year, chapter, question, qtype, marks")
    .eq("class_level", class_level)
    .eq("subject", subject)
    .order("year", { ascending: false })
    .limit(limit);
  return Array.isArray(data) ? JSON.stringify(data).slice(0, 6000) : "";
}

async function retrieveContexts(class_level: string, subject: string, qtype: string): Promise<string> {
  // Try optional RPC for pgvector semantic search; fallback to syllabus+PYQs
  try {
    const { data, error } = await supabase.rpc("match_kb_chunks", {
      p_class_level: class_level,
      p_subject: subject,
      p_query: `${class_level} ${subject} ${qtype}`,
      p_match_count: 8,
      p_threshold: 0.2
    });
    if (!error && Array.isArray(data) && data.length) {
      return JSON.stringify(data).slice(0, 6000);
    }
  } catch {}
  const [sy, pyq] = await Promise.all([
    fetchSyllabus(class_level, subject),
    fetchPyqs(class_level, subject, 12)
  ]);
  return `SYLLABUS:\n${sy}\nPYQS:\n${pyq}`.slice(0, 9000);
}

async function generateMissingQuestions({
  class_level,
  subject,
  qtype,
  count,
  contexts
}: { class_level: string; subject: string; qtype: string; count: number; contexts?: string }) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
  const constrained = coerceQType(qtype);
  const typeHint = constrained === "mcq"
    ? "type: \"mcq\", options: [A,B,C,D], correct_index: 0..3"
    : constrained === "short"
    ? "type: \"short\", answer_text: short factual answer"
    : "type: \"long\", answer_text: structured long answer";
  const grounding = contexts || (await retrieveContexts(class_level, subject, constrained));
  const prompt = `You are creating questions strictly aligned with the official CBSE syllabus and previous year papers for Class ${class_level} ${subject}.
Use ONLY the following grounding information. Do not invent off-syllabus content.
GROUNDING:\n${grounding}

Generate exactly ${count} CBSE syllabus-aligned questions.
Ensure each item strictly follows CBSE style and weightage relevance. Output strict JSON with shape:
{
  "questions": [
    {
      "qtype": "${constrained}",
      "question": string,
      ${constrained === "mcq" ? '"options": [string, string, string, string], "correct_index": 0|1|2|3,' : '"answer_text": string,'}
      "difficulty": "easy"|"medium"|"hard",
      "chapter": string
    }
  ]
}
For MCQ, provide exactly 4 options and a numeric correct_index. Use only CBSE syllabus content.`;
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY;
  const body = { contents: [{ parts: [{ text: prompt }] }] } as any;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error("Gemini API error: " + r.statusText);
  const j = await r.json();
  let text = j?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  text = String(text || "").trim().replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/i, "").trim();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) data = JSON.parse(m[0]);
  }
  const items = Array.isArray(data?.questions) ? data.questions : [];
  const out: any[] = [];
  for (const it of items) {
    const qt = coerceQType(it?.qtype);
    const questionText = String(it?.question || "").trim();
    if (!questionText) continue; // Skip if no question text
    
    if (qt === "mcq") {
      let opts = normalizeMcqOptions(it?.options);
      let ci = typeof it?.correct_index === "number" ? it.correct_index : letterToIndex(it?.correct_answer);
      
      // Be more lenient - if options are missing/invalid, try to create dummy options
      if (!opts || opts.length < 4) {
        console.warn(`MCQ missing valid options, creating defaults for: ${questionText.slice(0, 50)}`);
        opts = ["Option A", "Option B", "Option C", "Option D"];
        ci = 0; // default to first option
      }
      
      // Default correct_index to 0 if invalid
      if (ci == null || ci < 0 || ci > 3) {
        console.warn(`MCQ invalid correct_index, defaulting to 0 for: ${questionText.slice(0, 50)}`);
        ci = 0;
      }
      
      out.push({
        qtype: qt,
        question: questionText.slice(0, 5000),
        options: opts,
        correct_index: ci,
        answer_text: null,
        difficulty: (it?.difficulty || "").toLowerCase() || "medium",
        chapter: it?.chapter || null
      });
    } else {
      let ans = String(it?.answer_text || "").trim();
      // For short/long, if answer is missing, use a placeholder
      if (!ans) {
        console.warn(`Short/long question missing answer, using placeholder for: ${questionText.slice(0, 50)}`);
        ans = "Answer to be provided by teacher.";
      }
      out.push({
        qtype: qt,
        question: questionText.slice(0, 5000),
        options: null,
        correct_index: null,
        answer_text: ans.slice(0, 5000),
        difficulty: (it?.difficulty || "").toLowerCase() || "medium",
        chapter: it?.chapter || null
      });
    }
  }
  return out.slice(0, count);
}

async function insertGeneratedQuestions(pool_id: string, items: any[]) {
  if (!items?.length) return;
  const rows = items.map((q: any) => ({
    pool_id,
    question: q.question,
    options: q.options || null,
    correct_index: q.correct_index ?? null,
    answer_text: q.answer_text ?? null,
    qtype: q.qtype,
    difficulty: q.difficulty || null,
    chapter: q.chapter || null,
  }));
  const { error } = await supabase.from("question_bank").insert(rows);
  if (error) throw new Error(error.message);
}
serve(async (req)=>{
  const cors = getCors(req);
  const corsHeaders = cors.headers;
  let stage = "start";
  try {
    if (req.method === "OPTIONS") {
      const reqHeaders =
        req.headers.get("Access-Control-Request-Headers") ||
        "authorization, x-client-info, apikey, content-type";
      return new Response("ok", {
        headers: { ...corsHeaders, "Access-Control-Allow-Headers": reqHeaders },
      });
    }
    if (!cors.allowed) {
      return new Response(JSON.stringify({ error: "CORS origin not allowed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (req.method !== "POST") {
      return new Response(JSON.stringify({
        error: "Method not allowed"
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const userId = await fetchUserId(req);
    const payload = await req.json();
    const class_level = payload.class_level;
    const subject = payload.subject;
    const class_id = payload.class_id ?? null;
    const variants = Math.max(1, Math.min(20, Number(payload.variants ?? 4)));
    const questions_per_paper = Math.max(1, Math.min(200, Number(payload.questions_per_paper ?? 50)));
    const blueprint = payload.blueprint ?? null; // e.g., { easy: 20, medium: 20, hard: 10 }
    const cycle_start_param = payload.cycle_start; // optional
    if (!class_level || !subject) {
      return new Response(JSON.stringify({
        error: "class_level and subject are required",
        stage
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // Find an active pool for the 2-month cycle (or latest active)
    stage = "find_pool";
    let cycle = cycle_start_param ? {
      cycle_start: cycle_start_param
    } : computeTwoMonthCycle();
    let { data: pools, error: poolErr } = await supabase.from("question_pools").select("id,status,cycle_start,cycle_end").eq("class_level", class_level).eq("subject", subject).eq("cycle_start", cycle.cycle_start).limit(1);
    if (poolErr) {
      return new Response(JSON.stringify({
        error: poolErr.message,
        stage
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (!pools || pools.length === 0) {
      // fallback: latest active pool for this class/subject
      const { data: latest, error: latestErr } = await supabase.from("question_pools").select("id,status,cycle_start,cycle_end").eq("class_level", class_level).eq("subject", subject).order("cycle_start", {
        ascending: false
      }).limit(1);
      if (latestErr) {
        return new Response(JSON.stringify({
          error: latestErr.message,
          stage
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      pools = latest || [];
    }
    let pool = pools?.[0];
    if (!pool) {
      // Auto-create a pool for the active cycle and proceed
      const cycle = computeTwoMonthCycle();
      const newPoolId = await ensurePoolExists(class_level, subject, cycle.cycle_start, cycle.cycle_end);
      pools = [{ id: newPoolId, status: "active", cycle_start: cycle.cycle_start, cycle_end: cycle.cycle_end } as any];
      pool = pools[0] as any;
    }
    if (pool.status !== "active") {
      return new Response(JSON.stringify({
        error: `Pool is not active (status=${pool.status})`,
        stage
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const pool_id = pool.id;
    // Fetch candidate questions by difficulty buckets (with AI fallback if scarce)
    stage = "fetch_questions";
    const selectCols = "id,qid,question,options,correct_index,answer_text,explanation,qtype,difficulty,chapter";
    const buckets = {
      all: [],
      easy: [],
      medium: [],
      hard: []
    };
    // Fetch all up to 1000 (API max_rows)
    let { data: allQs, error: allErr } = await supabase.from("question_bank").select(selectCols).eq("pool_id", pool_id).limit(1000);
    if (allErr) {
      return new Response(JSON.stringify({
        error: allErr.message,
        stage
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    buckets.all = allQs || [];
    for (const q of buckets.all){
      const d = (q.difficulty || "").toLowerCase();
      if (d === "easy") buckets.easy.push(q);
      else if (d === "medium") buckets.medium.push(q);
      else if (d === "hard") buckets.hard.push(q);
    }
    if (!buckets.all.length) {
      // No questions at all: create pool rows with AI to bootstrap
      const pattern = getCBSEPattern(class_level, subject);
      const neededTotal = pattern.sections.reduce((s: number, sec: any) => s + Number(sec.count || 0), 0);
      const mcqNeed = pattern.sections.filter((s: any)=>s.type==='mcq').reduce((s: number, sec: any)=> s + Number(sec.count||0), 0);
      const shortNeed = pattern.sections.filter((s: any)=>s.type==='short').reduce((s: number, sec: any)=> s + Number(sec.count||0), 0);
      const longNeed = pattern.sections.filter((s: any)=>s.type==='long').reduce((s: number, sec: any)=> s + Number(sec.count||0), 0);
      console.log(`Bootstrap empty pool: mcq=${mcqNeed}, short=${shortNeed}, long=${longNeed}`);
      const generated = [];
      
      // Generate with retries in batches
      const batchSize = 10;
      const maxRetries = 3;
      
      for (const [qtype, needed] of [['mcq', mcqNeed], ['short', shortNeed], ['long', longNeed]] as [string, number][]) {
        if (needed <= 0) continue;
        let have = 0;
        let attempts = 0;
        
        while (have < needed && attempts < maxRetries) {
          const toGenerate = Math.min(batchSize, needed - have);
          try {
            console.log(`Generating ${toGenerate} ${qtype} questions (${have}/${needed} so far)`);
            const batch = await generateMissingQuestions({ class_level, subject, qtype, count: toGenerate });
            if (batch.length > 0) {
              generated.push(...batch);
              have += batch.length;
              console.log(`Got ${batch.length} ${qtype} questions, total: ${have}/${needed}`);
            } else {
              console.warn(`No ${qtype} questions returned in batch`);
              attempts++;
            }
            // Small delay between batches
            if (have < needed) await new Promise(r => setTimeout(r, 500));
          } catch (e: any) {
            console.error(`Failed to generate ${qtype} batch: ${e.message}`);
            attempts++;
            if (attempts < maxRetries) await new Promise(r => setTimeout(r, 1000));
          }
        }
        console.log(`Completed ${qtype}: generated ${have}/${needed}`);
      }
      
      if (generated.length === 0) {
        return new Response(JSON.stringify({ error: "Failed to generate any questions for empty pool", stage, mcqNeed, shortNeed, longNeed }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }
      await insertGeneratedQuestions(pool_id, generated);
      console.log(`Inserted ${generated.length} total generated questions into pool ${pool_id}`);
      // refetch
      const ref = await supabase.from("question_bank").select(selectCols).eq("pool_id", pool_id).limit(1000);
      allErr = ref.error as any;
      allQs = ref.data || [];
      buckets.all = allQs;
      for (const q of buckets.all){
        const d = (q.difficulty || "").toLowerCase();
        if (d === "easy") buckets.easy.push(q);
        else if (d === "medium") buckets.medium.push(q);
        else if (d === "hard") buckets.hard.push(q);
      }
      if (!buckets.all.length) {
        return new Response(JSON.stringify({ error: "Failed to bootstrap questions" , stage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }
    }
    const papersCreated = [];
    // Get CBSE pattern for this subject
    const pattern = getCBSEPattern(class_level, subject);
    for(let v = 1; v <= variants; v++){
      stage = `assemble_variant_${v}`;
      const picked = [];
      const sectionedQuestions = [];
      // Assemble questions section by section according to CBSE pattern
      for (const section of pattern.sections){
        const sectionQs = [];
        const needed = section.count;
        // Try to get questions matching the section type (mcq, short, long)
        let typeMatches = buckets.all.filter((q)=>{
          const qt = (q.qtype || "mcq").toLowerCase();
          return qt === section.type;
        });
        // If not enough of exact type, attempt AI fallback to generate missing for this type
        if (typeMatches.length < needed) {
          const deficit = needed - typeMatches.length;
          console.log(`Section ${section.name} (${section.type}): need ${needed}, have ${typeMatches.length}, generating ${deficit}`);
          
          // Generate with retries
          const batchSize = 10;
          const maxAttempts = 3;
          let totalGenerated = 0;
          
          for (let attempt = 0; attempt < maxAttempts && totalGenerated < deficit; attempt++) {
            try {
              const toGenerate = Math.min(batchSize, deficit - totalGenerated);
              const gen = await generateMissingQuestions({ class_level, subject, qtype: section.type, count: toGenerate });
              console.log(`Attempt ${attempt + 1}: Generated ${gen.length}/${toGenerate} for section ${section.name}`);
              
              if (gen.length > 0) {
                await insertGeneratedQuestions(pool_id, gen);
                totalGenerated += gen.length;
              }
              
              if (totalGenerated < deficit && attempt < maxAttempts - 1) {
                await new Promise(r => setTimeout(r, 500));
              }
            } catch (e: any) {
              console.error(`Section fallback attempt ${attempt + 1} failed: ${e.message}`);
              if (attempt < maxAttempts - 1) {
                await new Promise(r => setTimeout(r, 1000));
              }
            }
          }
          
          if (totalGenerated > 0) {
            // refetch all and reset buckets from the SAME pool_id
            const ref2 = await supabase.from("question_bank").select(selectCols).eq("pool_id", pool_id).limit(1000);
            if (ref2.error) throw new Error(ref2.error.message);
            allQs = ref2.data || [];
            buckets.all = allQs;
            buckets.easy = []; buckets.medium = []; buckets.hard = [];
            for (const q of buckets.all){
              const d = (q.difficulty || "").toLowerCase();
              if (d === "easy") buckets.easy.push(q);
              else if (d === "medium") buckets.medium.push(q);
              else if (d === "hard") buckets.hard.push(q);
            }
            typeMatches = buckets.all.filter((q)=> (q.qtype || '').toLowerCase() === section.type);
            console.log(`After generating ${totalGenerated}, have ${typeMatches.length} ${section.type} questions available`);
          }
        }
        // If still not enough of exact type, fall back to all questions
        const candidates = typeMatches.length >= needed ? typeMatches : buckets.all;
        // Sample with difficulty distribution if blueprint provided
        if (blueprint && (blueprint.easy || blueprint.medium || blueprint.hard)) {
          const easyCount = Math.round(needed * 0.3);
          const mediumCount = Math.round(needed * 0.5);
          const hardCount = needed - easyCount - mediumCount;
          const easyCandidates = candidates.filter((q)=>(q.difficulty || "").toLowerCase() === "easy");
          const mediumCandidates = candidates.filter((q)=>(q.difficulty || "").toLowerCase() === "medium");
          const hardCandidates = candidates.filter((q)=>(q.difficulty || "").toLowerCase() === "hard");
          sectionQs.push(...sample(easyCandidates, easyCount));
          sectionQs.push(...sample(mediumCandidates, mediumCount));
          sectionQs.push(...sample(hardCandidates, hardCount));
          // Fill remaining if not enough in difficulty buckets
          while(sectionQs.length < needed && candidates.length > 0){
            const remaining = sample(candidates.filter((q)=>!sectionQs.includes(q)), 1);
            if (remaining.length > 0) sectionQs.push(remaining[0]);
            else break;
          }
        } else {
          sectionQs.push(...sample(candidates, needed));
        }
        // Add section metadata to each question
        sectionQs.forEach((q)=>{
          q._section = section.name;
          q._marks = section.marks_each;
          sectionedQuestions.push(q);
        });
      }
      picked.push(...sectionedQuestions);
      const answer_key = picked.map((q, idx)=>({
          position: idx + 1,
          qid: q.qid,
          correct_index: q.correct_index ?? null,
          answer_text: q.answer_text ?? null
        }));
      const paper_json = {
        title: `Paper - ${subject} (Class ${class_level}) - Variant ${v}`,
        class_level,
        subject,
        variant: v,
        total_marks: pattern.total_marks,
        sections: pattern.sections,
        questions: picked.map((q)=>({
            qid: q.qid,
            text: q.question,
            options: q.options || null,
            qtype: q.qtype,
            difficulty: q.difficulty || null,
            chapter: q.chapter || null,
            section: q._section || "A",
            marks: q._marks || 1
          }))
      };
      // Insert paper
      const { data: paperRows, error: insPaperErr } = await supabase.from("papers").insert({
        pool_id,
        class_level,
        subject,
        class_id,
        variant: v,
        blueprint: blueprint || null,
        answer_key,
        paper_json,
        created_by: userId
      }, {
        count: "exact"
      }).select("id").limit(1);
      if (insPaperErr) {
        return new Response(JSON.stringify({
          error: insPaperErr.message,
          stage
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      const paper_id = paperRows?.[0]?.id;
      if (!paper_id) {
        return new Response(JSON.stringify({
          error: "Failed to insert paper",
          stage
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      // Insert mappings
      const mappings = picked.map((q, idx)=>({
          paper_id,
          question_id: q.id,
          position: idx + 1,
          section: q._section || "A",
          points: q._marks || 1
        }));
      const { error: mapErr } = await supabase.from("paper_questions").insert(mappings, {
        count: "exact"
      });
      if (mapErr) {
        return new Response(JSON.stringify({
          error: mapErr.message,
          stage
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      papersCreated.push({
        paper_id,
        variant: v,
        paper_json,
        answer_key
      });
    }
    return new Response(JSON.stringify({
      ok: true,
      pool_id,
      papers: papersCreated
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err: any) {
    console.error("Error in assemble-papers:", err);
    return new Response(JSON.stringify({
      error: err?.message || String(err),
      stage
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
