export type RiskLevel = 'low' | 'medium' | 'high';

export type TriggerType =
  | 'missed_mission'
  | 'subject_avoidance'
  | 'shrinking_sessions'
  | 'backlog_growth'
  | 'test_avoidance'
  | 'correction_sprint_stalled'
  | 'attendance_risk'
  | 'proof_pending';

export type ActionType =
  | 'compress_plan'
  | 'rescue_block'
  | 'proof_required'
  | 'correction_sprint_priority'
  | 'teacher_review'
  | 'parent_summary';

export interface InterventionSignalInput {
  studentUserId: string;
  classId?: string | null;
  roadmapId?: string | null;
  missedMissionDays: number;
  backlogCount: number;
  previousBacklogCount: number;
  avoidedSubjects: string[];
  shrinkingSession: boolean;
  correctionSprintStalled: boolean;
  attendanceRiskLevel: RiskLevel;
  unresolvedLevel3Count: number;
}

export interface InterventionRecommendation {
  studentUserId: string;
  classId: string | null;
  roadmapId: string | null;
  triggerType: TriggerType;
  triggerSource: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  interventionLevel: 1 | 2 | 3 | 4;
  actionType: ActionType;
  actionPayload: Record<string, unknown>;
}

export function chooseIntervention(input: InterventionSignalInput): InterventionRecommendation | null {
  const base = {
    studentUserId: input.studentUserId,
    classId: input.classId ?? null,
    roadmapId: input.roadmapId ?? null,
  };

  if (input.attendanceRiskLevel === 'high' && input.unresolvedLevel3Count >= 2) {
    return {
      ...base,
      triggerType: 'attendance_risk',
      triggerSource: 'student_behavioral_profiles.attendance_risk_level',
      severity: 'critical',
      interventionLevel: 4,
      actionType: 'teacher_review',
      actionPayload: {
        message: 'Repeated execution risk and attendance risk require human review.',
      },
    };
  }

  if (input.correctionSprintStalled) {
    return {
      ...base,
      triggerType: 'correction_sprint_stalled',
      triggerSource: 'correction_sprints.status',
      severity: 'high',
      interventionLevel: 3,
      actionType: 'proof_required',
      actionPayload: {
        proof_type: 'correction_sprint_work',
        message: 'Upload correction work or complete a Prove-It attempt before marking this repaired.',
      },
    };
  }

  if (input.avoidedSubjects.length > 0 && input.missedMissionDays >= 2) {
    return {
      ...base,
      triggerType: 'subject_avoidance',
      triggerSource: 'task_completions_v2.subject',
      severity: 'medium',
      interventionLevel: 2,
      actionType: 'rescue_block',
      actionPayload: {
        subject: input.avoidedSubjects[0],
        duration_min: 20,
        proof_required: true,
        message: `Do a 20-minute rescue block for ${input.avoidedSubjects[0]}.`,
      },
    };
  }

  if (input.backlogCount >= input.previousBacklogCount + 3 && input.backlogCount > 0) {
    return {
      ...base,
      triggerType: 'backlog_growth',
      triggerSource: 'student_behavioral_profiles.backlog_count',
      severity: input.backlogCount >= 10 ? 'high' : 'medium',
      interventionLevel: 2,
      actionType: 'rescue_block',
      actionPayload: {
        duration_min: 25,
        proof_required: true,
        message: 'Clear the oldest pending task first. Stop after one clean proof submission.',
      },
    };
  }

  if (input.shrinkingSession) {
    return {
      ...base,
      triggerType: 'shrinking_sessions',
      triggerSource: 'session_signals.elapsed_sec',
      severity: 'low',
      interventionLevel: 1,
      actionType: 'compress_plan',
      actionPayload: {
        mode: 'low',
        message: 'Tomorrow starts with the minimum required mission to rebuild momentum.',
      },
    };
  }

  if (input.missedMissionDays >= 1) {
    return {
      ...base,
      triggerType: 'missed_mission',
      triggerSource: 'task_completions_v2.scheduled_date',
      severity: 'low',
      interventionLevel: 1,
      actionType: 'compress_plan',
      actionPayload: {
        mode: 'low',
        message: 'You missed yesterday, so today is compressed to the minimum required mission.',
      },
    };
  }

  return null;
}
