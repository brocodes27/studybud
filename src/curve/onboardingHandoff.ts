/* P1.2 — carry the landing page's pre-auth syllabus parse through sign-in
 * into AddCourse/ enrollment. sessionStorage (survives OAuth full redirects,
 * auto-clears when tab closes). Pure functions exported for testability. */
import type { ParsedSyllabus, ParsedMultiSubjectSyllabus } from './ai';
import type { NewCourseInput } from './data';

const HANDOFF_KEY = 'curve.pending-onboarding-parse.v1';
const MAX_AGE_MS = 30 * 60 * 1000;

export interface PendingHandoff {
  version: 1;
  stashedAt: number;
  courses: ParsedSyllabus[];
  globalWarnings: string[];
}

function storageAvailable(): boolean {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function stashPendingParse(parsed: ParsedMultiSubjectSyllabus): boolean {
  if (!storageAvailable() || parsed.courses.length === 0) return false;
  try {
    const payload: PendingHandoff = {
      version: 1,
      stashedAt: Date.now(),
      courses: parsed.courses,
      globalWarnings: parsed.globalWarnings,
    };
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function peekPendingParse(): PendingHandoff | null {
  if (!storageAvailable()) return null;
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingHandoff;
    if (parsed?.version !== 1 || !Array.isArray(parsed?.courses)) return null;
    if (typeof parsed.stashedAt !== 'number' || Date.now() - parsed.stashedAt > MAX_AGE_MS) {
      return null;
    }
    if (parsed.courses.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readAndClearPendingParse(): PendingHandoff | null {
  if (!storageAvailable()) return null;
  try {
    const handoff = peekPendingParse();
    if (handoff) sessionStorage.removeItem(HANDOFF_KEY);
    return handoff;
  } catch {
    return null;
  }
}

export function clearPendingParse(): void {
  if (!storageAvailable()) return;
  try {
    sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    /* no-op */
  }
}

export function handoffToCourseInputs(handoff: PendingHandoff): NewCourseInput[] {
  return handoff.courses.map((course) => ({
    courseCode: course.courseCode,
    title: course.title,
    instructorName: course.instructorName ?? null,
    term: course.term,
    creditHours: course.creditHours,
    components: course.components.map((component) => ({
      name: component.name,
      kind: component.kind,
      weight: component.weight,
      dropLowest: component.dropLowest,
      dueOn: component.dueOn ?? null,
    })),
    topics: course.topics,
  }));
}
