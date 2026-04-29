export type StudentCommandMode = 'comeback' | 'repair' | 'momentum' | 'steady';

export interface StudentCommandTask {
  title: string;
  completed?: boolean;
  proofRequired?: boolean;
  durationMin?: number;
  subject?: string;
}

export interface StudentCommandInput {
  streak: number;
  studentState: {
    backlogCount: number;
    missedDaysStreak: number;
    weakSubjects: string[];
  };
  todayTasks: StudentCommandTask[];
  recentSubmissions: any[];
}

export interface StudentQuest {
  label: 'Main Quest' | 'Side Quest' | 'Boss Fight';
  title: string;
  detail: string;
  proofRequired: boolean;
  completed: boolean;
}

export interface StudentCommandCenterModel {
  mode: StudentCommandMode;
  identityTitle: string;
  identityDetail: string;
  coachLine: string;
  rewardCue: string;
  progressPct: number;
  completedCount: number;
  totalCount: number;
  primaryQuest: StudentQuest;
  sideQuest?: StudentQuest;
  bossFight?: StudentQuest;
}

function getMode(input: StudentCommandInput): StudentCommandMode {
  if (input.studentState.missedDaysStreak >= 2) return 'comeback';
  if (input.studentState.backlogCount >= 4 || input.todayTasks.some((task) => task.proofRequired)) return 'repair';
  if (input.streak >= 3) return 'momentum';
  return 'steady';
}

function getQuest(label: StudentQuest['label'], task: StudentCommandTask | undefined, fallback: string): StudentQuest {
  return {
    label,
    title: task?.title || fallback,
    detail: task?.durationMin ? `${task.durationMin} min${task.subject ? ` | ${task.subject}` : ''}` : 'Small win first',
    proofRequired: Boolean(task?.proofRequired),
    completed: Boolean(task?.completed),
  };
}

export function buildStudentCommandCenter(input: StudentCommandInput): StudentCommandCenterModel {
  const mode = getMode(input);
  const completedCount = input.todayTasks.filter((task) => task.completed).length;
  const totalCount = input.todayTasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const firstPending = input.todayTasks.find((task) => !task.completed);
  const firstTask = input.todayTasks[0];
  const secondTask = input.todayTasks[1];
  const proofTask = input.todayTasks.find((task) => task.proofRequired && !task.completed);

  const weakSubject = input.studentState.weakSubjects[0];
  const identityTitle =
    mode === 'comeback' ? 'Comeback Arc' :
    mode === 'repair' ? `${weakSubject || 'Backlog'} Repair Arc` :
    input.streak >= 3 ? `${input.streak}-Day Momentum Arc` :
    'Today Arc';

  const identityDetail =
    mode === 'comeback' ? `${input.studentState.missedDaysStreak} missed days. Rebuild with the smallest clean proof.` :
    mode === 'repair' ? `${input.studentState.backlogCount} backlog items. Clear one visible repair before more theory.` :
    input.recentSubmissions.length > 0 ? `${input.recentSubmissions.length} recent proof${input.recentSubmissions.length === 1 ? '' : 's'} feeding your learner model.` :
    'Start with one clean mission and make today count.';

  const coachLine =
    mode === 'comeback' ? 'No guilt. Today is recovery mode: one clean win is enough to restart the chain.' :
    mode === 'repair' ? 'Repair mode is active. Finish the proof task first so the system can close a real weakness.' :
    mode === 'momentum' ? 'You have momentum. Protect it with one focused quest, then choose a side quest if energy is good.' :
    'Keep it simple: one mission, one proof, one visible improvement.';

  const rewardCue =
    proofTask ? 'Upload proof to unlock the repair reward and close the intervention.' :
    mode === 'momentum' ? 'Finish the main quest to protect your streak and unlock the side quest.' :
    'Complete the main quest to earn XP and update your learner model.';

  return {
    mode,
    identityTitle,
    identityDetail,
    coachLine,
    rewardCue,
    progressPct,
    completedCount,
    totalCount,
    primaryQuest: getQuest('Main Quest', firstPending || firstTask, 'Start today with a 15-minute mission'),
    sideQuest: secondTask ? getQuest('Side Quest', secondTask, 'Optional quick win') : undefined,
    bossFight: proofTask ? getQuest('Boss Fight', proofTask, 'Proof-required repair') : undefined,
  };
}
