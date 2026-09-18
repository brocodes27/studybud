import assert from "node:assert/strict";
import {
  daysToExam,
  independentAccuracy,
  normalizeTopics,
  recommendedMaterials,
  weeklyActivity,
  type Material,
  type StudySession,
} from "./model";
assert.deepEqual(normalizeTopics("Limits, Limits\nDerivatives\n "), [
  "Limits",
  "Derivatives",
]);
assert.equal(daysToExam("2026-02-30"), null);
assert.equal(daysToExam("2026-09-10", new Date(2026, 8, 8)), 2);
assert.equal(independentAccuracy([]), null);
const make = (
  mode: StudySession["mode"],
  assisted: boolean,
  correct: boolean,
): StudySession => ({
  id: "s",
  material_id: "m",
  mode,
  topic: "Limits",
  questions: [],
  answers: {},
  hints: [],
  created_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
  results: [
    {
      question_id: "q",
      correct,
      assisted,
      expected: "1",
      explanation: "",
      quote: "",
      page: 1,
    },
  ],
});
assert.equal(independentAccuracy([make("practice", false, true)]), null);
assert.equal(independentAccuracy([make("checkpoint", true, true)]), null);
assert.equal(
  independentAccuracy([
    make("checkpoint", false, true),
    make("checkpoint", false, false),
  ]),
  50,
);
assert.equal(weeklyActivity([make("practice", false, true)])[6]?.practice, 1);
const material: Material = {
  id: "m",
  title: "Notes",
  created_at: "",
  extracted_text: "",
  metadata: { confirmed: true, topics: ["Limits"] },
};
assert.equal(
  recommendedMaterials(
    [material, { ...material, id: "unconfirmed", metadata: { topics: ["X"] } }],
    [],
  ).length,
  1,
);
console.log(
  "Learning model: topic deduplication, calendar dates, independent evidence, activity and queue passed.",
);

assert.equal(normalizeTopics("x".repeat(201))[0].length, 200);
assert.equal(
  normalizeTopics(Array.from({ length: 31 }, (_, i) => `Topic ${i}`).join("\n"))
    .length,
  30,
);
