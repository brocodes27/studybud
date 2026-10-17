import type { InteractiveUI } from '../../../supabase/functions/_shared/interactive-ui';
import type { LearningMemory } from '../../../supabase/functions/_shared/learning-memory';
import type { AssessmentArtifact, ResearchArtifact, ResearchStatus } from '../../../supabase/functions/_shared/learning-workflows';
/**
 * Curve Agent Workspace Contracts
 * Matches backend supabase/functions/_shared/workspace-contracts.ts
 */

export interface StudyPlanStep {
  materialId: string;
  topic: string;
  minutes: number;
  kind: 'learn' | 'practice' | 'checkpoint';
}

export interface StudyPlan {
  minutes: number;
  steps: StudyPlanStep[];
}

export interface Citation {
  materialId: string;
  page: number;
  quote: string;
  source?: {title:string;url:string};
}

export type WorkspaceArtifact =
  | AssessmentArtifact
  | ResearchArtifact
  | { id: string; kind: 'material'; title: string; materialId: string; page?: number }
  | { id: string; kind: 'session'; title: string; sessionId: string }
  | { id: string; kind: 'explanation'; title: string; text: string; citations: Citation[]; ui?: InteractiveUI }
  | { id: string; kind: 'progress'; title: string };

export interface EnlistedExam {
  id: string;
  title: string;
  course: string;
  date: string;
  isRecent?: boolean;
  topics: string[];
}

export interface SemesterCourseInfo {
  course: string;
  taughtTopics: string[];
}

export interface BreakPreferences {
  restDaysPerWeek: number;
  preExamBufferHours: number;
  preferredRestDays?: string[];
}

export interface RoadmapDay {
  date: string;
  dayLabel: string;
  type: 'study' | 'rest' | 'buffer' | 'exam';
  title: string;
  course?: string;
  minutes?: number;
  topics?: string[];
}

export interface SemesterPlan {
  semester?: string;
  dailyMinutes?: number;
  stage: 'early' | 'mid' | 'late' | 'finals';
  stageLabel: string;
  courses: SemesterCourseInfo[];
  exams: EnlistedExam[];
  breaks: BreakPreferences;
  roadmap: RoadmapDay[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceState {
  learningMemory?: LearningMemory;
  artifacts: WorkspaceArtifact[];
  activeId: string | null;
  plan: StudyPlan | null;
  semesterPlan?: SemesterPlan | null;
  checkpointId: string | null;
  closedArtifactIds?: string[];
  reviewedArtifactIds?: string[];
}

export interface WorkspaceThread {
  id: string;
  state: WorkspaceState;
  updated_at: string;
}

export interface WorkspaceMessage {
  id: string;
  request_id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// A snapshot may predate a typed message or an in-flight voice transcript.
export function mergeWorkspaceMessages(current: WorkspaceMessage[], saved: WorkspaceMessage[]): WorkspaceMessage[] {
  const persisted = new Map(saved.map(message => [message.id, message]));
  const requests = new Set(saved.filter(message => message.request_id).map(message => `${message.request_id}:${message.role}`));
  return [...current.filter(message => !persisted.has(message.id) && !requests.has(`${message.request_id}:${message.role}`)), ...saved]
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export interface AgentAction {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

export interface WorkspaceSnapshot {
  research?: ResearchStatus;
  thread: WorkspaceThread;
  messages: WorkspaceMessage[];
}

export type WorkspaceEvent =
  | { type: 'text'; text: string }
  | { type: 'action'; action: AgentAction }
  | { type: 'state'; thread: WorkspaceThread }
  | { type: 'done'; snapshot: WorkspaceSnapshot; result?: unknown }
  | { type: 'error'; error: string };

export const emptyWorkspace = (): WorkspaceState => ({
  artifacts: [],
  activeId: null,
  plan: null,
  checkpointId: null,
});

export const TOOL_NAMES = [
  'open_assessment', 'open_exam_results', 'configure_assessment', 'begin_assessment', 'restart_assessment', 'complete_assessment', 'set_daily_research', 'review_artifact', 'close_artifact', 'cancel_checkpoint', 'find_materials',
  'open_material',
  'review_topics',
  'build_plan',
  'explain',
  'start_practice',
  'resume_session',
  'read_question',
  'select_answer',
  'hint',
  'submit_session',
  'show_progress',
] as const;

export type ToolName = typeof TOOL_NAMES[number];

export interface WorkspaceTool {
  name: ToolName;
  args: Record<string, unknown>;
}

export function putArtifact(
  state: WorkspaceState,
  artifact: WorkspaceArtifact
): WorkspaceState {
  return {
    ...state,
    artifacts: [...state.artifacts.filter((a) => a.id !== artifact.id), artifact],
    activeId: artifact.id,
  };
}

export function removeArtifact(
  state: WorkspaceState,
  artifactId: string
): WorkspaceState {
  const filtered = state.artifacts.filter((a) => a.id !== artifactId);
  const nextActive =
    state.activeId === artifactId
      ? filtered.length > 0
        ? filtered[filtered.length - 1].id
        : null
      : state.activeId;
  return {
    ...state,
    artifacts: filtered,
    activeId: nextActive,
  };
}
