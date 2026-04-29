import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCors } from '../_shared/cors.ts';

type RiskLevel = 'low' | 'medium' | 'high';

function chooseAction(profile: any, completions: any[], sprints: any[]) {
  const missedMissionDays = Number(profile?.missed_days_streak || 0);
  const backlogCount = Number(profile?.backlog_count || 0);
  const attendanceRiskLevel = (profile?.attendance_risk_level || 'low') as RiskLevel;
  const correctionSprintStalled = sprints.some((s: any) => {
    const tasks = Array.isArray(s.sprint_tasks) ? s.sprint_tasks : [];
    return tasks.length > 0 && tasks.every((t: any) => !t.completed);
  });

  const subjectsCompleted = new Set(completions.map((c: any) => c.subject).filter(Boolean));
  const weakSubjects = Array.isArray(profile?.weak_subjects) ? profile.weak_subjects : [];
  const avoidedSubjects = weakSubjects.filter((subject: string) => !subjectsCompleted.has(subject));

  if (attendanceRiskLevel === 'high' && missedMissionDays >= 3) {
    return {
      trigger_type: 'attendance_risk',
      trigger_source: 'student_behavioral_profiles',
      severity: 'critical',
      intervention_level: 4,
      action_type: 'teacher_review',
      action_payload: { message: 'High attendance risk and repeated missed missions need teacher review.' },
    };
  }

  if (correctionSprintStalled) {
    return {
      trigger_type: 'correction_sprint_stalled',
      trigger_source: 'correction_sprints',
      severity: 'high',
      intervention_level: 3,
      action_type: 'proof_required',
      action_payload: { proof_type: 'correction_sprint_work', message: 'Correction sprint has not started.' },
    };
  }

  if (avoidedSubjects.length > 0 && missedMissionDays >= 2) {
    return {
      trigger_type: 'subject_avoidance',
      trigger_source: 'task_completions_v2',
      severity: 'medium',
      intervention_level: 2,
      action_type: 'rescue_block',
      action_payload: { subject: avoidedSubjects[0], duration_min: 20, proof_required: true },
    };
  }

  if (backlogCount >= 5) {
    return {
      trigger_type: 'backlog_growth',
      trigger_source: 'student_behavioral_profiles',
      severity: backlogCount >= 10 ? 'high' : 'medium',
      intervention_level: 2,
      action_type: 'rescue_block',
      action_payload: { duration_min: 25, proof_required: true },
    };
  }

  if (missedMissionDays >= 1) {
    return {
      trigger_type: 'missed_mission',
      trigger_source: 'task_completions_v2',
      severity: 'low',
      intervention_level: 1,
      action_type: 'compress_plan',
      action_payload: { mode: 'low' },
    };
  }

  return null;
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
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { class_id } = await req.json().catch(() => ({}));
    if (!class_id) throw new Error('class_id required');

    const { data: classRow, error: classErr } = await sb
      .from('classes')
      .select('id')
      .eq('id', class_id)
      .single();
    if (classErr || !classRow) throw new Error('Class not found');

    const { data: members, error: memberErr } = await sb
      .from('class_members')
      .select('user_id, student_id')
      .eq('class_id', class_id);
    if (memberErr) throw memberErr;

    const studentIds = (members || [])
      .map((m: any) => m.user_id || m.student_id)
      .filter(Boolean);

    let created = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const studentId of studentIds) {
      await sb.rpc('refresh_behavioral_profile', { p_user_id: studentId });

      const [{ data: profile }, { data: roadmap }, { data: completions }, { data: sprints }] = await Promise.all([
        sb.from('student_behavioral_profiles').select('*').eq('user_id', studentId).maybeSingle(),
        sb.from('student_roadmaps').select('id').eq('user_id', studentId).eq('is_active', true).maybeSingle(),
        sb.from('task_completions_v2').select('*').eq('user_id', studentId).gte('scheduled_date', today),
        sb.from('correction_sprints').select('*').eq('user_id', studentId).eq('status', 'active'),
      ]);

      const action = chooseAction(profile, completions || [], sprints || []);
      if (!action) continue;

      const { error } = await sb.rpc('upsert_intervention', {
        p_student_user_id: studentId,
        p_class_id: class_id,
        p_roadmap_id: roadmap?.id || null,
        p_trigger_type: action.trigger_type,
        p_trigger_source: action.trigger_source,
        p_severity: action.severity,
        p_intervention_level: action.intervention_level,
        p_action_type: action.action_type,
        p_action_payload: action.action_payload,
        p_created_by_type: 'system',
      });
      if (!error) created += 1;
    }

    return new Response(JSON.stringify({ success: true, created }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
