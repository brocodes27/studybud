import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  addDays,
  applyCompletion,
  applyDecay,
  canOverlearn,
  daysBetween,
  emptyTopicStage,
  evaluateGate,
  isRetrievalDue,
  lectureDateFor,
  nextAction,
  RETRIEVAL_INTERVALS,
  scheduleNextRetrieval,
  STAGE_GATES,
  weekStartOn,
  type GateEvidence,
  type StageAction,
  type TopicStage,
} from './perirO.ts';

const TODAY = '2026-09-14';

function stageAt(stage: TopicStage['stage'], overrides: Partial<TopicStage> = {}): TopicStage {
  return { ...emptyTopicStage(), stage, ...overrides };
}

function complete(
  state: TopicStage,
  action: StageAction,
  evidence: GateEvidence,
  examOn: string | null = null,
): TopicStage {
  return applyCompletion(state, action, evidence, { today: TODAY, examOn });
}

/* ------------------------------------------------------------------ dates -- */

test('lecture dates derive from the term start and the topic week', () => {
  assert.equal(lectureDateFor('2026-09-07', 1), '2026-09-07');
  assert.equal(lectureDateFor('2026-09-07', 3), '2026-09-21');
  // No term start means no schedule, so the priming window can never fire.
  assert.equal(lectureDateFor(null, 3), null);
  assert.equal(lectureDateFor('2026-09-07', null), null);
});

test('the week start is the Monday, including for a Sunday', () => {
  // 2026-09-14 is a Monday.
  assert.equal(weekStartOn('2026-09-14'), '2026-09-14');
  assert.equal(weekStartOn('2026-09-16'), '2026-09-14');
  assert.equal(weekStartOn('2026-09-20'), '2026-09-14', 'Sunday belongs to the week that began');
  assert.equal(weekStartOn('2026-09-21'), '2026-09-21');
  // Crossing a month backwards.
  assert.equal(weekStartOn('2026-10-01'), '2026-09-28');
});

test('date arithmetic crosses a month boundary without drifting', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(daysBetween('2026-09-14', '2026-09-21'), 7);
  assert.equal(daysBetween('2026-09-21', '2026-09-14'), -7);
});

/* ------------------------------------------------------------------ gates -- */

test('priming needs the student to write questions, not just read the primer', () => {
  const state = stageAt('new');
  assert.equal(evaluateGate(state, 'prime', { primingQuestions: 0 }).passed, false);
  assert.equal(evaluateGate(state, 'prime', { primingQuestions: 2 }).passed, false);
  assert.equal(
    evaluateGate(state, 'prime', { primingQuestions: STAGE_GATES.primingQuestionsMin }).passed,
    true,
  );
});

test('encoding needs a scored artifact', () => {
  const state = stageAt('primed');
  assert.equal(evaluateGate(state, 'encode', {}).passed, false);
  assert.equal(evaluateGate(state, 'encode', { rubricScore: 2.5 }).passed, false);
  assert.equal(evaluateGate(state, 'encode', { rubricScore: 3 }).passed, true);
});

test('reference needs enough accepted cards', () => {
  const state = stageAt('encoded');
  assert.equal(evaluateGate(state, 'reference', { acceptedCards: 4 }).passed, false);
  assert.equal(evaluateGate(state, 'reference', { acceptedCards: 5 }).passed, true);
});

test('retrieval needs both a real session and real mastery', () => {
  const state = stageAt('referenced');
  // Enough mastery but too few items — a three-question session proves nothing.
  assert.equal(evaluateGate(state, 'retrieve', { items: 4, pMastery: 0.9 }).passed, false);
  // Enough items but mastery still low.
  assert.equal(evaluateGate(state, 'retrieve', { items: 12, pMastery: 0.4 }).passed, false);
  assert.equal(evaluateGate(state, 'retrieve', { items: 12, pMastery: 0.6 }).passed, true);
});

test('interleaving needs multiple subjects, repeat appearances, accuracy and mastery', () => {
  const base = stageAt('retrieved', { interleaveAppearances: 2 });
  const good: GateEvidence = { subjectsInSet: 2, accuracy: 0.8, pMastery: 0.8 };

  assert.equal(evaluateGate(base, 'interleave', good).passed, true);
  // A single-subject set is blocked practice wearing a costume.
  assert.equal(evaluateGate(base, 'interleave', { ...good, subjectsInSet: 1 }).passed, false);
  assert.equal(
    evaluateGate(stageAt('retrieved', { interleaveAppearances: 1 }), 'interleave', good).passed,
    false,
  );
  assert.equal(evaluateGate(base, 'interleave', { ...good, accuracy: 0.5 }).passed, false);
  assert.equal(evaluateGate(base, 'interleave', { ...good, pMastery: 0.7 }).passed, false);
});

