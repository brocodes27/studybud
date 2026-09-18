export interface Page {
  page: number;
  text: string;
}
export interface Key {
  id: string;
  topic: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  hint: string;
  quote: string;
  page: number;
}
export function sourcePages(value: unknown): Page[] {
  if (!Array.isArray(value)) throw new Error("Add readable material first.");
  const pages = value.filter((p): p is Page =>
    Boolean(
      p && Number.isInteger(p.page) && p.page > 0 && typeof p.text === "string",
    ),
  );
  if (
    !pages.length ||
    pages.length > 100 ||
    pages.reduce((n, p) => n + p.text.length, 0) > 300000
  )
    throw new Error("Use up to 100 pages and 300,000 characters per material.");
  return pages;
}
export function validateQuestions(raw: unknown, pages: Page[]): Key[] {
  if (!Array.isArray(raw) || raw.length < 3 || raw.length > 5)
    throw new Error(
      "Could not create a complete practice set. Please try again.",
    );
  return raw.map((q, index) => {
    const source = pages.find((p) => p.page === q.page);
    const quote = typeof q.quote === "string" ? q.quote.trim() : "";
    const normalized = (s: string) =>
      s.replace(/\s+/g, " ").trim().toLowerCase();
    if (
      !source ||
      quote.length < 20 ||
      !normalized(source.text).includes(normalized(quote)) ||
      typeof q.question !== "string" ||
      q.question.length < 10 ||
      q.question.length > 1500 ||
      typeof q.topic !== "string" ||
      !q.topic.trim() ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      q.options.some(
        (s: unknown) => typeof s !== "string" || !s.trim() || s.length > 700,
      ) ||
      new Set(q.options.map(normalized)).size !== 4 ||
      !Number.isInteger(q.correct_index) ||
      q.correct_index < 0 ||
      q.correct_index > 3 ||
      typeof q.explanation !== "string" ||
      typeof q.hint !== "string"
    )
      throw new Error(
        "Source verification failed for a question. Nothing was scored; please try again.",
      );
    return {
      id: `q${index + 1}`,
      topic: q.topic.slice(0, 200),
      question: q.question,
      options: q.options,
      correct_index: q.correct_index,
      explanation: q.explanation.slice(0, 2000),
      hint: q.hint.slice(0, 500),
      quote,
      page: q.page,
    };
  });
}
export function gradeChoices(
  keys: Key[],
  answers: Record<string, unknown>,
  hints: string[],
) {
  if (
    keys.some(
      (k) =>
        !Number.isInteger(answers[k.id]) ||
        Number(answers[k.id]) < 0 ||
        Number(answers[k.id]) > 3,
    )
  )
    throw new Error("Answer every question before submitting.");
  return keys.map((k) => ({
    question_id: k.id,
    correct: answers[k.id] === k.correct_index,
    expected: k.options[k.correct_index],
    explanation: k.explanation,
    quote: k.quote,
    page: k.page,
    assisted: hints.includes(k.id),
  }));
}
