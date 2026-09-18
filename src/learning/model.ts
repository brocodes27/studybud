export interface SourcePage {
  page: number;
  text: string;
}
export interface Material {
  id: string;
  title: string;
  created_at: string;
  extracted_text: string | null;
  metadata: {
    workspace?: string;
    course?: string;
    exam_on?: string | null;
    topics?: string[];
    pages?: SourcePage[];
    page_count?: number;
    summary?: string;
    confirmed?: boolean;
  };
}
export interface StudyQuestion {
  id: string;
  topic: string;
  question: string;
  options: string[];
  page: number;
}
export interface StudyResult {
  question_id: string;
  correct: boolean;
  expected: string;
  explanation: string;
  quote: string;
  page: number;
  assisted: boolean;
}
export interface StudySession {
  id: string;
  material_id: string;
  mode: "practice" | "checkpoint";
  topic: string;
  questions: StudyQuestion[];
  answers: Record<string, number>;
  hints: string[];
  results: StudyResult[] | null;
  created_at: string;
  completed_at: string | null;
}

export function normalizeTopics(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,]/)
        .map((t) => t.trim().slice(0, 200))
        .filter(Boolean),
    ),
  ].slice(0, 30);
}

export function independentAccuracy(sessions: StudySession[]): number | null {
  const results = sessions
    .filter((s) => s.mode === "checkpoint")
    .flatMap((s) => s.results ?? [])
    .filter((r) => !r.assisted);
  return results.length
    ? Math.round(
        (100 * results.filter((r) => r.correct).length) / results.length,
      )
    : null;
}

export function daysToExam(
  date?: string | null,
  now = new Date(),
): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  if (
    target.getFullYear() !== y ||
    target.getMonth() !== m - 1 ||
    target.getDate() !== d
  )
    return null;
  return Math.round(
    (Date.UTC(y, m - 1, d) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      86400000,
  );
}

export function recommendedMaterials(
  materials: Material[],
  sessions: StudySession[],
): Material[] {
  const priority = (m: Material) => {
    const days = daysToExam(m.metadata.exam_on);
    const history = sessions.filter(
      (s) => s.material_id === m.id && s.completed_at,
    );
    const accuracy = independentAccuracy(history);
    const last = history.reduce(
      (latest, s) => Math.max(latest, Date.parse(s.completed_at!)),
      0,
    );
    const overdue = last
      ? Math.min(7, Math.floor((Date.now() - last) / 86400000))
      : 7;
    return (
      (days !== null && days >= 0 ? 40 / Math.max(1, days) : 0) +
      (100 - (accuracy ?? 40)) / 10 +
      overdue
    );
  };
  return materials
    .filter((m) => m.metadata.confirmed && m.metadata.topics?.length)
    .sort((a, b) => priority(b) - priority(a));
}

export function weeklyActivity(sessions: StudySession[], now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6 + index,
    );
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    const completed = sessions.filter(
      (s) =>
        s.completed_at &&
        Date.parse(s.completed_at) >= +day &&
        Date.parse(s.completed_at) < +next,
    );
    return {
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      practice: completed.filter((s) => s.mode === "practice").length,
      checkpoint: completed.filter((s) => s.mode === "checkpoint").length,
    };
  });
}