test('overlearning scores fluency, not only accuracy', () => {
  const base = stageAt('interleaved', { overlearnDrills: 3, baselineResponseMs: 10_000 });

  assert.equal(
    evaluateGate(base, 'overlearn', { accuracy: 0.95, medianResponseMs: 5_000 }).passed,
    true,
  );
  // Accurate but no faster than the baseline: not fluent.
  assert.equal(
    evaluateGate(base, 'overlearn', { accuracy: 0.95, medianResponseMs: 9_000 }).passed,
    false,
  );
  assert.equal(
    evaluateGate(base, 'overlearn', { accuracy: 0.8, medianResponseMs: 4_000 }).passed,
    false,
  );
  // Too few drills, however good this one was.
  assert.equal(
    evaluateGate(stageAt('interleaved', { overlearnDrills: 1, baselineResponseMs: 10_000 }), 'overlearn', {
      accuracy: 1,
      medianResponseMs: 1_000,
    }).passed,
    false,
  );
});

test('an action cannot advance a topic that has not cleared the stage before it', () => {
  // The core rule: drilling something never encoded gets you nowhere.
  const unencoded = stageAt('primed');
  const result = evaluateGate(unencoded, 'retrieve', { items: 50, pMastery: 0.99 });
  assert.equal(result.passed, false);
  assert.match(result.reason, /primed/);
});

/* ------------------------------------------------------------ transitions -- */

test('a full pass through the six stages lands on overlearned', () => {
  let state = stageAt('new');

  state = complete(state, 'prime', { primingQuestions: 4 });
  assert.equal(state.stage, 'primed');

  state = complete(state, 'encode', { rubricScore: 4 });
  assert.equal(state.stage, 'encoded');

  state = complete(state, 'reference', { acceptedCards: 8 });
  assert.equal(state.stage, 'referenced');

  state = complete(state, 'retrieve', { items: 12, accuracy: 0.8, pMastery: 0.6 });
  assert.equal(state.stage, 'retrieved');
  assert.equal(state.retrievalStreak, 1);
  assert.equal(state.nextRetrievalOn, addDays(TODAY, RETRIEVAL_INTERVALS[1]!));

  const mixed: GateEvidence = { subjectsInSet: 3, accuracy: 0.8, pMastery: 0.8 };
  state = complete(state, 'interleave', mixed);
  // First mixed set only accumulates evidence — one appearance is not enough.
  assert.equal(state.stage, 'retrieved');
  assert.equal(state.interleaveAppearances, 1);

  state = complete(state, 'interleave', mixed);
  assert.equal(state.stage, 'interleaved');

  const drill: GateEvidence = { accuracy: 0.95, medianResponseMs: 4_000 };
  state = complete(state, 'overlearn', { ...drill, medianResponseMs: 10_000 });
  assert.equal(state.baselineResponseMs, 10_000);
  state = complete(state, 'overlearn', drill);
  state = complete(state, 'overlearn', drill);
  assert.equal(state.stage, 'overlearned');
});

test('replaying a completion does not advance the stage twice or rewrite timestamps', () => {
  const first = complete(stageAt('primed'), 'encode', { rubricScore: 4 });
  assert.equal(first.stage, 'encoded');

  const replayed = applyCompletion(first, 'encode', { rubricScore: 4 }, {
    today: '2026-12-25',
    examOn: null,
  });
  assert.equal(replayed.stage, 'encoded');
  // The timestamp is when the stage was actually cleared, not when a duplicate
  // event happened to arrive.
  assert.equal(replayed.encodedAt, first.encodedAt);
});

test('the speed baseline is set once and never overwritten by a later drill', () => {
  let state = stageAt('interleaved');
  state = complete(state, 'overlearn', { accuracy: 0.9, medianResponseMs: 12_000 });
  state = complete(state, 'overlearn', { accuracy: 0.9, medianResponseMs: 3_000 });
  assert.equal(state.baselineResponseMs, 12_000);
});

/* -------------------------------------------------------------- retrieval -- */

test('a weak retrieval session repeats its interval instead of advancing', () => {
  const state = stageAt('retrieved', { retrievalStreak: 2 });
  const weak = scheduleNextRetrieval(state, 0.4, { today: TODAY });
  assert.equal(weak.retrievalStreak, 2);
  assert.equal(weak.nextRetrievalOn, addDays(TODAY, RETRIEVAL_INTERVALS[2]!));

  const strong = scheduleNextRetrieval(state, 0.9, { today: TODAY });
  assert.equal(strong.retrievalStreak, 3);
  assert.equal(strong.nextRetrievalOn, addDays(TODAY, RETRIEVAL_INTERVALS[3]!));
});

test('the interval ladder saturates at its last rung', () => {
  const state = stageAt('retrieved', { retrievalStreak: RETRIEVAL_INTERVALS.length - 1 });
  const result = scheduleNextRetrieval(state, 1, { today: TODAY });
  assert.equal(result.retrievalStreak, RETRIEVAL_INTERVALS.length - 1);
});

