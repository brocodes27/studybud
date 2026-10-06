import type { SourcePage } from "./model";

export interface DetectedSubject {
  id: string;
  title: string;
  courseCode?: string;
  semester?: string;
  startPage: number;
  endPage: number;
  pageCount: number;
  selected: boolean;
  /** Exact source spans keep subjects sharing a PDF page separate. */
  sourceRanges?: { page: number; start: number; end: number }[];
}

const CODE = /\b((?:\d{1,2})?[A-Z]{2,5}[ -]?\d{2,4}[A-Z]?)\b/;
const TITLE_LABEL =
  /^(?:course(?:\s+(?:title|name))?|subject(?:\s+(?:title|name))?|name\s+of\s+(?:the\s+)?course|paper\s+(?:title|name))\s*[:\-–—]\s*(.*)$/i;
const CODE_LABEL = /^(?:course|subject|paper)\s+code\s*[:\-–—]\s*(.*)$/i;
const NON_SUBJECT =
  /^(?:table of contents|contents|syllabus|index|curriculum|department|university|school|institute|faculty|programme|program|degree|bachelor|master|credits?|marks|evaluation|unit|module|chapter|week|course outcomes?|course objectives?|course description|course outline|description|learning|objectives?|outcomes?|references?|text\s*books?|recommended|prerequisites?|teaching|assessment|examination|total|lecture|tutorial|practical|hours?|note)\b/i;
const SEMESTER_VALUES: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
};
const SEMESTER_TOKEN =
  "(\\d{1,2}(?:st|nd|rd|th)?|VIII|VII|VI|IV|III|II|IX|X|V|I|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)";
const SEMESTER = new RegExp(
  `^(?:semester|sem\\.?)\\b\\s*[:\\-–—]?\\s*${SEMESTER_TOKEN}\\b|^${SEMESTER_TOKEN}\\s+(?:semester|sem\\.?)\\b`,
  "i",
);

function readSemester(text: string): string | undefined {
  const match = text.match(SEMESTER);
  if (!match) return undefined;
  const token = (match[1] || match[2]).toLowerCase();
  const number =
    SEMESTER_VALUES[token] ?? Number(token.replace(/(?:st|nd|rd|th)$/, ""));
  return number > 0 && number <= 12 ? `Semester ${number}` : undefined;
}

interface Line {
  page: number;
  start: number;
  end: number;
  text: string;
  firstOnPage: boolean;
}

