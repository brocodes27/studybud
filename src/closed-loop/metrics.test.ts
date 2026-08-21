import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateExpectedSubmissions,
  calculateAssignmentProgress,
  calculateMasteryPerMinute,
  summarizeVerifiedMastery,
  gapAssigneesFromKnowledge,
  sanitizeDraftQuestions,
  submissionNeedsHumanReview,
} from './metrics';

test('targeted assignments count only their intended audience', () => {
  const expected = calculateExpectedSubmissions(
    [
      { assignee_ids: [] },
      { assignee_ids: ['student-a'] },
      { assignee_ids: ['student-a', 'student-b'] },
    ],
    30,
  );
  assert.equal(expected, 33);
});

test('assignment progress respects targeted audiences and caps duplicate evidence', () => {
  const progress = calculateAssignmentProgress(
    [
      { id: 'whole', assignee_ids: [] },
      { id: 'targeted', assignee_ids: ['a', 'b'] },
    ],
    [
      { assignment_id: 'whole' },
      { assignment_id: 'targeted' },
      { assignment_id: 'targeted' },
      { assignment_id: 'targeted' },
    ],
    5,
  );
  assert.deepEqual(
    progress.map(({ id, expected, submitted, percent }) => ({ id, expected, submitted, percent })),
    [
      { id: 'whole', expected: 5, submitted: 1, percent: 20 },
      { id: 'targeted', expected: 2, submitted: 3, percent: 100 },
    ],
  );
});

test('human review queue excludes submissions with a completed assessment', () => {
  assert.equal(submissionNeedsHumanReview({ assignment_id: 'a' }), true);
  assert.equal(submissionNeedsHumanReview({ assignment_id: 'a', graded_at: '2026-07-16' }), false);
});

test('human review queue keeps AI-flagged or weak-evidence notebook work visible', () => {
  assert.equal(
    submissionNeedsHumanReview({
      assignment_id: 'a',
      graded_at: '2026-07-16',
      feedback: 'The attached work is queued for visual review.',
      assessment_details: { evidence_quality: 0.2 },
    }),
    true,
  );
  assert.equal(
    submissionNeedsHumanReview({
      assignment_id: 'b',
      graded_at: '2026-07-16',
      feedback: 'AI assessment complete.',
      assessment_details: { evidence_quality: 0.4 },
    }),
    true,
  );
});

test('mastery per minute ignores unmeasured sessions', () => {
  const result = calculateMasteryPerMinute([
    { duration_seconds: 600, mastery_delta: 0.1 },
    { duration_seconds: 300, mastery_delta: 0.05 },
    { duration_seconds: 120, mastery_delta: null },
  ]);
  assert.ok(result !== null && Math.abs(result - 1) < 1e-10);
});

test('mastery per minute is null without comparable evidence', () => {
  assert.equal(
    calculateMasteryPerMinute([{ duration_seconds: 300, mastery_delta: null }]),
    null,
  );
});

test('verified mastery only uses comparable high-quality assessments', () => {
  const summary = summarizeVerifiedMastery([
    { duration_seconds: 300, mastery_delta: 0.2, mastery_after: 0.8, evidence_quality: 0.8 },
    { duration_seconds: 300, mastery_delta: -0.1, mastery_after: 0.6, evidence_quality: 0.7 },
    { duration_seconds: 300, mastery_delta: 0.4, mastery_after: 1, evidence_quality: 0.4 },
  ]);
  assert.deepEqual(summary, { score: 70, evidenceCount: 2, improvedCount: 1 });
});

test('gap group picks students below confidence on matching topic', () => {
  const ids = gapAssigneesFromKnowledge(
    [
      { user_id: 'a', topic: 'Linear equations', confidence: 0.4 },
      { user_id: 'b', topic: 'Linear equations', confidence: 0.9 },
      { user_id: 'c', topic: 'Fractions', confidence: 0.2 },
      { user_id: 'd', topic: 'linear', confidence: 0.5 },
    ],
    'Linear equations',
  );
  assert.deepEqual(ids.sort(), ['a', 'd']);
});

test('gap group supports assignments spanning multiple concepts', () => {
  const ids = gapAssigneesFromKnowledge(
    [
      { user_id: 'a', topic: 'Linear equations', confidence: 0.4 },
      { user_id: 'b', topic: 'Fractions', confidence: 0.5 },
      { user_id: 'c', topic: 'Circles', confidence: 0.2 },
    ],
    ['Linear equations', 'Fractions'],
  );
  assert.deepEqual(ids.sort(), ['a', 'b']);
});

test('draft question sanitize drops answer keys', () => {
  const sanitized = sanitizeDraftQuestions([
    {
      id: 'q1',
      question: 'Solve 2x = 4',
      correct_answer: 'x = 2',
      explanation: 'Divide both sides by 2',
      options: ['x=1', 'x=2'],
      difficulty: 'easy',
      topic: 'Algebra',
    },
  ]);
  assert.equal(sanitized.length, 1);
  assert.equal(sanitized[0].question, 'Solve 2x = 4');
  assert.deepEqual(sanitized[0].options, ['x=1', 'x=2']);
  assert.equal('correct_answer' in sanitized[0], false);
  assert.equal('explanation' in sanitized[0], false);
});
