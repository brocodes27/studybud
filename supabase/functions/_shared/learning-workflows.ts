/** Public, answer-key-free contracts shared by the workspace and its forms. */
export const MAX_ASSESSMENT_TOPICS = 15;
export interface TopicMetadata { confirmed?: boolean; confirmed_topics?: string[]; topics?: string[] }
export function topicConfirmed(metadata: TopicMetadata, topic: string) {
  return !!metadata.topics?.includes(topic) && (metadata.confirmed === true || !!metadata.confirmed_topics?.includes(topic));
}
export function assessmentTargets(input: unknown, library: { id: string; metadata: TopicMetadata }[], requireConfirmed = true): TopicTarget[] {
  if (!Array.isArray(input) || !input.length || input.length > MAX_ASSESSMENT_TOPICS) throw new Error(`Choose one to ${MAX_ASSESSMENT_TOPICS} topics to assess.`);
  const targets = input.map(t => {
    const m = library.find(m => m.id === t?.materialId);
    if (!m || !m.metadata.topics?.includes(t?.topic) || (requireConfirmed && !topicConfirmed(m.metadata, t.topic))) throw new Error('Choose confirmed topics from your library.');
    return { materialId: m.id, topic: t.topic as string };
  });
  if (new Set(targets.map(t => `${t.materialId}:${t.topic}`)).size !== targets.length) throw new Error('Choose each topic once.');
  return targets;
}

/** A saved scope makes a short confirmation actionable without another model decision. */
export function assessmentConfirmation(text: string, artifacts: AssessmentArtifact[], activeId: string | null) {
  if (!/^(?:yes(?:\s+(?:please|pls))?|yep|yeah|sure|ok(?:ay)?|confirm(?:ed)?|start(?:\s+(?:it|the assessment))?|go ahead|let['’]s start)[.!]?$/i.test(text.trim())) return null;
  const pending = artifacts.filter(a => a.status === 'setup');
  const artifact = pending.find(a => a.id === activeId) || (pending.length === 1 ? pending[0] : undefined);
  if (!artifact?.targets.length || artifact.mode === 'results') return null;
  return { name: 'begin_assessment' as const, args: { artifactId: artifact.id, confirmTopics: true } };
}
export function nextExamDate(localDate: unknown) {
  if (typeof localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|\s)/.test(localDate)) return '';
  const day = localDate.slice(0,10);
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0,10) !== day) return '';
  date.setUTCDate(date.getUTCDate()+1);
  return date.toISOString().slice(0,10);
}
export interface TopicTarget { materialId: string; topic: string }
export interface RecoveryStep extends TopicTarget {
  minutes: number;
  accuracy: number;
  gaps: string[];
  instruction: string;
  baseInstruction?: string;
}
export interface AssessmentArtifact {
  id: string;
  kind: 'assessment';
  title: string;
  goal: string;
  mode: 'study' | 'exam' | 'results';
  status: 'setup' | 'assessing' | 'ready';
  targets: TopicTarget[];
  sessionIds: string[];
  runId?: string;
  minutes?: number;
  confidence?: string;
  examDate?: string;
  report?: string;
  score?: number;
  total?: number;
  steps?: RecoveryStep[];
  issues?: { issue: string; evidence: string; action: string }[];
}
export interface ResearchArtifact {
  id: string;
  kind: 'research';
  title: string;
  topic: string;
  materialId: string;
  text: string;
  sources: { title: string; url: string }[];
  createdAt: string;
}
export interface ResearchStatus {
  enabled: boolean;
  status: 'pending' | 'running' | 'ready' | 'failed';
  error?: string;
  completedAt?: string;
}
export const RESULT_SOURCE_QUESTION = 'Do you mean a practice or knowledge check here, or an exam you took at school or college?';
export const RESULT_SOURCE_GUIDE = `All curve_material_sessions are in-app learning activities, never external exams. Practice, diagnostics, gap checks and mock tests here must not be counted as exams the student has taken. An assessment with mode exam is preparation for an upcoming exam; completing its diagnostic does not mean the real exam happened. Mode results is an external exam review draft, not evidence the student took an exam or supplied marks. Only a student-supplied external exam report/marks are external exam evidence. Prioritize the active activity and its linked assessment; never treat an unrelated setup draft as the current session. For in-app results use saved sessions and continue the linked revision plan. Never open_exam_results or start another assessment to review in-app results. If the source of results is unclear, ask whether they mean an in-app check or an external exam before opening intake.`;

