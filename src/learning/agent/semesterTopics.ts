import { sameSemester } from '../../../supabase/functions/_shared/semester-scope';
import type { Material } from '../model';
import type { ParsedSyllabus } from '../../curve/ai';

/**
 * Extracts all actual parsed topics from uploaded materials, onboarding handoff,
 * and enrolled courses matching this subject name.
 */
export function getActualAndSuggestedTopics(
  courseName: string,
  materials: Material[] = [],
  pendingCourses: ParsedSyllabus[] = [],
  enrolledCourseTopics: Record<string, string[]> = {},
  semester?: string
): { topics: string[]; isActual: boolean } {
  const norm = courseName.trim().toLowerCase();
  const collected = new Set<string>();

  // 1. Check user materials from library
  for (const mat of materials) {
    if (semester && !sameSemester(mat.metadata.semester, semester)) continue;
    const matCourse = (mat.metadata?.course || mat.title || '').trim().toLowerCase();
    const isDirectMatch =
      !!norm && !!matCourse && (norm === matCourse || norm.includes(matCourse) || matCourse.includes(norm));

    if (isDirectMatch) {
      const confirmed = Array.isArray(mat.metadata?.confirmed_topics) ? mat.metadata.confirmed_topics : [];
      const extracted = Array.isArray(mat.metadata?.topics) ? mat.metadata.topics : [];
      const topicsList = [...extracted, ...confirmed];
      for (const t of topicsList) {
        if (typeof t === 'string' && t.trim()) {
          collected.add(t.trim());
        }
      }
    }
  }

  // 2. Check pending syllabus handoff from landing page / onboarding parse
  for (const pCourse of pendingCourses) {
    if (semester && !sameSemester(pCourse.term, semester)) continue;
    const isMatch =
      !!norm && [pCourse.title, pCourse.courseCode].some((name) => {
        const candidate = name?.trim().toLowerCase();
        return !!candidate && (norm === candidate || norm.includes(candidate) || candidate.includes(norm));
      });

    if (isMatch && Array.isArray(pCourse.topics)) {
      for (const t of pCourse.topics) {
        if (t?.topic && typeof t.topic === 'string' && t.topic.trim()) {
          collected.add(t.topic.trim());
        }
      }
    }
  }

  // 3. Check enrolled course topics from curve courses
  for (const [enrollName, tops] of Object.entries(semester ? {} : enrolledCourseTopics)) {
    const eNorm = enrollName.trim().toLowerCase();
    const isMatch = !!norm && !!eNorm && (norm === eNorm || norm.includes(eNorm) || eNorm.includes(norm));
    if (isMatch && Array.isArray(tops)) {
      for (const t of tops) {
        if (typeof t === 'string' && t.trim()) {
          collected.add(t.trim());
        }
      }
    }
  }

  if (collected.size > 0) {
    return { topics: Array.from(collected), isActual: true };
  }

  return { topics: [], isActual: false };
}

