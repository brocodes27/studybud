import { supabase } from './supabase';
export {
  buildClassExecutionMetrics,
  EMPTY_METRICS,
  type ClassExecutionMetrics,
  type ClassRiskQueueItem,
} from './classExecutionMetricsCore';
import { buildClassExecutionMetrics, EMPTY_METRICS, type ClassExecutionMetrics } from './classExecutionMetricsCore';

export async function fetchClassExecutionMetrics(classId: string): Promise<ClassExecutionMetrics> {
  const { data: members } = await supabase
    .from('class_members')
    .select('user_id, student_id')
    .eq('class_id', classId);

  const studentIds = (members || [])
    .map((member: any) => member.user_id || member.student_id)
    .filter(Boolean);

  if (studentIds.length === 0) {
    return EMPTY_METRICS;
  }

  const today = new Date().toISOString().split('T')[0];
  const [profilesRes, prescriptionsRes, completionsRes, interventionsRes, sprintRes, userRes] = await Promise.all([
    supabase.from('student_behavioral_profiles').select('*').in('user_id', studentIds),
    supabase.from('daily_prescriptions').select('id, user_id, tasks').in('user_id', studentIds).eq('prescription_date', today),
    supabase.from('task_completions_v2').select('*').in('user_id', studentIds).eq('scheduled_date', today),
    supabase.from('interventions').select('*').eq('class_id', classId).order('intervention_level', { ascending: false }),
    supabase.from('correction_sprints').select('id, user_id').in('user_id', studentIds).eq('status', 'active'),
    supabase.from('user_profiles').select('id, full_name, email').in('id', studentIds),
  ]);

  return buildClassExecutionMetrics({
    prescriptions: prescriptionsRes.data || [],
    completions: completionsRes.data || [],
    profiles: profilesRes.data || [],
    interventions: interventionsRes.data || [],
    activeSprints: sprintRes.data || [],
    users: userRes.data || [],
  });
}
