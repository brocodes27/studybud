// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};
// CBSE pattern map (synced with assemble-papers)
const CBSE_PATTERNS: Record<string, { sections: { type: string; count: number; marks_each: number }[] }> = {
  // Class 10
  "10_Mathematics": { sections: [
    { type: "mcq", count: 20, marks_each: 1 }, { type: "mcq", count: 2, marks_each: 1 },
    { type: "short", count: 5, marks_each: 2 }, { type: "short", count: 6, marks_each: 3 },
    { type: "long", count: 4, marks_each: 5 }, { type: "short", count: 3, marks_each: 4 },
  ]},
  "10_Science": { sections: [
    { type: "mcq", count: 20, marks_each: 1 }, { type: "short", count: 6, marks_each: 2 },
    { type: "short", count: 7, marks_each: 3 }, { type: "long", count: 3, marks_each: 5 },
    { type: "short", count: 3, marks_each: 4 },
  ]},
  "10_Social_Science": { sections: [
    { type: "mcq", count: 20, marks_each: 1 }, { type: "short", count: 4, marks_each: 2 },
    { type: "short", count: 5, marks_each: 3 }, { type: "long", count: 4, marks_each: 5 },
    { type: "short", count: 3, marks_each: 4 }, { type: "short", count: 1, marks_each: 5 },
  ]},
  "10_English": { sections: [
    { type: "mcq", count: 20, marks_each: 1 }, { type: "short", count: 5, marks_each: 2 },
    { type: "short", count: 5, marks_each: 2 }, { type: "mcq", count: 10, marks_each: 1 },
    { type: "short", count: 6, marks_each: 3 }, { type: "long", count: 2, marks_each: 6 },
  ]},
  "10_Hindi": { sections: [
    { type: "short", count: 7, marks_each: 2 }, { type: "short", count: 8, marks_each: 2 },
    { type: "short", count: 10, marks_each: 3 }, { type: "long", count: 4, marks_each: 5 },
  ]},
  // Class 12
  "12_Physics": { sections: [
    { type: "mcq", count: 18, marks_each: 1 }, { type: "short", count: 5, marks_each: 2 },
    { type: "short", count: 6, marks_each: 3 }, { type: "long", count: 3, marks_each: 5 },
    { type: "short", count: 3, marks_each: 3 },
  ]},
  "12_Chemistry": { sections: [
    { type: "mcq", count: 18, marks_each: 1 }, { type: "short", count: 5, marks_each: 2 },
    { type: "short", count: 6, marks_each: 3 }, { type: "long", count: 3, marks_each: 5 },
    { type: "short", count: 3, marks_each: 3 },
  ]},
  "12_Mathematics": { sections: [
    { type: "mcq", count: 20, marks_each: 1 }, { type: "short", count: 5, marks_each: 2 },
    { type: "short", count: 6, marks_each: 3 }, { type: "long", count: 4, marks_each: 5 },
    { type: "short", count: 3, marks_each: 4 },
  ]},
  "12_Biology": { sections: [
    { type: "mcq", count: 16, marks_each: 1 }, { type: "short", count: 5, marks_each: 2 },
    { type: "short", count: 7, marks_each: 3 }, { type: "long", count: 3, marks_each: 5 },
    { type: "short", count: 3, marks_each: 3 },
  ]},
  "12_Accountancy": { sections: [
    { type: "mcq", count: 16, marks_each: 1 }, { type: "short", count: 5, marks_each: 2 },
    { type: "short", count: 8, marks_each: 3 }, { type: "long", count: 4, marks_each: 5 },
    { type: "short", count: 2, marks_each: 5 },
  ]},
  "12_Business_Studies": { sections: [
    { type: "mcq", count: 20, marks_each: 1 }, { type: "short", count: 5, marks_each: 2 },
    { type: "short", count: 6, marks_each: 3 }, { type: "long", count: 4, marks_each: 5 },
    { type: "short", count: 3, marks_each: 4 },
  ]},
  "12_Economics": { sections: [
    { type: "mcq", count: 20, marks_each: 1 }, { type: "short", count: 4, marks_each: 2 },
    { type: "short", count: 6, marks_each: 3 }, { type: "long", count: 4, marks_each: 5 },
    { type: "short", count: 3, marks_each: 4 },
  ]},
  "12_Computer_Science": { sections: [
    { type: "mcq", count: 18, marks_each: 1 }, { type: "short", count: 7, marks_each: 2 },
    { type: "short", count: 5, marks_each: 3 }, { type: "long", count: 3, marks_each: 5 },
    { type: "short", count: 2, marks_each: 4 },
  ]},
  "12_Political_Science": { sections: [
    { type: "mcq", count: 20, marks_each: 1 }, { type: "short", count: 4, marks_each: 2 },
    { type: "short", count: 6, marks_each: 3 }, { type: "long", count: 4, marks_each: 5 },
    { type: "short", count: 3, marks_each: 4 }, { type: "short", count: 1, marks_each: 2 },
  ]},
  "12_History": { sections: [
    { type: "mcq", count: 20, marks_each: 1 }, { type: "short", count: 4, marks_each: 2 },
    { type: "short", count: 6, marks_each: 3 }, { type: "long", count: 4, marks_each: 5 },
    { type: "short", count: 3, marks_each: 4 }, { type: "short", count: 1, marks_each: 2 },
  ]},
  "12_Geography": { sections: [
    { type: "mcq", count: 18, marks_each: 1 }, { type: "short", count: 5, marks_each: 2 },
    { type: "short", count: 6, marks_each: 3 }, { type: "long", count: 3, marks_each: 5 },
    { type: "short", count: 2, marks_each: 3 },
  ]},
  "12_Psychology": { sections: [
    { type: "mcq", count: 18, marks_each: 1 }, { type: "short", count: 6, marks_each: 2 },
    { type: "short", count: 5, marks_each: 3 }, { type: "long", count: 3, marks_each: 5 },
    { type: "short", count: 2, marks_each: 4 },
  ]},
  "12_Sociology": { sections: [
    { type: "mcq", count: 20, marks_each: 1 }, { type: "short", count: 5, marks_each: 2 },
    { type: "short", count: 6, marks_each: 3 }, { type: "long", count: 4, marks_each: 5 },
    { type: "short", count: 3, marks_each: 4 },
  ]},
  "default": { sections: [
    { type: "mcq", count: 20, marks_each: 1 }, { type: "short", count: 6, marks_each: 2 },
    { type: "short", count: 6, marks_each: 3 }, { type: "long", count: 4, marks_each: 5 },
    { type: "short", count: 3, marks_each: 4 },
  ]},
};
function getCBSEPattern(class_level: string, subject: string) {
  const key = `${class_level}_${String(subject).replace(/\s+/g, "_")}`;
  return CBSE_PATTERNS[key] || CBSE_PATTERNS.default;
}
function coerceQType(t: string): "mcq"|"short"|"long" {
  const s = (t||"mcq").toLowerCase();
  if (s.includes("mcq")) return "mcq";
  if (s.includes("short")) return "short";
  if (s.includes("long")) return "long";
  return "mcq";
}
function computeTwoMonthCycle(date = new Date()) {
  // Month in JS Date: 0..11
  const m = date.getUTCMonth();
  const y = date.getUTCFullYear();
  const startMonth = Math.floor(m / 2) * 2; // 0,2,4,6,8,10
  const start = new Date(Date.UTC(y, startMonth, 1));
  const end = new Date(Date.UTC(y, startMonth + 2, 0)); // last day of second month
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
async function generateWithGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ]
    })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Gemini response missing JSON");
  return JSON.parse(match[0]);
}
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
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
  let stage = "start";
  try {
    const userId = await fetchUserId(req);
    const payload = await req.json();
    const class_level = payload.class_level; // e.g. "10"
    const subject = payload.subject; // e.g. "math"
    const class_id = payload.class_id ?? null; // optional link to a class
    const target_count = Math.max(1, Math.min(500, Number(payload.target_count ?? 200)));
    const cycleFrom = payload.cycle_start;
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
    // Determine cycle
    stage = "compute_cycle";
    const { cycle_start, cycle_end } = cycleFrom ? {
      cycle_start: cycleFrom,
      cycle_end: payload.cycle_end
    } : computeTwoMonthCycle(new Date());
    // Upsert pool
    stage = "upsert_pool";
    const { data: poolRows, error: poolErr } = await supabase.from("question_pools").upsert({
      class_level,
      subject,
      class_id,
      cycle_start,
      cycle_end,
      status: "building",
      created_by: userId
    }, {
      onConflict: "class_level,subject,cycle_start"
    }).select("id,status,total_questions").limit(1);
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
    const pool = poolRows?.[0];
    if (!pool) {
      return new Response(JSON.stringify({
        error: "Failed to create/find pool",
        stage
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const pool_id = pool.id;
    // If caller provided explicit questions, use them (bypass AI)
    const explicitQs = payload.questions;
    let questions = [];
    if (Array.isArray(explicitQs) && explicitQs.length > 0) {
      stage = "use_explicit_questions";
      questions = explicitQs;
    } else {
      // Generate per-qtype quotas derived from CBSE pattern
      stage = "ai_generate_by_type";
      if (!GEMINI_API_KEY) {
        await supabase.from("question_pools").update({ status: "failed" }).eq("id", pool_id);
        return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured", stage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }
      const pattern = getCBSEPattern(class_level, subject);
      const totals = pattern.sections.reduce((acc: any, s)=>{ acc.total += s.count; acc[s.type]=(acc[s.type]||0)+s.count; return acc; }, { total:0 });
      const types: ("mcq"|"short"|"long")[] = ["mcq","short","long"];
      // desired counts per type proportional to pattern
      const desired: Record<string, number> = {} as any;
      for (const t of types) {
        const ratio = (totals[t]||0) / (totals.total||1);
        desired[t] = Math.max(0, Math.ceil(target_count * ratio));
      }
      // fetch existing counts for this pool per type
      const { data: existing, error: exErr } = await supabase
        .from("question_bank")
        .select("qtype, count:id", { count: "exact", head: false })
        .eq("pool_id", pool_id);
      if (exErr) {
        return new Response(JSON.stringify({ error: exErr.message, stage }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }
      const have: Record<string, number> = { mcq:0, short:0, long:0 };
      (existing||[]).forEach((row: any)=>{ const t = coerceQType(row.qtype); have[t] = (have[t]||0) + 1; });
      const batchSize = 10;
      for (const t of types) {
        while (have[t] < desired[t]) {
          const need = Math.min(batchSize, desired[t] - have[t]);
          const prompt = `Generate exactly ${need} CBSE syllabus-aligned ${t.toUpperCase()} questions for Class ${class_level} ${subject}.
Output strict JSON: { "questions": [ { "qtype": "${t}", "question": string, ${t==="mcq"? '"options": [string,string,string,string], "correct_index": 0|1|2|3,' : '"answer_text": string,'} "difficulty": "easy"|"medium"|"hard", "chapter": string } ] }`;
          const ai = await generateWithGemini(prompt);
          const batchQs = (Array.isArray(ai?.questions)? ai.questions: []).map((q:any)=>{
            const qt = coerceQType(q.qtype);
            const opts = Array.isArray(q.options)? q.options.map((s:string)=>String(s)) : null;
            const ci = typeof q.correct_index === "number" ? q.correct_index : null;
            return {
              pool_id,
              class_level,
              subject,
              chapter: q.chapter ?? null,
              difficulty: ["easy","medium","hard"].includes(String(q.difficulty||"").toLowerCase()) ? String(q.difficulty).toLowerCase() : null,
              qtype: qt,
              question: String(q.question||"").trim(),
              options: qt === "mcq" ? (opts && opts.length===4 ? opts : null) : null,
              correct_index: qt === "mcq" ? (ci!=null && ci>=0 && ci<=3 ? ci : null) : null,
              answer_text: qt !== "mcq" ? (q.answer_text ?? null) : null,
              explanation: q.explanation ?? null,
            };
          }).filter((r:any)=> r.question && (r.qtype!=='mcq' || (Array.isArray(r.options) && r.options.length===4 && r.correct_index!=null)) );
          if (batchQs.length) {
            const { error: insErr } = await supabase.from("question_bank").insert(batchQs);
            if (insErr) {
              await supabase.from("question_pools").update({ status: "failed" }).eq("id", pool_id);
              return new Response(JSON.stringify({ error: insErr.message, stage: "insert_by_type" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
            }
            have[t] += batchQs.length;
            await new Promise((r)=>setTimeout(r, 500));
          } else {
            break; // avoid infinite loop if model returns nothing valid
          }
        }
      }
      // Load questions variable for response stats
      const { data: finalQs } = await supabase.from("question_bank").select("id").eq("pool_id", pool_id);
      questions = (finalQs||[]);
    }
    // If we used per-type path, questions is already inserted; otherwise, insert the mixed path
    let inserted = 0;
    if (Array.isArray(questions) && questions.length && questions[0]?.id == null) {
      stage = "insert_questions";
      const batchSize2 = 200;
      for(let i = 0; i < questions.length; i += batchSize2){
        const chunk = questions.slice(i, i + batchSize2);
        const rows = chunk.map((q:any)=>({
            pool_id,
            class_level,
            subject,
            chapter: q.chapter ?? null,
            difficulty: q.difficulty && ["easy","medium","hard"].includes(q.difficulty) ? q.difficulty : null,
            qtype: q.qtype === "short" || q.qtype === "long" ? q.qtype : "mcq",
            question: String(q.question || "").trim(),
            options: Array.isArray(q.options) ? q.options.map((s:string)=>String(s)) : null,
            correct_index: typeof q.correct_index === "number" ? q.correct_index : null,
            answer_text: q.answer_text ?? null,
            explanation: q.explanation ?? null
          }));
        const { error: insErr, count } = await supabase.from("question_bank").insert(rows, { count: "exact" });
        if (insErr) {
          await supabase.from("question_pools").update({ status: "failed" }).eq("id", pool_id);
          return new Response(JSON.stringify({ error: insErr.message, stage, pool_id }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
        }
        inserted += count ?? rows.length;
      }
    } else {
      inserted = Array.isArray(questions) ? questions.length : 0;
    }
    // Update pool as active
    stage = "finalize_pool";
    await supabase.from("question_pools").update({
      status: "active",
      total_questions: inserted
    }).eq("id", pool_id);
    return new Response(JSON.stringify({
      ok: true,
      pool_id,
      total_questions: inserted,
      cycle_start,
      cycle_end
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message || String(err),
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
