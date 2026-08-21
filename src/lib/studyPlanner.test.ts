import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { addDays, emptyTopicStage, type TopicStage } from './perirO.ts';
import {
  buildInterleaveBlock,
  examProximityFactor,
  inPrimingWindow,
  leverageOf,
  planDay,
  PLANNER_LIMITS,
  type PlannerTopic,
} from './studyPlanner.ts';

const TODAY = '2026-09-14';

let seq = 0;

function topic(overrides: Partial<PlannerTopic> = {}): PlannerTopic {
  seq += 1;
  return {
    topicId: `topic-${seq}`,
    enrollmentId: 'enr-1',
    subject: 'MATH 221',
    title: `Topic ${seq}`,
    kcId: `kc-${seq}`,
    stage: emptyTopicStage(),
    pMastery: 0.5,
    componentWeightPct: 20,
    topicsInComponent: 4,
    lectureOn: null,
    examOn: null,
    competitiveMode: false,
    ...overrides,
  };
}

function stage(partial: Partial<TopicStage>): TopicStage {
  return { ...emptyTopicStage(), ...partial };
}

/* --------------------------------------------------------------- scoring -- */

test('exam proximity ramps to double weight on the exam date', () => {
  assert.equal(examProximityFactor(TODAY, null), 1);
  assert.equal(examProximityFactor(TODAY, addDays(TODAY, 60)), 1);
  assert.equal(examProximityFactor(TODAY, TODAY), 2);
  // Past exams stop pulling.
  assert.equal(examProximityFactor(TODAY, addDays(TODAY, -3)), 1);
});

test('leverage splits a component weight across the topics that feed it', () => {
  const concentrated = topic({ componentWeightPct: 40, topicsInComponent: 1 });
  const diluted = topic({ componentWeightPct: 40, topicsInComponent: 10 });
  assert.ok(leverageOf(concentrated, 'encode', TODAY) > leverageOf(diluted, 'encode', TODAY));
});

test('a heavier component outranks a lighter one at the same stage', () => {
  const finalExam = topic({ componentWeightPct: 40 });
  const participation = topic({ componentWeightPct: 5 });
  assert.ok(leverageOf(finalExam, 'encode', TODAY) > leverageOf(participation, 'encode', TODAY));
});

/* ----------------------------------------------------------- queue shape -- */

test('the queue never exceeds three actions', () => {
  const topics = Array.from({ length: 12 }, (_, i) =>
    topic({ subject: `SUBJ ${i}`, stage: stage({ stage: 'primed' }) }),
  );
  const plan = planDay({ today: TODAY, topics });
  assert.equal(plan.actions.length, PLANNER_LIMITS.maxActions);
});

test('a six-subject load never returns a queue from a single subject', () => {
  // Ten Calculus topics, all high-weight; two other subjects with lighter work.
  const topics = [
    ...Array.from({ length: 10 }, () =>
      topic({ subject: 'MATH 221', componentWeightPct: 40, stage: stage({ stage: 'primed' }) }),
    ),
    topic({ subject: 'CHEM 104', componentWeightPct: 10, stage: stage({ stage: 'primed' }) }),
    topic({ subject: 'PHYS 211', componentWeightPct: 10, stage: stage({ stage: 'primed' }) }),
  ];

  const plan = planDay({ today: TODAY, topics });
  const math = plan.actions.filter((action) => action.subject === 'MATH 221');
  assert.equal(math.length, PLANNER_LIMITS.maxPerSubject);
  assert.equal(new Set(plan.actions.map((a) => a.subject)).size, 2);
});

test('an imminent lecture outranks a higher-leverage encode', () => {
  const topics = [
    topic({
      subject: 'CHEM 104',
      componentWeightPct: 50,
      topicsInComponent: 1,
      stage: stage({ stage: 'primed' }),
    }),
    topic({
      subject: 'MATH 221',
      componentWeightPct: 2,
      topicsInComponent: 20,
      lectureOn: addDays(TODAY, 1),
    }),
  ];

  const plan = planDay({ today: TODAY, topics });
  assert.equal(plan.actions[0]?.action, 'prime');
  assert.equal(plan.actions[0]?.subject, 'MATH 221');
  assert.equal(plan.actions[0]?.forced, true);
  assert.equal(plan.actions[0]?.why, 'Lecture is tomorrow');
});

test('the priming override is capped so it cannot fill the whole queue', () => {
  const topics = Array.from({ length: 5 }, (_, i) =>
    topic({ subject: `SUBJ ${i}`, lectureOn: addDays(TODAY, 1) }),
  );
  const plan = planDay({ today: TODAY, topics });
  const primes = plan.actions.filter((action) => action.action === 'prime');
  assert.equal(primes.length, PLANNER_LIMITS.maxPrimingOverrides);
});

test('a lecture outside the window does not force priming', () => {
  const far = topic({ lectureOn: addDays(TODAY, 9) });
  assert.equal(inPrimingWindow(far, TODAY), false);
  // A lecture that already happened is past priming — it needs encoding instead.
  assert.equal(inPrimingWindow(topic({ lectureOn: addDays(TODAY, -1) }), TODAY), false);
});

