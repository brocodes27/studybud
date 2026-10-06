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
}

export type WorkspaceArtifact =
  | { id: string; kind: 'material'; title: string; materialId: string; page?: number }
  | { id: string; kind: 'session'; title: string; sessionId: string }
  | { id: string; kind: 'explanation'; title: string; text: string; citations: Citation[] }
  | { id: string; kind: 'progress'; title: string };

export interface WorkspaceState {
  artifacts: WorkspaceArtifact[];
  activeId: string | null;
  plan: StudyPlan | null;
  checkpointId: string | null;
}

export interface WorkspaceThread {
  id: string;
  state: WorkspaceState;
  updated_at: string;
}

export interface WorkspaceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AgentAction {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  error?: string;
}

export interface WorkspaceSnapshot {
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
  'find_materials',
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
