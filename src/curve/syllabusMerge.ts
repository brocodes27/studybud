/**
 * Combined "all subjects in one file" syllabi.
 *
 * A per-course PDF is a handful of pages, but a department packet or an
 * advisor's combined handout runs 20–60. Those cannot go to the model in one
 * call, so the pages are parsed in windows and the results stitched back
 * together here: a course that appears in two consecutive windows (its grading
 * table on page 11, its weekly schedule on page 12) has to come back as ONE
 * course, not two halves.
 *
 * Pure functions only — no network, no Supabase — so this is directly testable.
 */
import type { ParsedSyllabus } from './ai';

/** Pages per model call. Chosen to stay inside the proxy's image limit. */
export const PAGES_PER_CALL = 8;

/** Refuse absurd inputs rather than firing 40 calls at the proxy. */
export const MAX_PAGES = 64;

export function chunkPages<T>(items: T[], size = PAGES_PER_CALL): T[][] {
  if (size < 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Identity of a course across windows. Course codes are the reliable key
 * ("CHEM 2210" === "chem2210"); titles are the fallback when the packet omits
 * codes. A course with neither is anonymous and never merges into another.
 */
export function courseKey(course: Pick<ParsedSyllabus, 'courseCode' | 'title'>, index = 0): string {
  const code = (course.courseCode || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (code) return `code:${code}`;
  const title = (course.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (title) return `title:${title}`;
  return `anon:${index}`;
}

function mergeComponents(
  a: ParsedSyllabus['components'],
  b: ParsedSyllabus['components'],
): ParsedSyllabus['components'] {
  const seen = new Map<string, ParsedSyllabus['components'][number]>();
  for (const component of [...a, ...b]) {
    const key = `${component.name.trim().toLowerCase()}|${component.kind}`;
    const existing = seen.get(key);
    // Same category twice across windows: keep the richer read (a real weight
    // beats a zero, an explicit due date beats null).
    if (!existing) {
      seen.set(key, component);
    } else {
      seen.set(key, {
        ...existing,
        weight: existing.weight || component.weight,
        dropLowest: existing.dropLowest || component.dropLowest,
        dueOn: existing.dueOn ?? component.dueOn ?? null,
      });
    }
  }
  return [...seen.values()];
}

function mergeTopics(
  a: ParsedSyllabus['topics'],
  b: ParsedSyllabus['topics'],
): ParsedSyllabus['topics'] {
  const seen = new Map<string, NonNullable<ParsedSyllabus['topics']>[number]>();
  for (const topic of [...(a ?? []), ...(b ?? [])]) {
    seen.set(`${topic.week}|${topic.topic.trim().toLowerCase()}`, topic);
  }
  return [...seen.values()].sort((x, y) => x.week - y.week);
}

function mergeOne(a: ParsedSyllabus, b: ParsedSyllabus): ParsedSyllabus {
  const components = mergeComponents(a.components, b.components);
  const confidence = [...(a.confidence ?? []), ...(b.confidence ?? [])];
  return {
    ...a,
    courseCode: a.courseCode || b.courseCode,
    title: a.title || b.title,
    instructorName: a.instructorName ?? b.instructorName ?? null,
    term: a.term || b.term,
    creditHours: a.creditHours || b.creditHours,
    components,
    topics: mergeTopics(a.topics, b.topics),
    // The half that had no grading table warned about it; drop that warning
    // once the other half supplied one.
    warnings: [...new Set([...a.warnings, ...b.warnings])].filter(
      (w) => !(components.length > 0 && w.startsWith('No grading breakdown')),
    ),
    confidence,
    hasLowConfidence: Boolean(a.hasLowConfidence || b.hasLowConfidence),
  };
}

/**
 * Flatten per-window parses into one course list, merging repeats and keeping
 * first-seen order (which is document order, i.e. the order the subjects
 * appear in the packet).
 */
export function mergeParsedCourses(windows: ParsedSyllabus[][]): ParsedSyllabus[] {
  const order: string[] = [];
  const byKey = new Map<string, ParsedSyllabus>();

  windows.forEach((courses, windowIndex) => {
    courses.forEach((course, courseIndex) => {
      const key = courseKey(course, windowIndex * 1000 + courseIndex);
      const existing = byKey.get(key);
      if (existing) {
        byKey.set(key, mergeOne(existing, course));
      } else {
        order.push(key);
        byKey.set(key, course);
      }
    });
  });

  return order.map((key) => byKey.get(key)!).filter(Boolean);
}

/** Courses with nothing usable in them — an empty shell the model emitted. */
export function isEmptyCourse(course: ParsedSyllabus): boolean {
  return (
    !course.courseCode.trim() &&
    !course.title.trim() &&
    course.components.length === 0 &&
    (course.topics ?? []).length === 0
  );
}
