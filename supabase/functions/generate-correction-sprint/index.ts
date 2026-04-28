import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'

// ── Deterministic Correction Sprint Engine ──
// Reads per-question telemetry from test_attempt_questions and generates
// a structured correction sprint WITHOUT LLM calls.

const ERROR_TASK_MAP: Record<string, { task_type: string; verb: string; strategy: string; duration: number }[]> = {
  concept: [
    { task_type: 'review_notes', verb: 'Rebuild the foundation', strategy: 'Re-derive every formula in this topic from first principles. Write them down WITHOUT looking at notes. If you miss one, re-read the derivation.', duration: 25 },
    { task_type: 'guided_examples', verb: 'Pattern-mastery drill', strategy: 'Pick 3 solved examples. Cover the solution, attempt yourself, reveal and compare. Name the exact pattern before each one.', duration: 35 },
  ],
  speed: [
    { task_type: 'timed_set', verb: 'Speed pressure test', strategy: 'Set a stopwatch. 90 seconds per problem. NO notes. Mark what you got wrong and classify: silly or concept.', duration: 20 },
    { task_type: 'timed_set', verb: 'Speed pressure test (round 2)', strategy: 'Same topic, same time limit. Goal: fewer silly mistakes than round 1. If you get 3+ silly, slow down by 20% tomorrow.', duration: 20 },
  ],
  careless: [
    { task_type: 'retrieval_check', verb: 'Closed-book precision test', strategy: 'ALL notes away. Write everything you know about this topic for 10 minutes. Then check: did you skip any step that cost you marks last time?', duration: 15 },
    { task_type: 'confidence_builder', verb: 'Accuracy drill', strategy: 'Re-solve 5 problems you got wrong before, but this time write EVERY intermediate step. No shortcuts.', duration: 25 },
  ],
  panic: [
    { task_type: 'confidence_builder', verb: 'Quick win streak', strategy: 'Pick 5 EASY problems in this topic. Solve all 5 in 20 minutes. Goal is not learning — it is proving you CAN do this.', duration: 20 },
    { task_type: 'review_notes', verb: 'Gentle review', strategy: 'Open notes to the chapter. Read for 10 minutes. Do NOT solve problems today. Just make the topic feel familiar again.', duration: 15 },
  ],
};

function buildSprintFromErrors(errors: any[], subjectHint: string = 'Mixed'): { sprint_name: string; estimated_days: number; sprint_tasks: any[] } {
  const grouped: Record<string, Record<string, number>> = {};
  errors.forEach((e: any) => {
    if (!e.error_type) return;
    const topic = e.topic_tag || 'General';
    if (!grouped[topic]) grouped[topic] = {};
    grouped[topic][e.error_type] = (grouped[topic][e.error_type] || 0) + 1;
  });

  const tasks: any[] = [];
  let order = 1;

  Object.entries(grouped).forEach(([topic, typeCounts]) => {
    // Sort error types by count descending
    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    // Pick the top error type for this topic
    const [primaryType] = sortedTypes[0];
    const templates = ERROR_TASK_MAP[primaryType] || ERROR_TASK_MAP['concept'];

    templates.forEach((tmpl) => {
      tasks.push({
        order: order++,
        task_type: tmpl.task_type,
        topic,
        description: `${tmpl.verb} — ${topic}\n\nStrategy: ${tmpl.strategy}\n\nCoach's Note: This task directly addresses your ${primaryType} errors on ${topic}.`,
        duration_min: tmpl.duration,
        subject: subjectHint,
        error_type_target: primaryType,
      });
    });
  });

  const days = Math.min(3, Math.ceil(tasks.length / 4));
  return {
    sprint_name: `Post-Test Correction Sprint — ${Object.keys(grouped).slice(0, 3).join(', ')}`,
    estimated_days: days,
    sprint_tasks: tasks,
  };
}

serve(async (req: Request) => {
  const cors = getCors(req)
  const corsHeaders = cors.headers
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

    const { target_test_result_id, roadmap_id, weak_topics } = await req.json();
    if (!target_test_result_id) throw new Error('target_test_result_id required');

    // 1. Fetch per-question telemetry
    const { data: attempts } = await sb
      .from('test_attempt_questions')
      .select('*')
      .eq('test_result_id', target_test_result_id)
      .eq('user_id', user.id);

    // 2. Build deterministic sprint
    let sprintPlan: any;
    if (attempts && attempts.length > 0) {
      sprintPlan = buildSprintFromErrors(attempts);
    } else {
      // Fallback: legacy weak_topics-based deterministic sprint
      const fallbackErrors = (weak_topics || []).map((w: any) => ({ error_type: 'concept', topic_tag: w.topic || w }));
      sprintPlan = buildSprintFromErrors(fallbackErrors);
    }

    // 3. Insert sprint
    const { data: sprint, error: insertErr } = await sb
      .from('correction_sprints')
      .insert({
        user_id: user.id,
        roadmap_id,
        test_result_id: target_test_result_id,
        sprint_name: sprintPlan.sprint_name,
        estimated_days: sprintPlan.estimated_days,
        sprint_tasks: sprintPlan.sprint_tasks,
        status: 'active'
      })
      .select()
      .single();

    if (insertErr && !insertErr.message.includes('relation "correction_sprints" does not exist')) {
      throw insertErr;
    }

    // 4. Create revision schedule rules for spaced repetition (Mistake Fixed tracking)
    const now = new Date();
    const revisionTasks = (attempts || [])
      .filter((a: any) => a.error_type && a.topic_tag)
      .map((a: any) => ({
        user_id: user.id,
        original_task_id: a.id,
        source_topic: a.topic_tag,
        subject: a.topic_tag.split(' ')[0] || 'General',
        revision_type: 'same_day',
        scheduled_date: now.toISOString().split('T')[0],
        status: 'pending' as const,
      }));

    if (revisionTasks.length > 0) {
      const { error: revErr } = await sb.from('revision_schedule_rules').insert(revisionTasks);
      if (revErr) console.warn('revision_schedule_rules insert failed:', revErr.message);
    }

    return new Response(JSON.stringify({ success: true, sprint: sprint || sprintPlan }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
});