test('retrieval is clamped to land before an exam it feeds', () => {
  const state = stageAt('retrieved', { retrievalStreak: 3 }); // would schedule 35 days out
  const examOn = addDays(TODAY, 10);
  const result = scheduleNextRetrieval(state, 0.9, { today: TODAY, examOn });
  assert.equal(result.nextRetrievalOn, addDays(examOn, -2));
});

test('an exam sooner than the next interval does not pull retrieval into the past', () => {
  const state = stageAt('retrieved', { retrievalStreak: 3 });
  const examOn = addDays(TODAY, 1); // exam tomorrow: clamping would land yesterday
  const result = scheduleNextRetrieval(state, 0.9, { today: TODAY, examOn });
  assert.ok(daysBetween(TODAY, result.nextRetrievalOn) > 0);
});

test('retrieval due-ness includes today', () => {
  assert.equal(isRetrievalDue(stageAt('retrieved', { nextRetrievalOn: TODAY }), TODAY), true);
  assert.equal(
    isRetrievalDue(stageAt('retrieved', { nextRetrievalOn: addDays(TODAY, 1) }), TODAY),
    false,
  );
  assert.equal(isRetrievalDue(stageAt('retrieved'), TODAY), false);
});

/* ------------------------------------------------------------------ decay -- */

test('faded mastery comes due today; collapsed mastery goes back to encoding', () => {
  const state = stageAt('retrieved', { nextRetrievalOn: addDays(TODAY, 20) });

  const healthy = applyDecay(state, 0.7, TODAY);
  assert.equal(healthy.nextRetrievalOn, addDays(TODAY, 20));
  assert.equal(healthy.remedial, false);

  const faded = applyDecay(state, 0.3, TODAY);
  assert.equal(faded.nextRetrievalOn, TODAY);
  assert.equal(faded.remedial, false);

  const collapsed = applyDecay(state, 0.1, TODAY);
  assert.equal(collapsed.remedial, true);
  // The stage itself never regresses — the map stays honest.
  assert.equal(collapsed.stage, 'retrieved');
});

test('decay does not touch topics that were never retrieved', () => {
  const state = stageAt('encoded');
  assert.deepEqual(applyDecay(state, 0.01, TODAY), state);
});

test('clearing an encoding rubric lifts remediation', () => {
  const state = stageAt('retrieved', { remedial: true });
  const after = complete(state, 'encode', { rubricScore: 4 });
  assert.equal(after.remedial, false);
  // It stays at retrieved: the stage is the high-water mark, not the current task.
  assert.equal(after.stage, 'retrieved');
});

/* ----------------------------------------------------------------- policy -- */

test('overlearning never unlocks below interleaved, however close the exam', () => {
  for (const stage of ['new', 'primed', 'encoded', 'referenced', 'retrieved'] as const) {
    assert.equal(
      canOverlearn({ stage, daysToExam: 0, competitiveMode: true }),
      false,
      `${stage} must not unlock overlearning`,
    );
  }
});

test('overlearning opens inside the exam window or in competitive mode', () => {
  assert.equal(canOverlearn({ stage: 'interleaved', daysToExam: 10, competitiveMode: false }), true);
  assert.equal(canOverlearn({ stage: 'interleaved', daysToExam: 30, competitiveMode: false }), false);
  assert.equal(canOverlearn({ stage: 'interleaved', daysToExam: null, competitiveMode: false }), false);
  assert.equal(canOverlearn({ stage: 'interleaved', daysToExam: null, competitiveMode: true }), true);
});

/* ----------------------------------------------------------- next action -- */

test('each stage asks for exactly one next thing', () => {
  const base = { today: TODAY, daysToExam: null, competitiveMode: false };
  assert.equal(nextAction({ ...base, state: stageAt('new') }), 'prime');
  assert.equal(nextAction({ ...base, state: stageAt('primed') }), 'encode');
  assert.equal(nextAction({ ...base, state: stageAt('encoded') }), 'reference');
  assert.equal(nextAction({ ...base, state: stageAt('referenced') }), 'retrieve');
  assert.equal(nextAction({ ...base, state: stageAt('retrieved') }), 'interleave');
  // Nothing due, no exam near: this topic rests.
  assert.equal(nextAction({ ...base, state: stageAt('interleaved') }), null);
  assert.equal(
    nextAction({ ...base, state: stageAt('interleaved'), daysToExam: 5 }),
    'overlearn',
  );
});

test('a due review outranks moving to the next stage', () => {
  const state = stageAt('interleaved', { nextRetrievalOn: TODAY });
  assert.equal(
    nextAction({ state, today: TODAY, daysToExam: 3, competitiveMode: true }),
    'retrieve',
  );
});

test('remediation outranks everything', () => {
  const state = stageAt('overlearned', { remedial: true, nextRetrievalOn: TODAY });
  assert.equal(nextAction({ state, today: TODAY, daysToExam: 1, competitiveMode: true }), 'encode');
});