function sourceLines(pages: SourcePage[]): Line[] {
  return pages.flatMap((page) => {
    let offset = 0;
    let first = true;
    const lines: Line[] = [];
    for (const raw of page.text.split("\n")) {
      const text = raw.trim().replace(/^#{1,6}\s+/, "");
      if (text) {
        lines.push({
          page: page.page,
          start: offset,
          end: offset + raw.length,
          text,
          firstOnPage: first,
        });
        first = false;
      }
      offset += raw.length + 1;
    }
    return lines;
  });
}

function cleanTitle(text: string): string {
  // Drop table columns (L/T/P, credits, marks) after the course title.
  return text
    .replace(/\s+(?:\d+(?:\.\d+)?|[-–])(?:\s+(?:\d+(?:\.\d+)?|[-–]))*\s*$/, "")
    .replace(/[;,|]+$/, "")
    .trim();
}

function isHeading(text: string): boolean {
  return (
    text.length >= 5 &&
    text.length <= 100 &&
    /[A-Za-z]{3}/.test(text) &&
    !NON_SUBJECT.test(text) &&
    !readSemester(text) &&
    !/[.!?]$/.test(text)
  );
}

/** Scan the entire curriculum, retaining semester context and exact subject boundaries. */
export function detectSubjectsFromPages(
  inputPages: SourcePage[],
): DetectedSubject[] {
  if (!inputPages?.length) return [];
  const pages = [...inputPages].sort((a, b) => a.page - b.page);
  const lines = sourceLines(pages);
  const contentsPages = new Set(
    pages
      .filter((p) =>
        p.text
          .trim()
          .split("\n")
          .slice(0, 3)
          .some((line) =>
            /^(?:table of contents|contents|index)\b/i.test(line.trim()),
          ),
      )
      .map((p) => p.page),
  );
  const sections: {
    title: string;
    courseCode?: string;
    semester?: string;
    from: Line;
    to?: Line;
  }[] = [];
  const semestersOnPages = new Set(
    lines.filter((line) => readSemester(line.text)).map((line) => line.page),
  );
  const knownSemesters = new Map<string, Set<string>>();
  let semester: string | undefined;
  let active: (typeof sections)[number] | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Contents pages enumerate courses but are not their actual source sections.
    if (contentsPages.has(line.page)) continue;
    const foundSemester = readSemester(line.text);
    if (foundSemester) {
      // A labelled semester in a course's header describes that course. A new
      // semester heading closes the previous course before the next one starts.
      const headerMetadata =
        /^semester\s*:/i.test(line.text) &&
        active?.from.page === line.page &&
        lines.slice(Math.max(0, i - 4), i).includes(active.from);
      if (active && foundSemester !== semester && !headerMetadata) {
        active.to = line;
        active = undefined;
      }
      semester = foundSemester;
      if (headerMetadata && active) active.semester = semester;
      continue;
    }

    const titleMatch = line.text.match(TITLE_LABEL);
    const codeMatch = line.text.match(CODE_LABEL);
    let title = titleMatch ? cleanTitle(titleMatch[1]) : "";
    let code = codeMatch?.[1].match(CODE)?.[1];
    let from = line;

    if (titleMatch) {
      // PDF extraction often puts the value on the following line.
      if (
        !title &&
        lines[i + 1]?.page === line.page &&
        isHeading(lines[i + 1].text)
      )
        title = cleanTitle(lines[i + 1].text);
      const previous = lines[i - 1];
      const precedingLabel =
        previous?.page === line.page && CODE_LABEL.test(previous.text)
          ? previous
          : previous?.page === line.page &&
              CODE.test(previous.text) &&
              lines[i - 2]?.page === line.page &&
              CODE_LABEL.test(lines[i - 2].text)
            ? lines[i - 2]
            : undefined;
      // Wrapped titles in compiled PDFs continue until the description or
      // outline label, e.g. "Problem Solving and" / "Programming".
      let continuationIndex = i + 1;
      if (!titleMatch[1].trim() && title) continuationIndex++;
      for (let j = continuationIndex; j <= i + 3; j++) {
        const continuation = lines[j];
        if (
          !continuation ||
          continuation.page !== line.page ||
          !isHeading(continuation.text) ||
          TITLE_LABEL.test(continuation.text) ||
          CODE_LABEL.test(continuation.text)
        )
          break;
        const followedByMetadata =
          /^(?:course\s+(?:description|outline|code)|subject\s+code|description)\b/i.test(
            lines[j + 1]?.text || "",
          );
        if (
          !/(?:\b(?:and|of|for|to|in|with)|&)$/i.test(title) &&
          !(title.includes("(") && !title.includes(")")) &&
          !followedByMetadata
        )
          break;
        title = `${title} ${continuation.text}`;
      }
      for (const neighbour of [
        ...(precedingLabel ? [precedingLabel] : []),
        ...lines.slice(i + 1, i + 4),
      ]) {
        if (neighbour.page !== line.page || neighbour === line) continue;
        if (neighbour.start > line.start && TITLE_LABEL.test(neighbour.text))
          break;
        const codeLabel = neighbour.text.match(CODE_LABEL);
        const following = lines[lines.indexOf(neighbour) + 1];
        const labelledCode =
          codeLabel?.[1].match(CODE)?.[1] ||
          (codeLabel && following?.page === line.page
            ? following.text.match(CODE)?.[1]
            : undefined);
        if (labelledCode) {
          code = labelledCode;
          if (neighbour.start < line.start) from = neighbour;
          break;
        }
      }
    } else if (codeMatch) {
      if (!code && lines[i + 1]?.page === line.page)
        code = lines[i + 1].text.match(CODE)?.[1];
      // A title label nearby will create this section with both fields.
      const nearbyTitle = lines
        .slice(Math.max(0, i - 2), i + 4)
        .some((l) => l.page === line.page && TITLE_LABEL.test(l.text));
      if (nearbyTitle) continue;
      const next = lines[i + 1];
      if (
        next?.page === line.page &&
        isHeading(next.text) &&
        !CODE_LABEL.test(next.text)
      )
        title = cleanTitle(next.text);
    } else {
      // A code value extracted below its label belongs to the existing header.
      if (
        lines[i - 1]?.page === line.page &&
        CODE_LABEL.test(lines[i - 1].text)
      )
        continue;
      // Recognise course-code/title rows in semester tables and detailed headings.
      const row = line.text.replace(/^\d+[.)]?\s+/, "").replace(/^\|\s*/, "");
      const match = row.match(CODE);
      if (
        match?.index === 0 &&
        !/^(?:ISO|IEEE|ISBN|ISSN|ANSI)/.test(match[1])
      ) {
        code = match[1];
        title = cleanTitle(
          row
            .slice(match[1].length)
            .replace(/^[\s:|\-–—]+/, "")
            .replace(/\|/g, " "),
        );
        if (
          !title &&
          lines[i + 1]?.page === line.page &&
          isHeading(lines[i + 1].text)
        )
          title = cleanTitle(lines[i + 1].text);
      } else if (
        (line.firstOnPage || readSemester(lines[i - 1]?.text || "")) &&
        line.text === line.text.toUpperCase() &&
        isHeading(line.text)
      ) {
        title = cleanTitle(line.text);
      }
    }
    if (!title && !code) continue;
    if (title && (NON_SUBJECT.test(title) || !/[A-Za-z]{3}/.test(title)))
      continue;
    const candidateTitle = title || `Subject (${code})`;
    const normalizedCode = code?.replace(/[ -]/g, "").toUpperCase();
    // A merged packet can list every semester first, then provide detailed
    // course pages without repeating semester headings. Reuse an unambiguous
    // code-to-semester association from those earlier curriculum tables.
    const known = normalizedCode
      ? knownSemesters.get(normalizedCode)
      : undefined;
    if (!semestersOnPages.has(line.page) && known?.size === 1)
      semester = [...known][0];
    if (normalizedCode && semester) {
      const associations =
        knownSemesters.get(normalizedCode) || new Set<string>();
      associations.add(semester);
      knownSemesters.set(normalizedCode, associations);
    }
    const sameCourse =
      active &&
      active.semester === semester &&
      (normalizedCode && active.courseCode
        ? normalizedCode ===
          active.courseCode.replace(/[ -]/g, "").toUpperCase()
        : active.title.toLowerCase() === candidateTitle.toLowerCase());
    if (sameCourse) continue; // Repeated page headers are continuation pages.
    if (active) active.to = from;
    active = { title: candidateTitle, courseCode: code, semester, from };
    sections.push(active);
  }

  if (!sections.length) {
    return [
      {
        id: "subject-1",
        title: "Complete Syllabus Material",
        semester:
          new Set(lines.map((line) => readSemester(line.text)).filter(Boolean))
            .size === 1
            ? semester
            : undefined,
        startPage: pages[0].page,
        endPage: pages[pages.length - 1].page,
        pageCount: pages.length,
        selected: true,
      },
    ];
  }

  const subjects = new Map<string, DetectedSubject>();
  for (const section of sections) {
    const ranges = pages
      .filter(
        (p) =>
          p.page >= section.from.page &&
          (!section.to || p.page <= section.to.page),
      )
      .map((p) => ({
        page: p.page,
        start: p.page === section.from.page ? section.from.start : 0,
        end: section.to?.page === p.page ? section.to.start : p.text.length,
      }))
      .filter((r) => r.end > r.start);
    if (!ranges.length) continue;
    const key = `${section.semester || ""}|${section.courseCode?.replace(/[ -]/g, "").toUpperCase() || section.title.toLowerCase()}`;
    const existing = subjects.get(key);
    if (existing) {
      existing.sourceRanges!.push(...ranges);
      existing.endPage = ranges[ranges.length - 1].page;
      existing.pageCount = new Set(
        existing.sourceRanges!.map((r) => r.page),
      ).size;
    } else {
      subjects.set(key, {
        id: `subject-${subjects.size + 1}`,
        title: section.title,
        courseCode: section.courseCode,
        semester: section.semester,
        startPage: ranges[0].page,
        endPage: ranges[ranges.length - 1].page,
        pageCount: ranges.length,
        selected: true,
        sourceRanges: ranges,
      });
    }
  }
  return [...subjects.values()];
}

/** Page-only slicing remains available for callers with manual page bounds. */
export function slicePagesForSubject(
  pages: SourcePage[],
  startPage: number,
  endPage: number,
): SourcePage[] {
  return pages.filter((p) => p.page >= startPage && p.page <= endPage);
}

/** Extract only this subject's text, retaining original PDF page references. */
export function extractPagesForSubject(
  pages: SourcePage[],
  subject: DetectedSubject,
): SourcePage[] {
  if (!subject.sourceRanges)
    return slicePagesForSubject(pages, subject.startPage, subject.endPage);
  const excerpts = new Map<number, string[]>();
  for (const range of subject.sourceRanges) {
    const page = pages.find((p) => p.page === range.page);
    const text = page?.text.slice(range.start, range.end).trim();
    if (text)
      excerpts.set(range.page, [...(excerpts.get(range.page) || []), text]);
  }
  return [...excerpts].map(([page, texts]) => ({
    page,
    text: texts.join("\n\n"),
  }));
}