test('reviews due today are forced into the queue', () => {
  const topics = [
    topic({
      subject: 'PHYS 211',
      stage: stage({ stage: 'retrieved', nextRetrievalOn: TODAY, retrievalStreak: 3 }),
    }),
    topic({ subject: 'MATH 221', componentWeightPct: 50, stage: stage({ stage: 'primed' }) }),
  ];

  const plan = planDay({ today: TODAY, topics });
  const review = plan.actions.find((action) => action.subject === 'PHYS 211');
  assert.equal(review?.action, 'retrieve');
  assert.equal(review?.forced, true);
  assert.equal(review?.why, 'Review 4 — due today');
});

test('the minute budget trims ranked work but never time-critical work', () => {
  const topics = [
    topic({ subject: 'MATH 221', lectureOn: TODAY }),
    topic({ subject: 'CHEM 104', componentWeightPct: 50, stage: stage({ stage: 'primed' }) }),
    topic({ subject: 'PHYS 211', componentWeightPct: 50, stage: stage({ stage: 'primed' }) }),
  ];

  // 10 minutes only fits the 6-minute priming; the 18-minute encodes are cut.
  const plan = planDay({ today: TODAY, topics, minuteBudget: 10 });
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0]?.action, 'prime');
  assert.equal(plan.totalMinutes, 6);
});

test('a remedial topic is sent back to encoding, not tested again', () => {
  const topics = [
    topic({ stage: stage({ stage: 'retrieved', remedial: true, nextRetrievalOn: TODAY }) }),
  ];
  const plan = planDay({ today: TODAY, topics });
  assert.equal(plan.actions[0]?.action, 'encode');
  assert.match(plan.actions[0]?.why ?? '', /faded/);
});

test('topics with nothing to do produce an empty queue rather than filler', () => {
  const topics = [
    topic({ stage: stage({ stage: 'interleaved', nextRetrievalOn: addDays(TODAY, 20) }) }),
    topic({ stage: stage({ stage: 'overlearned', nextRetrievalOn: addDays(TODAY, 30) }) }),
  ];
  const plan = planDay({ today: TODAY, topics });
  assert.equal(plan.actions.length, 0);
  assert.equal(plan.totalMinutes, 0);
});

/* ------------------------------------------------------------ overlearning -- */

test('an exam next week does not conjure overlearning for unready topics', () => {
  const topics = Array.from({ length: 4 }, () =>
    topic({ stage: stage({ stage: 'referenced' }), examOn: addDays(TODAY, 5) }),
  );
  const plan = planDay({ today: TODAY, topics });
  assert.equal(plan.actions.some((action) => action.action === 'overlearn'), false);
  assert.equal(plan.actions.every((action) => action.action === 'retrieve'), true);
});

test('overlearning appears once a topic is interleaved and an exam is close', () => {
  const topics = [
    topic({ stage: stage({ stage: 'interleaved' }), examOn: addDays(TODAY, 5) }),
  ];
  const plan = planDay({ today: TODAY, topics });
  assert.equal(plan.actions[0]?.action, 'overlearn');
  assert.equal(plan.actions[0]?.why, 'Exam in 5 days — build speed');
});

/* -------------------------------------------------------------- interleave -- */

test('the interleave block needs enough ready topics across enough subjects', () => {
  const readyOneSubject = Array.from({ length: 8 }, () =>
    topic({ subject: 'MATH 221', stage: stage({ stage: 'retrieved' }) }),
  );
  assert.equal(buildInterleaveBlock(readyOneSubject, []), null);

  const tooFew = Array.from({ length: 4 }, (_, i) =>
    topic({ subject: i % 2 ? 'MATH 221' : 'CHEM 104', stage: stage({ stage: 'retrieved' }) }),
  );
  assert.equal(buildInterleaveBlock(tooFew, []), null);
});

test('the interleave block spans subjects and skips topics already in the queue', () => {
  const topics = Array.from({ length: 8 }, (_, i) =>
    topic({
      subject: i % 2 ? 'MATH 221' : 'CHEM 104',
      stage: stage({ stage: 'retrieved', nextRetrievalOn: addDays(TODAY, 10) }),
    }),
  );

  const plan = planDay({ today: TODAY, topics });
  assert.ok(plan.interleave);
  assert.equal(plan.interleave!.subjects.length, 2);
  assert.equal(plan.interleave!.topicIds.length, 8);
  assert.equal(plan.actions.length, 0);

  // A topic pulled into today's queue is not also mixed into the same set.
  const busy = [topics[0]!.topicId];
  const block = buildInterleaveBlock(
    topics,
    busy.map((topicId) => ({
      topicId,
      enrollmentId: 'enr-1',
      subject: 'CHEM 104',
      title: 'x',
      action: 'retrieve' as const,
      minutes: 12,
      leverage: 1,
      why: 'x',
      forced: false,
    })),
  );
  assert.equal(block!.topicIds.includes(busy[0]!), false);
});

test('remedial and unmapped topics are excluded from the mix', () => {
  const topics = [
    ...Array.from({ length: 6 }, (_, i) =>
      topic({ subject: i % 2 ? 'MATH 221' : 'CHEM 104', stage: stage({ stage: 'retrieved' }) }),
    ),
    topic({ subject: 'PHYS 211', stage: stage({ stage: 'retrieved', remedial: true }) }),
    topic({ subject: 'PHYS 211', kcId: null, stage: stage({ stage: 'retrieved' }) }),
  ];

  const block = buildInterleaveBlock(topics, []);
  assert.equal(block!.topicIds.length, 6);
  assert.equal(block!.subjects.includes('PHYS 211'), false);
});
