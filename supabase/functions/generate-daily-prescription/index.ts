import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Inline Gemini helper (avoids relative import bundling issues) ──
interface GeminiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function callGeminiJSON<T = any>(
  messages: GeminiMessage[],
  opts: { model?: string; temperature?: number; apiKey?: string } = {},
): Promise<T> {
  const apiKey = opts.apiKey || Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const model = opts.model || "gemini-3-flash-preview";

  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  const systemInstruction = systemMessages.length
    ? { parts: systemMessages.map((m) => ({ text: m.content })) }
    : undefined;

  const contents = nonSystem.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = { contents };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  body.generationConfig = {
    temperature: opts.temperature ?? 0.7,
    responseMimeType: "application/json",
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error(`Gemini returned no text. Raw: ${JSON.stringify(data).slice(0, 500)}`);
  }

  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `Failed to parse Gemini JSON: ${err instanceof Error ? err.message : err}. Raw: ${cleaned.slice(0, 500)}`,
    );
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { roadmap_id, target_date } = await req.json()
    const prescriptionDate = target_date || new Date().toISOString().split('T')[0]

    // Gather Context
    // 1. Roadmap info
    const { data: roadmap, error: rError } = await supabaseClient
      .from('student_roadmaps')
      .select('*')
      .eq('id', roadmap_id)
      .single()
      
    if (rError || !roadmap) throw new Error("Roadmap not found")

    // 2. Today's classes
    const { data: sessions } = await supabaseClient
      .from('class_sessions')
      .select('subject, topics_covered, homework_assigned')
      .eq('roadmap_id', roadmap_id)
      .eq('session_date', prescriptionDate)

    // 3. Next test
    const { data: nextTests } = await supabaseClient
       .from('upcoming_tests')
       .select('*')
       .eq('roadmap_id', roadmap_id)
       .eq('status', 'upcoming')
       .gte('test_date', prescriptionDate)
       .order('test_date', { ascending: true })
       .limit(1)
       
    const nextTest = nextTests && nextTests.length > 0 ? nextTests[0] : null
    
    // 4. Behavioral Profile
    const { data: profile } = await supabaseClient
      .from('student_behavioral_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // 5. Weak areas (subject mastery)
    const { data: weakAreas } = await supabaseClient
      .from('user_subject_mastery')
      .select('domain, subdomain, mastery_score, questions_attempted, questions_correct')
      .eq('user_id', user.id)
      .order('mastery_score', { ascending: true })
      .limit(5)

    // 6. Recent mistakes from task outputs (last 14 days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentOutputs } = await supabaseClient
      .from('task_outputs')
      .select('output_type, text_content, ai_analysis, created_at')
      .eq('user_id', user.id)
      .gte('created_at', fourteenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(5)

    // Package context for AI Gen
    const contextSnapshot = {
      roadmap_week: roadmap.current_week,
      today_sessions: sessions || [],
      next_test: nextTest ? {
        name: nextTest.test_name,
        date: nextTest.test_date,
        duration: nextTest.duration_minutes,
        syllabus: nextTest.syllabus || null,
        days_until: Math.ceil((new Date(nextTest.test_date).getTime() - new Date(prescriptionDate).getTime()) / (1000 * 3600 * 24))
      } : null,
      behavioral_profile: profile || { preferred_time: 'evening', typical_session_duration_min: 90, weak_subjects: [] },
      weak_areas: (weakAreas || []).map((w: any) => ({
        domain: w.domain,
        subdomain: w.subdomain,
        mastery_score: w.mastery_score,
        accuracy: w.questions_attempted > 0 ? Math.round((w.questions_correct / w.questions_attempted) * 100) : 0,
      })),
      recent_mistake_patterns: (recentOutputs || []).map((o: any) => ({
        type: o.output_type,
        date: o.created_at,
        ai_feedback: o.ai_analysis?.summary || o.ai_analysis?.weak_spots || null,
      })).filter((o: any) => o.ai_feedback),
    }

    const systemPrompt = `You are Ranjan Sir, a perceptive JEE mentor who treats each student as an individual. You have real data about THIS student's actual weak areas, recent mistakes, and upcoming tests. Your job is to generate a nightly study plan that feels like it was written just for them — not a generic syllabus dump.

Here is the student's actual data:
${JSON.stringify(contextSnapshot, null, 2)}

## CRITICAL RULES — Follow exactly:

### Task Richness (non-negotiable)
Every task description MUST include ALL of the following:
1. **Personal hook**: Open by referencing the student's ACTUAL weak area or a recent mistake pattern. Example: "Last week your accuracy on Rotational Dynamics was 34% — today we fix the root cause." NEVER write generic intros like "Review & understand — Rotational Dynamics."
2. **Specific micro-challenge**: Instead of "do 5 problems", prescribe EXACT question numbers or problem sources when possible: "HC Verma Ex 5, Q3 → Q7 → Q12. Q3 is warm-up, Q7 tests the exact error pattern from your last mock, Q12 is JEE-level."
3. **Built-in checkpoint**: Include 1-2 self-check questions the student must answer before marking the task done. Example: "Before you finish: Can you derive the torque equation from first principles without looking at your notes?"
4. **Test mapping**: If a next_test exists, explicitly map each task to a specific chapter/skill the test will cover, with estimated marks weightage. Example: "This task covers 8-12 marks in your Phase Test on Mechanics."
5. **Coach's Note callout**: Add a warm, handwritten-style tip specific to this task and this student's state. Example: "Coach's Note: You tend to skip the 'draw FBD' step when rushed. Set a 2-minute timer just for the diagram before you start solving."

### Task Type Logic
- 
review_notes
: ONLY for brand-new topics or filling syllabus gaps. Must include the specific formulas/concepts to write down.
- 
guided_examples
: For weak areas (mastery_score < 0.6). Prescribe a sequence: solved example → 2 medium → 1 hard. Name the book/chapter.
- 
retrieval_check
: For strong areas being refreshed before a test. Must include specific closed-book prompts.
- 
timed_set
: For exam prep (test ≤ 7 days) or speed training on weak areas. Specify time per question and penalty for peeking.

### Energy & Timing
- If preferred_time is 'evening' and typical_session_duration_min < 60, front-load the hardest task.
- If missed_days_streak > 2 in the behavioral profile, make Task 1 a 10-minute confidence builder (something they can definitely finish).

### Implementation Intentions
Generate 3-4 binding intentions that reference the student's actual preferred_time and typical session length:
- One for START: "At [preferred_time], I will open [specific resource] to [specific first step]"
- One for STUCK: "If I feel like skipping the self-test / giving up / peeking at notes, then I will [specific fallback action]"
- One for FINISH: "After completing each task, I will [specific 5-min action]"

### Output Format — STRICT JSON ONLY
{
  "total_estimated_minutes": number,
  "tasks": [
    {
      "order": 1,
      "type": "guided_examples",
      "subject": "Physics",
      "topic": "Rotational Dynamics",
      "duration_min": 35,
      "details": "[Personal hook] + [Specific micro-challenge] + [Built-in checkpoint] + [Test mapping if applicable] + [Coach's Note]",
      "difficulty": "medium",
      "resources": ["HC Verma Ch 7", "Class notes Week 5"]
    }
  ],
  "implementation_intentions": [
    { "trigger": "At 7:00 PM after dinner", "action": "Open HC Verma to Ex 7, set 25-min timer before looking at Q1", "duration_min": 5 }
  ]
}`

    const prescriptionJSON = await callGeminiJSON<any>(
      [
        { role: "system", content: "You output JSON only." },
        { role: "user", content: systemPrompt }
      ],
      { temperature: 0.3 }
    )

    const { data: prescription, error: presErr } = await supabaseClient
      .from('daily_prescriptions')
      .upsert({
        user_id: user.id,
        roadmap_id,
        prescription_date: prescriptionDate,
        context_snapshot: contextSnapshot,
        tasks: prescriptionJSON.tasks,
        implementation_intentions: prescriptionJSON.implementation_intentions,
        total_estimated_minutes: prescriptionJSON.total_estimated_minutes,
        status: 'active'
      }, { onConflict: 'user_id,prescription_date' })
      .select()
      .single()

    if (presErr) throw presErr

    return new Response(JSON.stringify({ success: true, prescription }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
