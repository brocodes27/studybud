import { supabase } from './supabase';

export interface ClassRiskQueueItem {
  id: string;
  studentUserId: string;
  studentName: string;
  triggerType: string;
  severity: string;
  interventionLevel: number;
  actionType: string;
  actionPayload: Record<string, any>;
  createdAt: string;
  backlogCount: number;
  missedDaysStreak: number;
}

export interface ClassExecutionMetrics {
  missionCompletionRate: number;
  completedTasks: number;
  totalTasks: number;
  backlogCount: number;
  unresolvedRiskCount: number;
  teacherActionsSaved: number;
  correctionSprintActiveCount: number;
  riskQueue: ClassRiskQueueItem[];
}

export async function fetchClassExecutionMetrics(classId: string): Promise<ClassExecutionMetrics> {
  const { data: members } = await supabase
    .from('class_members')
    .select('user_id, student_id')
    .eq('class_id', classId);

  const studentIds = (members || [])
    .map((member: any) => member.user_id || member.student_id)
    .filter(Boolean);

  if (studentIds.length === 0) {
    return {
      missionCompletionRate: 0,
      completedTasks: 0,
      totalTasks: 0,
      backlogCount: 0,
      unresolvedRiskCount: 0,
      teacherActionsSaved: 0,
      correctionSprintActiveCount: 0,
      riskQueue: [],
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const [profilesRes, prescriptionsRes, completionsRes, interventionsRes, sprintRes, userRes] = await Promise.all([
    supabase.from('student_behavioral_profiles').select('*').in('user_id', studentIds),
    supabase.from('daily_prescriptions').select('id, user_id, tasks').in('user_id', studentIds).eq('prescription_date', today),
    supabase.from('task_completions_v2').select('*').in('user_id', studentIds).eq('scheduled_date', today),
    supabase.from('interventions').select('*').eq('class_id', classId).eq('status', 'active').order('intervention_level', { ascending: false }),
    supabase.from('correction_sprints').select('id, user_id').in('user_id', studentIds).eq('status', 'active'),
    supabase.from('user_profiles').select('id, full_name, email').in('id', studentIds),
  ]);

  const prescriptions = prescriptionsRes.data || [];
  const completions = completionsRes.data || [];
  const profiles = profilesRes.data || [];
  const interventions = interventionsRes.data || [];
  const activeSprints = sprintRes.data || [];
  const userMap = new Map((userRes.data || []).map((user: any) => [user.id, user]));
  const profileMap = new Map(profiles.map((profile: any) => [profile.user_id, profile]));

  const totalTasks = prescriptions.reduce((sum: number, row: any) => {
    const tasks = Array.isArray(row.tasks) ? row.tasks : [];
    return sum + tasks.length;
  }, 0);

  const completedTasks = completions.length;
  const missionCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const backlogCount = profiles.reduce((sum: number, profile: any) => sum + Number(profile.backlog_count || 0), 0);

  const riskQueue: ClassRiskQueueItem[] = interventions.map((row: any) => {
    const profile = profileMap.get(row.student_user_id) || {};
    const user = userMap.get(row.student_user_id) || {};
    return {
      id: row.id,
      studentUserId: row.student_user_id,
      studentName: user.full_name || user.email || 'Student',
      triggerType: row.trigger_type,
      severity: row.severity,
      interventionLevel: row.intervention_level,
      actionType: row.action_type,
      actionPayload: row.action_payload || {},
      createdAt: row.created_at,
      backlogCount: Number(profile.backlog_count || 0),
      missedDaysStreak: Number(profile.missed_days_streak || 0),
    };
  });

  return {
    missionCompletionRate,
    completedTasks,
    totalTasks,
    backlogCount,
    unresolvedRiskCount: interventions.length,
    teacherActionsSaved: interventions.filter((row: any) => row.created_by_type === 'system').length,
    correctionSprintActiveCount: activeSprints.length,
    riskQueue,
  };
}
