import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  buildRubric,
  isCrossSubject,
  CROSS_SUBJECT_BONUS,
  type EncodingContext,
} from './encodingRubric.ts';

const GOOD = { organize: 4, simplify: 4, connect: 4, analogize: 4, feedback: 'Solid.', weakest: 'connect' };

function context(overrides: Partial<EncodingContext> = {}): EncodingContext {
  return { courseCode: 'MATH 221', topic: 'Partial Derivatives', kind: 'concept_link', ...overrides };
}

test('the score is the mean of the four dimensions', () => {
  const rubric = buildRubric({ ...GOOD, organize: 5, simplify: 3, connect: 2, analogize: 2 }, false);
  assert.equal(rubric.score, 3);
});

test('a malformed response scores zero rather than passing by accident', () => {
  // The gate reads `score`; a model that returns prose, nulls, or nothing at
  // all must never be what advances a student.
  const rubric = buildRubric({}, false);
  assert.equal(rubric.score, 0);
  assert.equal(rubric.organize, 0);

  const garbage = buildRubric(
    { organize: 'excellent', simplify: null, connect: undefined, analogize: NaN },
    false,
  );
  assert.equal(garbage.score, 0);
});

test('out-of-range dimensions are clamped, not trusted', () => {
  const rubric = buildRubric({ organize: 99, simplify: -4, connect: 5, analogize: 5 }, false);
  assert.equal(rubric.organize, 5);
  assert.equal(rubric.simplify, 0);
});

test('a cross-subject link earns its bonus, capped at 5', () => {
  const plain = buildRubric(GOOD, false);
  const crossed = buildRubric(GOOD, true);
  assert.equal(crossed.connect, plain.connect + CROSS_SUBJECT_BONUS);
  assert.ok(crossed.score > plain.score);

  const maxed = buildRubric({ ...GOOD, connect: 5 }, true);
  assert.equal(maxed.connect, 5);
});

test('only a link into another course counts as cross-subject', () => {
  assert.equal(isCrossSubject(context({ linkedSubject: 'CHEM 104' })), true);
  assert.equal(isCrossSubject(context({ linkedSubject: 'MATH 221' })), false);
  assert.equal(isCrossSubject(context({ linkedSubject: null })), false);
  // Only concept links can be cross-subject at all.
  assert.equal(
    isCrossSubject(context({ kind: 'explanation', linkedSubject: 'CHEM 104' })),
    false,
  );
});

test('the weakest dimension falls back to arithmetic when the model names nonsense', () => {
  const named = buildRubric({ ...GOOD, weakest: 'simplify' }, false);
  assert.equal(named.weakest, 'simplify');

  const nonsense = buildRubric(
    { organize: 4, simplify: 4, connect: 1, analogize: 4, weakest: 'vibes' },
    false,
  );
  assert.equal(nonsense.weakest, 'connect');

  const missing = buildRubric({ organize: 1, simplify: 4, connect: 4, analogize: 4 }, false);
  assert.equal(missing.weakest, 'organize');
});

test('feedback is capped so a runaway response cannot flood the UI', () => {
  const rubric = buildRubric({ ...GOOD, feedback: 'x'.repeat(1000) }, false);
  assert.equal(rubric.feedback.length, 400);
});

test('the passing threshold sits where a restated-notes answer fails', () => {
  // Restating notes: structured because the source was, but nothing else.
  const restated = buildRubric(
    { organize: 3, simplify: 1, connect: 1, analogize: 1, weakest: 'simplify' },
    false,
  );
  assert.ok(restated.score < 3, 'restating notes must not clear the gate');

  const processed = buildRubric(
    { organize: 3, simplify: 3, connect: 3, analogize: 3, weakest: 'connect' },
    false,
  );
  assert.ok(processed.score >= 3);
});