export function resultSource(text: string): 'workspace' | 'external' | 'ambiguous' | null {
  if (!/\b(results?|marks?|scores?|scored|performance|got \d+|\d+\s*\/\s*\d+)\b/i.test(text)) return null;
  if (/\bperformance\b/i.test(text) && !/\b(results?|marks?|scores?|test|exam|practice|diagnostic|assessment|check|mock)\b/i.test(text)) return null;
  const workspace = /\b(practice|diagnostic|assessment|independent check|gap check|knowledge check|workspace|in.app|here|mock)\b/i.test(text);
  const external = /\b(school|college|university|teacher|professor|external|outside|official|real exam|actual exam|board exam|semester exam|midterm|endterm)\b/i.test(text);
  if (external) return 'external';
  if (workspace) return 'workspace';
  if (/\b(tomorrow|upcoming|prepare|target|aim)\b/i.test(text) && !/\b(results?|marks?|scored|got|last|previous|earned)\b/i.test(text)) return null;
  if (/\bexam\b/i.test(text)) return 'external';
  return 'ambiguous';
}
export function studyIntent(text: string): 'exam' | 'results' | 'study' | null {
  const source = resultSource(text);
  if (source === 'external') return 'results';
  if (source) return null;
  if (/\b(exam|test)\b/i.test(text) && /\b(tomorrow|next day|tonight|24 hours?)\b/i.test(text)) return 'exam';
  if (/\b(i (?:want|need|would like) to (?:study|learn|revise)|i (?:have|have got) (?:a |some )?doubts?|help me (?:study|learn|understand)|teach me)\b/i.test(text)) return 'study';
  return null;
}
export function assessmentLabel(artifact: AssessmentArtifact): string {
  return artifact.mode === 'exam' ? 'Exam preparation' : artifact.mode === 'results' ? 'External exam review' : 'Knowledge check';
}
export function assessmentForSession(assessments: AssessmentArtifact[], session: {id:string;material_id:string;topic:string}): AssessmentArtifact | undefined {
  return assessments.find(a => a.sessionIds.includes(session.id)) || assessments.find(a => a.status === 'ready' && a.steps?.some(step => step.materialId === session.material_id && step.topic === session.topic));
}
export function safeSourceUrl(value: unknown): string | null {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}

export function assessmentInput(input: Record<string, unknown>, library: { id: string; metadata: TopicMetadata }[]) {
  const minutes = Number(input.minutes);
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 240) throw new Error('Choose between 15 and 240 minutes.');
  const targets = assessmentTargets(input.targets, library);
  if (minutes < targets.length * 5) throw new Error('Allow at least five minutes per topic.');
  const confidence = String(input.confidence || 'unsure');
  if (!['new', 'unsure', 'confident'].includes(confidence)) throw new Error('Choose your confidence level.');
  const examDate = typeof input.examDate === 'string' ? input.examDate : '';
  if (examDate && (!/^\d{4}-\d{2}-\d{2}$/.test(examDate) || Number.isNaN(Date.parse(examDate)) || new Date(examDate).toISOString().slice(0, 10) !== examDate)) throw new Error('Choose a valid exam date.');
  const report = typeof input.report === 'string' ? input.report.trim() : '';
  if (report.length > 12000) throw new Error('Use up to 12,000 characters of exam feedback.');
  let score: number | undefined, total: number | undefined;
  if (input.score !== undefined && input.score !== '') {
    score = Number(input.score); total = Number(input.total);
    if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0 || total > 10000 || score < 0 || score > total) throw new Error('Enter valid marks earned and total marks.');
  }
  return { targets, minutes, confidence, examDate, report, score, total };
}

/** Allocate finite time from measured knowledge, not self-reported confidence. */
export function recoverySteps(targets: TopicTarget[], sessions: { results: {correct: boolean; explanation: string; assisted?: boolean}[] | null }[], minutes: number): RecoveryStep[] {
  const steps = targets.map((t, i) => {
    const results = sessions[i]?.results?.filter(r => !r.assisted) || [];
    if (!results.length) throw new Error('Complete each independent assessment before building your plan.');
    const accuracy = Math.round(100 * results.filter(r => r.correct).length / results.length);
    return { ...t, accuracy, minutes: 0, gaps: results.filter(r => !r.correct).map(r => r.explanation), instruction: accuracy >= 80 ? 'Keep this fresh with a short retrieval check.' : accuracy >= 40 ? 'Review the missed concepts, then practise without hints.' : 'Rebuild the foundations from your notes, then check your understanding.' };
  }).sort((a, b) => a.accuracy - b.accuracy);
  const weights = steps.map(s => Math.max(20, 100 - s.accuracy));
  const sum = weights.reduce((a, b) => a + b, 0);
  let remaining = minutes - steps.length * 2;
  const extra = remaining;
  steps.forEach((s, i) => { const n = i === steps.length - 1 ? remaining : Math.floor(extra * weights[i] / sum); s.minutes = 2 + n; remaining -= n; });
  return steps;
}
