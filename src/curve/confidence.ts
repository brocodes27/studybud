import type { ComponentKind } from './gradeEngine';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Fields confidence is tracked for. `components.N.weight/kind` covers per-row levels. */
export type ConfidenceField =
  | 'courseCode'
  | 'title'
  | 'components'
  | `components.${number}.weight`
  | `components.${number}.kind`
  | 'topics';

export interface FieldConfidence {
  field: ConfidenceField;
  level: ConfidenceLevel;
  reason: string;
}

export interface ConfidenceSummary {
  entries: FieldConfidence[];
  /** Fields the student should eyeball before saving. */
  reviewNeeded: FieldConfidence[];
  /** True when any blocking low-confidence field exists (e.g., no components). */
  hasLowConfidence: boolean;
}

const REVIEW_ORDER: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };

interface ParsedLike {
  courseCode?: string | null;
  title?: string | null;
  components?: Array<{ name?: string; kind?: ComponentKind; weight?: number | null }>;
  topics?: Array<{ topic?: string }>;
}

/**
 * Client-side heuristic fallback: flags fields that are structurally
 * suspicious regardless of what the model claimed. Pure function so every
 * surface (AddCourse, AhaForecastModal, landing demo) grades identically.
 */
export function deriveFieldConfidence(parsed: ParsedLike): FieldConfidence[] {
  const out: FieldConfidence[] = [];

  const code = String(parsed.courseCode ?? '').trim();
  if (!code || code === 'COURSE 101') {
    out.push({ field: 'courseCode', level: 'low', reason: 'No course code detected in the document.' });
  } else if (!/[A-Za-z]{2,}/.test(code) || !/\d/.test(code)) {
    out.push({ field: 'courseCode', level: 'medium', reason: 'Unusual course-code format — worth a check.' });
  }

  const title = String(parsed.title ?? '').trim();
  if (!title || title === 'Untitled course') {
    out.push({ field: 'title', level: 'low', reason: 'No course title detected.' });
  } else if (title.length < 6) {
    out.push({ field: 'title', level: 'medium', reason: 'Title looks truncated.' });
  }

  const components = Array.isArray(parsed.components) ? parsed.components : [];
  if (components.length === 0) {
    out.push({ field: 'components', level: 'low', reason: 'No grading breakdown found in the document.' });
  } else {
    const totalWeight = components.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
    if (Math.abs(totalWeight - 100) > 15) {
      out.push({
        field: 'components',
        level: 'low',
        reason: `Weights sum to ${Math.round(totalWeight)}% — a section of the grading scheme was likely missed.`,
      });
    } else if (Math.abs(totalWeight - 100) > 2) {
      out.push({
        field: 'components',
        level: 'medium',
        reason: `Weights sum to ${Math.round(totalWeight)}%, not 100%.`,
      });
    }
    components.forEach((component, index) => {
      const weight = Number(component?.weight);
      if (!Number.isFinite(weight) || weight <= 0) {
        out.push({
          field: `components.${index}.weight`,
          level: 'low',
          reason: `"${component?.name ?? `Component ${index + 1}`}" has no usable weight.`,
        });
      }
    });
  }

  const topics = Array.isArray(parsed.topics) ? parsed.topics : [];
  if (topics.length === 0) {
    out.push({ field: 'topics', level: 'low', reason: 'No weekly topics extracted.' });
  } else if (topics.length < 4) {
    out.push({ field: 'topics', level: 'medium', reason: 'Only a few weeks of topics found — the schedule may be incomplete.' });
  }

  return out;
}

/**
 * Merge model-reported confidence with client heuristics. Worst level wins;
 * reasons are concatenated so the student sees *why* either side flagged it.
 */
export function summarizeConfidence(
  parsed: ParsedLike,
  modelReported?: FieldConfidence[] | null,
): ConfidenceSummary {
  const heuristic = deriveFieldConfidence(parsed);
  const merged = new Map<ConfidenceField, FieldConfidence>();

  for (const entry of [...(modelReported ?? []), ...heuristic]) {
    const existing = merged.get(entry.field);
    if (!existing) {
      merged.set(entry.field, { ...entry });
    } else {
      const worst = REVIEW_ORDER[entry.level] < REVIEW_ORDER[existing.level] ? entry : existing;
      const reasons = Array.from(new Set([existing.reason, entry.reason].filter(Boolean)));
      merged.set(entry.field, { field: entry.field, level: worst.level, reason: reasons.join(' ') });
    }
  }

  // Fields with no flags are implicitly high-confidence.
  const entries = Array.from(merged.values()).sort(
    (a, b) => REVIEW_ORDER[a.level] - REVIEW_ORDER[b.level],
  );
  const reviewNeeded = entries.filter((e) => e.level !== 'high');
  return {
    entries,
    reviewNeeded,
    hasLowConfidence: entries.some((e) => e.level === 'low'),
  };
}

/** Merge summaries across a multi-course parse (e.g., before bulk save). */
export function summarizeMany(
  items: Array<{ parsed: ParsedLike; modelReported?: FieldConfidence[] | null }>,
): { perCourse: ConfidenceSummary[]; blockers: Array<FieldConfidence & { courseIndex: number }> } {
  const perCourse = items.map((item) => summarizeConfidence(item.parsed, item.modelReported));
  const blockers = perCourse.flatMap((summary, courseIndex) =>
    summary.reviewNeeded.map((entry) => ({ ...entry, courseIndex })),
  );
  return { perCourse, blockers };
}
