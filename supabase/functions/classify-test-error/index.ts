import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'

// ── Deterministic Error Classification Engine ──
// Classifies per-question errors without LLM calls.
//
// Rules (applied in priority order):
// 1. panic      — was_skipped = true AND marks_obtained = 0
// 2. careless   — was_answer_changed = true AND marks_obtained < marks_total (any partial)
// 3. speed      — marks_obtained = 0 AND time_spent_sec < expected_time * 0.25
// 4. concept    — marks_obtained = 0 AND time_spent_sec >= expected_time * 0.25
//
// If marks_obtained == marks_total (fully correct), error_type = null.

interface Attempt {
  question_number: number;
  time_spent_sec: number;
  was_skipped: boolean;
  was_answer_changed: boolean;
  marks_obtained: number;
  marks_total: number;
  topic_tag?: string;
}

function classifySingle(a: Attempt, expectedTimeSec: number = 120): { error_type: string | null; confidence: number; rule_triggered: string } {
  if (a.marks_obtained === a.marks_total) {
    return { error_type: null, confidence: 1.0, rule_triggered: 'correct' };
  }

  const ratio = a.marks_total > 0 ? a.marks_obtained / a.marks_total : 0;
  const speedThreshold = expectedTimeSec * 0.25;

  // Priority 1: Panic (skipped entirely)
  if (a.was_skipped && a.marks_obtained === 0) {
    return { error_type: 'panic', confidence: 0.9, rule_triggered: 'skipped_zero_marks' };
  }

  // Priority 2: Careless (answer changed, lost marks)
  if (a.was_answer_changed && a.marks_obtained < a.marks_total) {
    return { error_type: 'careless', confidence: 0.85, rule_triggered: 'answer_changed_partial_marks' };
  }

  // Priority 3: Speed (zero marks, too fast)
  if (a.marks_obtained === 0 && a.time_spent_sec < speedThreshold) {
    return { error_type: 'speed', confidence: 0.8, rule_triggered: 'zero_marks_too_fast' };
  }

  // Priority 4: Concept (zero marks, spent reasonable time)
  if (a.marks_obtained === 0) {
    return { error_type: 'concept', confidence: 0.75, rule_triggered: 'zero_marks_reasonable_time' };
  }

  // Fallback for partial marks without clear signal
  if (ratio > 0 && ratio < 1) {
    return { error_type: 'concept', confidence: 0.6, rule_triggered: 'partial_marks_fallback' };
  }

  return { error_type: null, confidence: 1.0, rule_triggered: 'default_correct' };
}

serve(async (req: Request) => {
  const cors = getCors(req);
  const corsHeaders = cors.headers;
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')??'', Deno.env.get('SUPABASE_ANON_KEY')??'', { global: { headers: { Authorization: req.headers.get('Authorization')! } } });
    const token = req.headers.get('Authorization')!.replace('Bearer ','');
    const { data:{user}, error: authErr } = await sb.auth.getUser(token);
    if (authErr||!user) return new Response(JSON.stringify({error:'Unauthorized'}), {status:401, headers:corsHeaders});

    const { test_result_id, attempts, expected_time_sec = 120 } = await req.json();
    if (!test_result_id || !Array.isArray(attempts)) throw new Error('test_result_id and attempts[] required');

    // 1. Fetch existing test_result to link back
    const { data: testResult } = await sb.from('test_results').select('id, user_id').eq('id', test_result_id).single();
    if (!testResult) throw new Error('Test result not found');

    // 2. Classify each attempt and build insert rows
    const classified = attempts.map((a: Attempt) => {
      const c = classifySingle(a, expected_time_sec);
      return {
        test_result_id,
        user_id: user.id,
        question_number: a.question_number,
        time_spent_sec: a.time_spent_sec || 0,
        was_skipped: a.was_skipped || false,
        was_answer_changed: a.was_answer_changed || false,
        error_type: c.error_type,
        topic_tag: a.topic_tag || null,
        marks_obtained: a.marks_obtained || 0,
        marks_total: a.marks_total || 0,
      };
    });

    // 3. Bulk insert into test_attempt_questions
    const { data: inserted, error: insertErr } = await sb.from('test_attempt_questions').insert(classified).select();
    if (insertErr) throw insertErr;

    // 4. Compute aggregate error_type counts per topic for quick weak_topics extraction
    const topicCounts: Record<string, { concept: number; speed: number; careless: number; panic: number; total: number }> = {};
    classified.forEach((c: any) => {
      if (!c.topic_tag || !c.error_type) return;
      if (!topicCounts[c.topic_tag]) topicCounts[c.topic_tag] = { concept: 0, speed: 0, careless: 0, panic: 0, total: 0 };
      topicCounts[c.topic_tag][c.error_type as keyof typeof topicCounts[string]]++;
      topicCounts[c.topic_tag].total++;
    });

    const weakTopics = Object.entries(topicCounts)
      .filter(([_, v]) => v.total > 0)
      .map(([topic, v]) => ({
        topic,
        concept_errors: v.concept,
        speed_errors: v.speed,
        careless_errors: v.careless,
        panic_errors: v.panic,
        total_errors: v.total,
        severity: v.concept >= 2 ? 'high' : v.total >= 3 ? 'medium' : 'low'
      }))
      .sort((a, b) => b.total_errors - a.total_errors);

    return new Response(JSON.stringify({ success: true, classified: inserted, weak_topics: weakTopics }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('classify-test-error error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
});
