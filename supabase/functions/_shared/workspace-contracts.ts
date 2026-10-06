/** Shared wire contracts. Artifact payloads contain references, never answer keys. */
export interface StudyPlan {
  minutes: number;
  steps: { materialId: string; topic: string; minutes: number; kind: 'learn' | 'practice' | 'checkpoint' }[];
}
export interface Citation { materialId: string; page: number; quote: string }
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
export interface WorkspaceThread { id: string; state: WorkspaceState; updated_at: string }
export interface WorkspaceMessage { id: string; role: 'user' | 'assistant'; content: string; created_at: string }
export interface AgentAction { id: string; name: string; status: 'running' | 'completed' | 'failed'; error?: string }
export interface WorkspaceSnapshot { thread: WorkspaceThread; messages: WorkspaceMessage[] }
export type WorkspaceEvent =
  | { type: 'text'; text: string }
  | { type: 'action'; action: AgentAction }
  | { type: 'state'; thread: WorkspaceThread }
  | { type: 'done'; snapshot: WorkspaceSnapshot; result?: unknown }
  | { type: 'error'; error: string };
export const emptyWorkspace = (): WorkspaceState => ({ artifacts: [], activeId: null, plan: null, checkpointId: null });
export const TOOL_NAMES = ['find_materials', 'open_material', 'review_topics', 'build_plan', 'explain', 'start_practice', 'resume_session', 'read_question', 'select_answer', 'hint', 'submit_session', 'show_progress'] as const;
export type ToolName = typeof TOOL_NAMES[number];
export interface WorkspaceTool { name: ToolName; args: Record<string, unknown> }
export const CHECKPOINT_TOOLS: readonly string[] = ['read_question', 'select_answer', 'submit_session', 'resume_session'];
export function assertTool(name: unknown, checkpoint: boolean): asserts name is ToolName {
  if (typeof name !== 'string' || !TOOL_NAMES.includes(name as ToolName)) throw new Error('Unsupported workspace action.');
  if (checkpoint && !CHECKPOINT_TOOLS.includes(name)) throw new Error('Finish your independent check before opening notes or getting help.');
}
export function boundedText(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Please provide a valid value.');
  return value.trim();
}
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid reference.');
  return value;
}
export function putArtifact(state: WorkspaceState, artifact: WorkspaceArtifact): WorkspaceState {
  return { ...state, artifacts: [...state.artifacts.filter(a => a.id !== artifact.id), artifact], activeId: artifact.id };
}
export function validatePlan(raw: unknown, materials: { id: string; metadata: { confirmed?: boolean; topics?: string[] } }[]): StudyPlan {
  const p = raw as StudyPlan;
  if (!p || !Number.isInteger(p.minutes) || p.minutes < 5 || p.minutes > 240 || !Array.isArray(p.steps) || !p.steps.length || p.steps.length > 12) throw new Error('Choose a study plan between 5 and 240 minutes.');
  for (const s of p.steps) {
    const m = materials.find(m => m.id === s.materialId);
    if (!m?.metadata.confirmed || !m.metadata.topics?.includes(s.topic) || !['learn', 'practice', 'checkpoint'].includes(s.kind) || !Number.isInteger(s.minutes) || s.minutes < 1) throw new Error('Plans must use confirmed topics from your library.');
  }
  if (p.steps.reduce((n, s) => n + s.minutes, 0) !== p.minutes) throw new Error('Plan durations must add up to the available time.');
  return { minutes: p.minutes, steps: p.steps.map(s => ({ materialId: s.materialId, topic: s.topic, minutes: s.minutes, kind: s.kind })) };
}
export function validateCitations(raw: unknown, materialId: string, pages: { page: number; text: string }[]): Citation[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > 8) throw new Error('Could not verify the explanation against your notes.');
  return raw.map(c => {
    const page = pages.find(p => p.page === c.page);
    if (!page || typeof c.quote !== 'string' || c.quote.length < 20 || !page.text.includes(c.quote)) throw new Error('Could not verify the explanation against your notes.');
    return { materialId, page: page.page, quote: c.quote };
  });
}
