import assert from "node:assert/strict";
import test from "node:test";
import { sourcePages, validateQuestions, gradeChoices } from "./validation";

const pages = [
  {
    page: 4,
    text: "Photosynthesis converts light energy into chemical energy stored in glucose. Plants use carbon dioxide and water in this process.",
  },
];
const question = {
  topic: "Photosynthesis",
  question: "What does photosynthesis convert?",
  options: [
    "Light into chemical energy",
    "Heat into sound",
    "Glucose into light",
    "Water into nitrogen",
  ],
  correct_index: 0,
  explanation: "The source describes the conversion of light energy.",
  hint: "Think about the energy coming from the sun.",
  quote:
    "Photosynthesis converts light energy into chemical energy stored in glucose.",
  page: 4,
};
const raw = Array.from({ length: 3 }, (_, i) => ({
  ...question,
  question: `${question.question} (${i})`,
}));

test("rejects missing, oversized and fabricated sources", () => {
  assert.throws(() => sourcePages(null));
  assert.throws(() => sourcePages([{ page: 1, text: "x".repeat(300001) }]));
  assert.throws(() =>
    validateQuestions(
      raw.map((q) => ({ ...q, page: 12 })),
      pages,
    ),
  );
  assert.throws(() =>
    validateQuestions(
      raw.map((q) => ({
        ...q,
        quote: "This passage is completely fabricated.",
      })),
      pages,
    ),
  );
});
test("rejects incomplete keys and duplicate options", () => {
  assert.throws(() => validateQuestions(raw.slice(0, 1), pages));
  assert.throws(() =>
    validateQuestions(
      raw.map((q) => ({ ...q, correct_index: 4 })),
      pages,
    ),
  );
  assert.throws(() =>
    validateQuestions(
      raw.map((q) => ({ ...q, options: ["A", "B", "C", " A "] })),
      pages,
    ),
  );
});
test("grades against private keys and distinguishes hint use", () => {
  const keys = validateQuestions(raw, pages);
  assert.throws(() => gradeChoices(keys, { q1: 0 }, []));
  assert.throws(() => gradeChoices(keys, { q1: "0", q2: 0, q3: 0 }, []));
  const results = gradeChoices(keys, { q1: 0, q2: 1, q3: 0 }, ["q1"]);
  assert.deepEqual(
    results.map((r) => r.correct),
    [true, false, true],
  );
  assert.deepEqual(
    results.map((r) => r.assisted),
    [true, false, false],
  );
  assert.equal(results[1].expected, question.options[0]);
  assert.equal(results[0].page, 4);
});
