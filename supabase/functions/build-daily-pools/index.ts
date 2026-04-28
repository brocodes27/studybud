// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getCors } from "../_shared/cors.ts";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
function computeDailyCycle(yyyymmdd) {
  const now = yyyymmdd ? new Date(Date.UTC(Number(yyyymmdd.slice(0, 4)), Number(yyyymmdd.slice(5, 7)) - 1, Number(yyyymmdd.slice(8, 10)))) : new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const start = new Date(Date.UTC(y, m, d));
  const end = new Date(Date.UTC(y, m, d));
  return {
    cycle_start: start.toISOString().slice(0, 10),
    cycle_end: end.toISOString().slice(0, 10)
  };
}
// Known subjects (fallback if classes table is not available)
const FALLBACK = {
  "10": [
    "Mathematics",
    "Science",
    "English",
    "Social Science",
    "Hindi",
    "Sanskrit",
    "Information Technology",
    "Home Science",
    "Computer Applications"
  ],
  "12:Science": [
    "Physics",
    "Chemistry",
    "Mathematics",
    "Biology",
    "English",
    "Computer Science",
    "Physical Education",
    "Informatics Practices"
  ],
  "12:Commerce": [
    "Accountancy",
    "Business Studies",
    "Economics",
    "Mathematics",
    "English",
    "Informatics Practices",
    "Physical Education"
  ],
  "12:Humanities": [
    "History",
    "Geography",
    "Political Science",
    "Economics",
    "Psychology",
    "Sociology",
    "English",
    "Mathematics",
    "Physical Education"
  ]
};
async function getDistinctCombos() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/classes?select=class_level,subject`;
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_ROLE || "",
        Authorization: `Bearer ${SERVICE_ROLE || ""}`
      }
    });
    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json();
    const set = new Set();
    const combos = [];
    for (const r of rows){
      const cl = (r.class_level || "").toString().trim();
      const subj = (r.subject || "").toString().trim();
      if (!cl || !subj) continue;
      const key = `${cl}::${subj.toLowerCase()}`;
      if (!set.has(key)) {
        set.add(key);
        combos.push({
          class_level: cl,
          subject: subj
        });
      }
    }
    if (combos.length) return combos;
  } catch (_) {
  // ignore and use fallback
  }
  // Fallback default combos for 10 and 12 (all streams)
  const fb = [];
  for (const s of FALLBACK["10"])fb.push({
    class_level: "10",
    subject: s
  });
  for (const s of [
    ...FALLBACK["12:Science"],
    ...FALLBACK["12:Commerce"],
    ...FALLBACK["12:Humanities"]
  ])fb.push({
    class_level: "12",
    subject: s
  });
  return fb;
}
serve(async (req)=>{
  const cors = getCors(req);
  const corsHeaders = cors.headers;
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: "CORS origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (req.method !== "POST") return new Response(JSON.stringify({
    error: "Method not allowed"
  }), {
    status: 405,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
  let stage = "start";
  try {
    const body = await req.json().catch(()=>({}));
    const date = body.date; // optional YYYY-MM-DD
    const target_count = Math.max(1, Math.min(500, Number(body.target_count ?? 30)));
    const dry_run = !!body.dry_run;
    const combosOverride = Array.isArray(body.combos) ? body.combos : undefined;
    stage = "compute_cycle";
    const { cycle_start, cycle_end } = computeDailyCycle(date);
    if (!SUPABASE_URL) {
      return new Response(JSON.stringify({
        error: "SUPABASE_URL not configured",
        stage
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    stage = "load_combos";
    const combos = combosOverride && combosOverride.length ? combosOverride : await getDistinctCombos();
    const results = [];
    stage = "iterate";
    for (const { class_level, subject } of combos){
      const payload = {
        class_level,
        subject,
        target_count,
        cycle_start,
        cycle_end
      };
      if (dry_run) {
        results.push({
          class_level,
          subject,
          skipped: true
        });
        continue;
      }
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/build-question-pool`, {
          method: "POST",
          // include service role Bearer in case verify_jwt is enabled
          headers: {
            "Content-Type": "application/json",
            Authorization: SERVICE_ROLE ? `Bearer ${SERVICE_ROLE}` : undefined
          },
          body: JSON.stringify(payload)
        });
        const text = await res.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch  {
          json = {
            raw: text
          };
        }
        if (!res.ok) {
          results.push({
            class_level,
            subject,
            ok: false,
            error: json?.error || text
          });
        } else {
          results.push({
            class_level,
            subject,
            ok: true,
            pool_id: json?.pool_id,
            total_questions: json?.total_questions
          });
        }
      } catch (err) {
        results.push({
          class_level,
          subject,
          ok: false,
          error: err?.message || String(err)
        });
      }
    }
    const okCount = results.filter((r)=>r.ok).length;
    const failCount = results.filter((r)=>r.ok === false).length;
    const skipped = results.filter((r)=>r.skipped).length;
    return new Response(JSON.stringify({
      ok: true,
      cycle_start,
      cycle_end,
      total: results.length,
      okCount,
      failCount,
      skipped,
      results
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
