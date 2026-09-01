import { supabase } from '../lib/supabase';
import { round, type ComponentKind } from './gradeEngine';
import type { NewCourseInput } from './data';
import {
  summarizeConfidence,
  type FieldConfidence,
  type ConfidenceLevel,
} from './confidence';
import {
  chunkPages,
  isEmptyCourse,
  mergeParsedCourses,
  MAX_PAGES,
  PAGES_PER_CALL,
} from './syllabusMerge';
import {
  ARTIFACT_BRIEF,
  buildRubric,
  isCrossSubject,
  type EncodingContext,
  type EncodingRubric,
} from './encodingRubric';

/**
 * Curve AI calls route through the already-deployed `ai-proxy` edge function
 * rather than a new one, so they inherit its auth check, `check_ai_budget`
 * gate and `log_ai_usage` accounting for free.
 */

const VALID_KINDS: ComponentKind[] = [
  'homework',
  'quiz',
  'midterm',
  'final',
  'project',
  'lab',
  'participation',
  'other',
];

async function callProxy(action: string, payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: { action, payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  const result = data?.result;
  return typeof result === 'string' ? result : JSON.stringify(result ?? '');
}

/**
 * Models wrap JSON in prose or fences often enough that this has to be
 * defensive; we take the outermost brace-delimited span.
 */
function extractJson(
  raw: string,
  onFailure = 'The syllabus could not be read. Try pasting the grading section on its own.',
): unknown {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(onFailure);
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

const CONFIDENCE_ADDENDUM = `
Additionally, for EACH course return a top-level "confidence" object:
{
  "confidence": [
    { "field": "courseCode|title|components|components.<i>.weight| components.<i>.kind|topics", "level": "high|medium|low", "reason": "short phrase" }
  ]
}
Mark "high" ONLY for fields stated explicitly in the document. Mark "medium" when inferred from context. Mark "low" (with reason) when guessed, ambiguous, cut off in the source, or weights do not reconcile. Never omit the array.`;

const SINGLE_SYLLABUS_SYSTEM = `You extract grading schemes and weekly schedules for ONE US college course from its syllabus document.
Return ONLY a JSON object, no prose, with this exact shape:
{
  "course_code": "CHEM 2210",
  "title": "Organic Chemistry I",
  "instructor_name": "Dr. Chen" or null,
  "term": "Fall 2026",
  "credit_hours": 4,
  "components": [
    { "name": "Problem sets", "kind": "homework", "weight": 20, "drop_lowest": 1, "due_on": null }
  ],
  "weekly_topics": [
    { "topic": "Structure and Bonding", "week": 1 }
  ]
}
Rules:
- "kind" must be one of: homework, quiz, midterm, final, project, lab, participation, other.
- "weight" is the percent of the final grade as a number. Weights should sum to 100 where the syllabus allows.
- Group repeated items into one category (e.g., all problem sets → one homework row with its drop_lowest count).
- "weekly_topics" lists the main topic per syllabus week.
- Never invent a component or topic that is not in the document.${CONFIDENCE_ADDENDUM}`;

/* Back-compat alias: older exports reference SYLLABUS_SYSTEM. */
const SYLLABUS_SYSTEM = SINGLE_SYLLABUS_SYSTEM;

const MULTI_SYLLABUS_SYSTEM = `You extract grading schemes and weekly schedules for one OR MULTIPLE US college courses/subjects from syllabi documents.
Return ONLY a JSON object, no prose, with this exact shape:
{
  "courses": [
    {
      "course_code": "CHEM 2210",
      "title": "Organic Chemistry I",
      "instructor_name": "Dr. Chen" or null,
      "term": "Fall 2026",
      "credit_hours": 4,
      "components": [
        { "name": "Problem sets", "kind": "homework", "weight": 20, "drop_lowest": 1, "due_on": null }
      ],
      "weekly_topics": [
        { "topic": "Structure and Bonding", "week": 1 }
      ]
    }
  ]
}
Rules:
- If the document(s) contain multiple courses/subjects, return each one in the "courses" array.
- "kind" must be one of: homework, quiz, midterm, final, project, lab, participation, other.
- "weight" is the percent of the final grade as a number. Weights should sum to 100 where the syllabus allows.
- Group repeated items into one category.
- "weekly_topics" lists the main topic per syllabus week.
- Never invent a component or topic that is not in the document.${CONFIDENCE_ADDENDUM}`;

export interface ParsedSyllabus extends NewCourseInput {
  warnings: string[];
  /**
   * Worst-case-merged confidence per flagged field (model-reported ∪ client
   * heuristics). `hasLowConfidence` means the student must eyeball flagged
   * fields before the course is saved (P1.1 contract).
   */
  confidence: FieldConfidence[];
  hasLowConfidence: boolean;
}

export interface ParsedMultiSubjectSyllabus {
  courses: ParsedSyllabus[];
  globalWarnings: string[];
}

function normalizeConfidence(raw: unknown): FieldConfidence[] {
  if (!Array.isArray(raw)) return [];
  const VALID_LEVELS: ConfidenceLevel[] = ['high', 'medium', 'low'];
  return raw
    .map((entry) => {
      const item = entry as Record<string, unknown>;
      const field = String(item.field ?? '');
      const level = String(item.level ?? 'medium') as ConfidenceLevel;
      if (!field) return null;
      return {
        field,
        level: VALID_LEVELS.includes(level) ? level : ('medium' as ConfidenceLevel),
        reason: String(item.reason ?? '').slice(0, 140),
      };
    })
    .filter((entry): entry is FieldConfidence => entry !== null);
}

function normalizeParsedRecord(record: Record<string, unknown>): ParsedSyllabus {
  const warnings: string[] = [];
  const modelConfidence = normalizeConfidence(record.confidence);

  const rawTopics = Array.isArray(record.weekly_topics) ? record.weekly_topics : [];
  const topics = rawTopics
    .map((entry) => {
      const item = entry as Record<string, unknown>;
      const topic = String(item.topic ?? '').trim();
      const week = Math.floor(Number(item.week));
      if (!topic) return null;
      return { topic: topic.slice(0, 120), week: Number.isFinite(week) && week > 0 ? week : 1 };
    })
    .filter((topic): topic is NonNullable<typeof topic> => topic !== null);

  const rawComponents = Array.isArray(record.components) ? record.components : [];
  const components = rawComponents
    .map((entry) => {
      const item = entry as Record<string, unknown>;
      const weight = Number(item.weight);
      if (!Number.isFinite(weight) || weight <= 0) return null;

      const kind = String(item.kind ?? 'other') as ComponentKind;
      return {
        name: String(item.name ?? 'Component').slice(0, 80),
        kind: VALID_KINDS.includes(kind) ? kind : ('other' as ComponentKind),
        weight,
        dropLowest: Math.max(0, Math.floor(Number(item.drop_lowest ?? 0)) || 0),
        dueOn: typeof item.due_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.due_on)
          ? item.due_on
          : null,
      };
    })
    .filter((component): component is NonNullable<typeof component> => component !== null);

  if (components.length === 0) {
    warnings.push('No grading breakdown was found, so components need to be added by hand.');
  }

  const total = components.reduce((sum, component) => sum + component.weight, 0);
  if (components.length > 0 && Math.abs(total - 100) > 0.5) {
    warnings.push(`Extracted weights sum to ${Math.round(total)}%, not 100%. Check them before saving.`);
  }

  const creditHours = Number(record.credit_hours);

  const normalized = {
    courseCode: String(record.course_code ?? '').slice(0, 40) || 'COURSE 101',
    title: String(record.title ?? '').slice(0, 120) || 'Untitled course',
    instructorName: record.instructor_name ? String(record.instructor_name).slice(0, 80) : null,
    term: String(record.term ?? '').slice(0, 40) || currentTerm(),
    creditHours: Number.isFinite(creditHours) && creditHours > 0 ? creditHours : 3,
    components,
    topics,
  };

  const summary = summarizeConfidence(normalized, modelConfidence);

  return {
    ...normalized,
    warnings,
    confidence: summary.entries,
    hasLowConfidence: summary.hasLowConfidence,
  };
}

function normalizeParsed(parsed: unknown): ParsedSyllabus {
  const record = parsed as Record<string, unknown>;
  return normalizeParsedRecord(record);
}

function normalizeMultiParsed(parsed: unknown): ParsedMultiSubjectSyllabus {
  const record = parsed as Record<string, unknown>;
  const rawCourses = Array.isArray(record.courses)
    ? record.courses
    : Array.isArray(parsed)
    ? parsed
    : [record];

  const courses = rawCourses.map((c) => normalizeParsedRecord(c as Record<string, unknown>));
  return {
    courses: courses.length > 0 ? courses : [normalizeParsedRecord({})],
    globalWarnings: courses.length === 0 ? ['No course syllabi detected in the input.'] : [],
  };
}

export function currentTerm(): string {
  const now = new Date();
  const month = now.getMonth();
  const season = month <= 4 ? 'Spring' : month <= 7 ? 'Summer' : 'Fall';
  return `${season} ${now.getFullYear()}`;
}

/** Parse a syllabus pasted as plain text. */
export async function parseSyllabusText(text: string): Promise<ParsedSyllabus> {
  const raw = await callProxy('generate_chat_completion', {
    systemPrompt: SYLLABUS_SYSTEM,
    prompt: `Syllabus:\n\n${text.slice(0, 24_000)}`,
    temperature: 0.1,
  });
  return normalizeParsed(extractJson(raw));
}

/** Parse a syllabus from photographs or rendered PDF pages. */
export async function parseSyllabusImages(images: string[]): Promise<ParsedSyllabus> {
  const raw = await callProxy('analyze_images', {
    systemPrompt: SYLLABUS_SYSTEM,
    prompt: 'Extract the grading scheme from these syllabus pages as JSON.',
    images: images.slice(0, 6),
  });
  return normalizeParsed(extractJson(raw));
}

/** How much text goes to the model per call. */
const TEXT_CHARS_PER_CALL = 24_000;

function splitText(text: string, size = TEXT_CHARS_PER_CALL): string[] {
  if (text.length <= size) return [text];
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts;
}

/**
 * Parse syllabus text for one or many subjects.
 *
 * A combined all-subject document is longer than one call can take, so the
 * text is windowed and the per-window courses merged. Truncating instead
 * (the old behaviour) silently lost every subject past the cut.
 */
export async function parseMultiSyllabusTexts(texts: string[]): Promise<ParsedMultiSubjectSyllabus> {
  const combined = texts
    .map((t, idx) => `--- DOCUMENT ${idx + 1} ---\n${t}`)
    .join('\n\n');
  const windows = splitText(combined);

  const parsedWindows: ParsedSyllabus[][] = [];
  for (const [index, window] of windows.entries()) {
    const raw = await callProxy('generate_chat_completion', {
      systemPrompt: MULTI_SYLLABUS_SYSTEM,
      prompt:
        `Extract all courses and subjects from the following syllabus text` +
        (windows.length > 1 ? ` (part ${index + 1} of ${windows.length}; a course may continue across parts)` : '') +
        `:\n\n${window}`,
      temperature: 0.1,
    });
    parsedWindows.push(normalizeMultiParsed(extractJson(raw)).courses);
  }

  return combineWindows(parsedWindows, windows.length);
}

/**
 * Parse rendered syllabus pages for one or many subjects.
 *
 * `imageBatches` is one array per uploaded file. All pages are flattened and
 * sent in windows of PAGES_PER_CALL, so a single 40-page packet holding every
 * subject comes back as every subject — previously everything after page 12
 * was dropped without a word.
 */
export async function parseMultiSyllabusImages(
  imageBatches: string[][],
  /** Called before each pass so a long packet can show progress, not a silent spinner. */
  onProgress?: (pass: number, passes: number) => void,
): Promise<ParsedMultiSubjectSyllabus> {
  const allPages = imageBatches.flat();
  const pages = allPages.slice(0, MAX_PAGES);
  const windows = chunkPages(pages, PAGES_PER_CALL);

  const parsedWindows: ParsedSyllabus[][] = [];
  for (const [index, window] of windows.entries()) {
    onProgress?.(index + 1, windows.length);
    const raw = await callProxy('analyze_images', {
      systemPrompt: MULTI_SYLLABUS_SYSTEM,
      prompt:
        'Extract all course syllabi and subjects contained in these syllabus pages as JSON with a top-level "courses" array.' +
        (windows.length > 1
          ? ` These are pages ${index * PAGES_PER_CALL + 1}-${index * PAGES_PER_CALL + window.length} of a ${pages.length}-page document that may contain several subjects; a course can continue from the previous pages.`
          : ''),
      images: window,
    });
    parsedWindows.push(normalizeMultiParsed(extractJson(raw)).courses);
  }

  const result = combineWindows(parsedWindows, windows.length);
  if (allPages.length > MAX_PAGES) {
    result.globalWarnings.push(
      `Only the first ${MAX_PAGES} pages were read (the upload had ${allPages.length}). Split the file if a subject is missing.`,
    );
  }
  return result;
}

/** Stitch per-window parses into one course list. */
function combineWindows(
  parsedWindows: ParsedSyllabus[][],
  windowCount: number,
): ParsedMultiSubjectSyllabus {
  const merged = mergeParsedCourses(parsedWindows).filter((course) => !isEmptyCourse(course));
  const globalWarnings: string[] = [];

  if (merged.length === 0) {
    return {
      courses: [normalizeParsedRecord({})],
      globalWarnings: ['No course syllabi detected in the input.'],
    };
  }
  if (windowCount > 1) {
    globalWarnings.push(
      `Read in ${windowCount} passes and found ${merged.length} ${merged.length === 1 ? 'subject' : 'subjects'}. Check that nothing is missing before saving.`,
    );
  }

  return { courses: merged, globalWarnings };
}

/* ------------------------------------------------------------- encoding -- */

/**
 * Encoding uses the same `ai-proxy` path as the rest of Curve, so it inherits
 * the auth check, budget gate and usage accounting. Scoring itself lives in
 * `encodingRubric.ts`, which stays free of network and environment.
 */

export type {
  EncodingArtifactKind,
  EncodingContext,
  EncodingRubric,
} from './encodingRubric';

/**
 * Scores an encoding artifact against the four things encoding actually is:
 * organizing, simplifying, connecting, and drawing analogies. Anything that
 * only restates the source material scores low by design — restating is the
 * highlighting-and-rereading trap wearing a different hat.
 */
export async function gradeEncoding(
  context: EncodingContext,
  artifact: string,
): Promise<EncodingRubric> {
  const systemPrompt = `You grade a student's encoding attempt for ${context.courseCode}.

Topic: ${context.topic}
Task they were given: ${ARTIFACT_BRIEF[context.kind]}
${context.linkedTopic ? `They linked it to: ${context.linkedTopic}` : ''}

Score 0-5 on each dimension. Be a fair, ungenerous marker — this score decides
whether the student is allowed to move on to testing themselves, and passing
someone who only restated their notes wastes the hours they study next.

- organize: imposed a structure (order, hierarchy, cause and effect). Restating the source in its original order scores 1.
- simplify: their own plain words. Copied jargon they cannot unpack scores 1.
- connect: tied to something they already know, with the connection made explicit.
- analogize: a mapping where the parts correspond, not a decorative comparison. Score 2 if no analogy was attempted and the task did not call for one.

Return JSON only:
{"organize":n,"simplify":n,"connect":n,"analogize":n,"feedback":"1-2 sentences, second person, name the single most useful fix","weakest":"organize|simplify|connect|analogize"}`;

  const raw = await callProxy('generate_chat_completion', {
    systemPrompt,
    prompt: artifact,
    temperature: 0.2,
  });

  const parsed = extractJson(
    raw,
    'That could not be scored. Your writing is saved — try submitting it again.',
  ) as Record<string, unknown>;

  return buildRubric(parsed, isCrossSubject(context));
}

/**
 * One probing question about a draft artifact.
 *
 * During encoding the tutor's job is the opposite of its usual one: it must not
 * explain, summarize, or fill the gap it finds. Handing over the missing piece
 * is exactly what stops the student encoding it themselves.
 */
export async function probeEncoding(context: EncodingContext, artifact: string): Promise<string> {
  const systemPrompt = `A student is encoding "${context.topic}" for ${context.courseCode}.

Find the weakest link in what they wrote — the step they skipped, the term they
used without unpacking, or the part that is description rather than mechanism —
and ask ONE question about it.

Hard rules:
- Never explain, define, correct, or summarize. Not one clause of teaching.
- Never answer your own question or hint at the answer.
- One question. Under 25 words. No preamble, no praise.`;

  return callProxy('generate_chat_completion', {
    systemPrompt,
    prompt: artifact,
    temperature: 0.5,
  });
}

export interface CoachContext {
  courseCode: string;
  courseTitle: string;
  projectedLetter: string;
  ungradedWeight: number;
  weakestComponent: string | null;
  nextDue: { name: string; daysAway: number } | null;
  userId?: string;
}

/**
 * The study coach. Dynamically fetches student's Bayesian Knowledge Tracing (BKT)
 * mastery parameters and In-Context Knowledge Learning (IKL) memories from Supabase
 * to adapt guidance and optimize learning rate over time.
 */
export async function coachReply(
  context: CoachContext,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  message: string,
): Promise<string> {
  let bktSummary = '';
  let iklSummary = '';

  if (context.userId) {
    try {
      // Fetch BKT parameters for student self-improvement
      const { data: bktParams } = await supabase
        .from('bkt_kc_parameters')
        .select('kc_name, p_know, p_transit, p_slip, p_guess')
        .limit(5);

      if (bktParams && bktParams.length > 0) {
        bktSummary = bktParams
          .map(p => `${p.kc_name}: P(K)=${round(Number(p.p_know || 0) * 100, 0)}%, slip=${p.p_slip}, guess=${p.p_guess}`)
          .join('; ');
      }

      // Fetch IKL (user knowledge memories)
      const { data: iklMemories } = await supabase
        .from('user_knowledge')
        .select('topic, content, knowledge_type')
        .eq('user_id', context.userId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (iklMemories && iklMemories.length > 0) {
        iklSummary = iklMemories
          .map(m => `[${m.topic || m.knowledge_type}]: ${String(m.content || '').slice(0, 100)}`)
          .join(' | ');
      }
    } catch {
      // Fail gracefully if DB query falls back
    }
  }

  const systemPrompt = `You are Curve's adaptive AI study coach for ${context.courseCode} (${context.courseTitle}).

Current state:
- Projected grade: ${context.projectedLetter}
- Share of the grade still unearned: ${Math.round(context.ungradedWeight)}%
${context.weakestComponent ? `- Weakest graded category: ${context.weakestComponent}` : ''}
${context.nextDue ? `- Next assessment: ${context.nextDue.name} in ${context.nextDue.daysAway} days` : ''}
${bktSummary ? `- Learner BKT Mastery Substrate: ${bktSummary}` : ''}
${iklSummary ? `- Learner IKL Memory Profile: ${iklSummary}` : ''}

How you work & adapt over time:
- Adapt guidance dynamically using the student's BKT posterior probabilities and IKL memory context above.
- Never hand over a final answer directly. Ask one focused question at a time that moves the student to solve it.
- When they make a mistake, identify the specific cognitive misconception.
- Be direct, warm, and highly strategic. Keep replies under 120 words.`;

  const transcript = history
    .slice(-8)
    .map((turn) => `${turn.role === 'user' ? 'Student' : 'Coach'}: ${turn.content}`)
    .join('\n');

  return callProxy('generate_chat_completion', {
    systemPrompt,
    prompt: transcript ? `${transcript}\nStudent: ${message}` : message,
    temperature: 0.6,
  });
}
