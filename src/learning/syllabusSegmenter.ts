import type { SourcePage } from './model';

export interface DetectedSubject {
  id: string;
  title: string;
  courseCode?: string;
  startPage: number;
  endPage: number;
  pageCount: number;
  selected: boolean;
}

/**
 * Common course code regexes:
 * - CS101, CSE 201, MATH-102, ENG201, BIO 110, etc.
 */
const COURSE_CODE_INLINE_REGEX = /\b([A-Z]{2,5}[ -]?\d{3,4}[A-Z]?)\b/;

/**
 * Explicit "Course Title: ..." or "Subject Name: ..." headings
 */
const SUBJECT_TITLE_REGEX =
  /(?:course\s+(?:title|name)|subject\s+(?:title|name)|name\s+of\s+the\s+course|paper\s+(?:title|name)|module\s+title)\s*[:\-–—]\s*([^\n\r]+)/i;

/**
 * Explicit "Course Code: ..." or "Subject Code: ..." headings
 */
const COURSE_CODE_LABEL_REGEX =
  /(?:course\s+code|subject\s+code|paper\s+code|code)\s*[:\-–—]\s*([^\n\r]+)/i;

/**
 * Scans extracted pages from a compiled syllabus to find distinct subjects.
 */
export function detectSubjectsFromPages(pages: SourcePage[]): DetectedSubject[] {
  if (!pages || pages.length === 0) return [];

  const splits: { page: number; title: string; courseCode?: string }[] = [];

  for (let i = 0; i < pages.length; i++) {
    const pageObj = pages[i];
    const text = pageObj.text || '';
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    let foundTitle = '';
    let foundCode = '';

    for (let j = 0; j < Math.min(25, lines.length); j++) {
      const line = lines[j];

      // 1. Check explicit title label
      if (!foundTitle) {
        const titleMatch = line.match(SUBJECT_TITLE_REGEX);
        if (titleMatch && titleMatch[1].trim().length > 3) {
          foundTitle = titleMatch[1].trim().replace(/[;,]$/, '');
        }
      }

      // 2. Check explicit code label
      if (!foundCode) {
        const codeLabelMatch = line.match(COURSE_CODE_LABEL_REGEX);
        if (codeLabelMatch && codeLabelMatch[1].trim()) {
          const rawCode = codeLabelMatch[1].trim().replace(/[;,]$/, '');
          const inlineMatch = rawCode.match(COURSE_CODE_INLINE_REGEX);
          foundCode = inlineMatch ? inlineMatch[1] : rawCode;
        } else {
          const codeMatch = line.match(COURSE_CODE_INLINE_REGEX);
          if (codeMatch) {
            const candidate = codeMatch[1].trim();
            if (!/^(ISO|IEEE|ISBN|ISSN|ANSI)\b/i.test(candidate)) {
              foundCode = candidate;
            }
          }
        }
      }
    }

    // 3. Fallback: look for uppercase subject headings like "MATHEMATICS - I", "DATA STRUCTURES AND ALGORITHMS"
    if (!foundTitle) {
      for (let j = 0; j < Math.min(10, lines.length); j++) {
        const line = lines[j];
        if (
          /^(?:[A-Z\s]{4,40})(?:\s*[-–—]\s*(?:I|II|III|IV|V|VI|VII|VIII|\d))?$/i.test(
            line
          ) &&
          !/^(table of contents|contents|syllabus|index|semester|curriculum|department|university|school|institute|credits|marks|evaluation)/i.test(
            line
          )
        ) {
          if (line.length >= 5 && line.length <= 60) {
            foundTitle = line.trim();
            break;
          }
        }
      }
    }

    if (foundTitle || (foundCode && (splits.length === 0 || splits[splits.length - 1].page !== pageObj.page))) {
      const last = splits[splits.length - 1];
      const titleCandidate = foundTitle || `Subject (${foundCode})`;

      if (!last || last.title.toLowerCase() !== titleCandidate.toLowerCase()) {
        splits.push({
          page: pageObj.page,
          title: titleCandidate,
          courseCode: foundCode || undefined,
        });
      }
    }
  }

  // If no subject headings were discovered, or only 1, return single subject or chunked fallback
  if (splits.length <= 1) {
    if (pages.length >= 20) {
      const chunkSize = Math.max(5, Math.floor(pages.length / 4));
      const chunked: DetectedSubject[] = [];
      let currentStart = 1;

      while (currentStart <= pages.length) {
        const end = Math.min(pages.length, currentStart + chunkSize - 1);
        const idx = chunked.length + 1;
        chunked.push({
          id: `chunk-${idx}`,
          title: `Subject / Module ${idx}`,
          startPage: currentStart,
          endPage: end,
          pageCount: end - currentStart + 1,
          selected: true,
        });
        currentStart = end + 1;
      }
      return chunked;
    }

    return [
      {
        id: 'subject-1',
        title: splits[0]?.title || 'Complete Syllabus Material',
        courseCode: splits[0]?.courseCode,
        startPage: 1,
        endPage: pages.length,
        pageCount: pages.length,
        selected: true,
      },
    ];
  }

  // Build subject list with start and end page bounds
  const results: DetectedSubject[] = [];
  for (let k = 0; k < splits.length; k++) {
    const cur = splits[k];
    const next = splits[k + 1];
    const startPage = cur.page;
    const endPage = next ? next.page - 1 : pages.length;

    if (endPage >= startPage) {
      results.push({
        id: `subject-${k + 1}`,
        title: cur.title,
        courseCode: cur.courseCode,
        startPage,
        endPage,
        pageCount: endPage - startPage + 1,
        selected: true,
      });
    }
  }

  return results;
}

/**
 * Returns a subset of pages corresponding to a subject's start and end page.
 */
export function slicePagesForSubject(
  pages: SourcePage[],
  startPage: number,
  endPage: number
): SourcePage[] {
  return pages.filter((p) => p.page >= startPage && p.page <= endPage);
}
