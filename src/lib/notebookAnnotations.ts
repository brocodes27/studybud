export const NOTEBOOK_ANNOTATION_KINDS = [
  'underline',
  'circle',
  'comment',
  'score',
  'tick',
  'strike',
] as const;

export const NOTEBOOK_ANNOTATION_TONES = ['correct', 'incorrect', 'guidance'] as const;
export const NOTEBOOK_ANNOTATION_STATUSES = ['suggested', 'approved'] as const;

export type NotebookAnnotationKind = (typeof NOTEBOOK_ANNOTATION_KINDS)[number];
export type NotebookAnnotationTone = (typeof NOTEBOOK_ANNOTATION_TONES)[number];
export type NotebookAnnotationStatus = (typeof NOTEBOOK_ANNOTATION_STATUSES)[number];
export type NotebookAnnotationReviewStatus = 'pending' | 'review' | 'approved';

export interface NotebookAnnotation {
  id: string;
  kind: NotebookAnnotationKind;
  tone: NotebookAnnotationTone;
  status: NotebookAnnotationStatus;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  confidence: number;
  question_number?: number;
}

const kindSet = new Set<string>(NOTEBOOK_ANNOTATION_KINDS);
const toneSet = new Set<string>(NOTEBOOK_ANNOTATION_TONES);
const statusSet = new Set<string>(NOTEBOOK_ANNOTATION_STATUSES);

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanText(value: unknown) {
  return String(value ?? '').trim().slice(0, 500);
}

export function normalizeNotebookAnnotation(
  value: unknown,
  fallbackId: string,
): NotebookAnnotation | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const kind = String(candidate.kind || '');
  if (!kindSet.has(kind)) return null;

  const x = clamp(finiteNumber(candidate.x, 0));
  const y = clamp(finiteNumber(candidate.y, 0));
  const width = clamp(finiteNumber(candidate.width, kind === 'tick' ? 0.05 : 0.2), 0.015, 1);
  const height = clamp(finiteNumber(candidate.height, kind === 'underline' ? 0.03 : 0.08), 0.015, 1);
  const safeWidth = Math.min(width, 1 - x);
  const safeHeight = Math.min(height, 1 - y);
  if (safeWidth < 0.015 || safeHeight < 0.015) return null;

  const rawTone = String(candidate.tone || '');
  const rawStatus = String(candidate.status || '');
  const questionNumber = finiteNumber(candidate.question_number, 0);

  return {
    id: cleanText(candidate.id) || fallbackId,
    kind: kind as NotebookAnnotationKind,
    tone: toneSet.has(rawTone) ? rawTone as NotebookAnnotationTone : 'guidance',
    status: statusSet.has(rawStatus) ? rawStatus as NotebookAnnotationStatus : 'suggested',
    x,
    y,
    width: safeWidth,
    height: safeHeight,
    text: cleanText(candidate.text),
    confidence: clamp(finiteNumber(candidate.confidence, 0)),
    ...(questionNumber > 0 ? { question_number: Math.round(questionNumber) } : {}),
  };
}

export function normalizeNotebookAnnotations(value: unknown): NotebookAnnotation[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();

  return value.slice(0, 80).flatMap((item, index) => {
    const annotation = normalizeNotebookAnnotation(item, `annotation-${index + 1}`);
    if (!annotation) return [];
    let id = annotation.id;
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${annotation.id}-${suffix}`;
      suffix += 1;
    }
    seenIds.add(id);
    return [{ ...annotation, id }];
  });
}

export function moveNotebookAnnotation(
  annotation: NotebookAnnotation,
  deltaX: number,
  deltaY: number,
): NotebookAnnotation {
  return {
    ...annotation,
    x: clamp(annotation.x + deltaX, 0, 1 - annotation.width),
    y: clamp(annotation.y + deltaY, 0, 1 - annotation.height),
  };
}

export function annotationNeedsAttention(annotation: NotebookAnnotation) {
  return annotation.status !== 'approved' || annotation.confidence < 0.75;
}

export function deriveAnnotationReviewStatus(
  annotations: NotebookAnnotation[],
): NotebookAnnotationReviewStatus {
  if (annotations.length === 0) return 'review';
  return annotations.every((annotation) => annotation.status === 'approved')
    ? 'approved'
    : 'review';
}
