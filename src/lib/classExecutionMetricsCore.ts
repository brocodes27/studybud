export interface ClassRiskQueueItem {
  id: string;
  studentUserId: string;
  studentName: string;
  triggerType: string;
  severity: string;
  interventionLevel: number;
  actionType: string;
  actionPayload: Record<string, any>;
  recommendedAction: string;
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
  resolvedInterventionCount: number;
  totalInterventionCount: number;
  interventionResolutionRate: number;
  highRiskCount: number;
  teacherActionsSaved: number;
  correctionSprintActiveCount: number;
  riskQueue: ClassRiskQueueItem[];
}

export interface MetricsInput {
  prescriptions: any[];
  completions: any[];
  profiles: any[];
  interventions: any[];
  activeSprints: any[];
  users: any[];
}

export const EMPTY_METRICS: ClassExecutionMetrics = {
  missionCompletionRate: 0,
  completedTasks: 0,
  totalTasks: 0,
  backlogCount: 0,
  unresolvedRiskCount: 0,
  resolvedInterventionCount: 0,
  totalInterventionCount: 0,
  interventionResolutionRate: 0,
  highRiskCount: 0,
  teacherActionsSaved: 0,
  correctionSprintActiveCount: 0,
  riskQueue: [],
};

function getRecommendedAction(row: any): string {
  const payload = row?.action_payload || {};
  if (payload.message) return payload.message;
  if (row?.action_type === 'proof_required') return 'Ask for proof before counting the repair complete.';
  if (row?.action_type === 'rescue_block') return 'Assign a focused rescue block and require output.';
  if (row?.action_type === 'teacher_review') return 'Review the student today before assigning more work.';
  if (row?.action_type === 'compress_plan') return 'Switch today to a lighter completion path.';
  return 'Review and choose the next teacher action.';
}

export function buildClassExecutionMetrics(input: MetricsInput): ClassExecutionMetrics {
  const userMap = new Map((input.users || []).map((user: any) => [user.id, user]));
  const profileMap = new Map((input.profiles || []).map((profile: any) => [profile.user_id, profile]));
  const interventions = input.interventions || [];
  const activeInterventions = interventions.filter((row: any) => row.status === 'active');
  const resolvedInterventions = interventions.filter((row: any) => row.status === 'resolved');

  const totalTasks = (input.prescriptions || []).reduce((sum: number, row: any) => {
    const tasks = Array.isArray(row.tasks) ? row.tasks : [];
    return sum + tasks.length;
  }, 0);

  const completedTasks = (input.completions || []).length;
  const missionCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const backlogCount = (input.profiles || []).reduce((sum: number, profile: any) => sum + Number(profile.backlog_count || 0), 0);

  const riskQueue: ClassRiskQueueItem[] = activeInterventions
    .sort((a: any, b: any) => {
      const levelDelta = Number(b.intervention_level || 0) - Number(a.intervention_level || 0);
      if (levelDelta !== 0) return levelDelta;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    })
    .map((row: any) => {
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
        recommendedAction: getRecommendedAction(row),
        createdAt: row.created_at,
        backlogCount: Number(profile.backlog_count || 0),
        missedDaysStreak: Number(profile.missed_days_streak || 0),
      };
    });

  const totalInterventionCount = interventions.length;
  const interventionResolutionRate = totalInterventionCount > 0
    ? Math.round((resolvedInterventions.length / totalInterventionCount) * 100)
    : 0;

  return {
    missionCompletionRate,
    completedTasks,
    totalTasks,
    backlogCount,
    unresolvedRiskCount: activeInterventions.length,
    resolvedInterventionCount: resolvedInterventions.length,
    totalInterventionCount,
    interventionResolutionRate,
    highRiskCount: activeInterventions.filter((row: any) => row.severity === 'critical' || row.severity === 'high').length,
    teacherActionsSaved: interventions.filter((row: any) => row.created_by_type === 'system').length,
    correctionSprintActiveCount: (input.activeSprints || []).length,
    riskQueue,
  };
}
