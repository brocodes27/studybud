import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { addDays, emptyTopicStage, type Stage, type TopicStage } from '../lib/perirO.ts';
import type { PlannerTopic } from '../lib/studyPlanner.ts';
import { countByStage, groupBySubject, matchesFilter, WEEK_WINDOW } from './stageMapView.ts';

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

test('the week filter keeps the window either side of today', () => {
  const inside = topic({ lectureOn: addDays(TODAY, WEEK_WINDOW) });
  const outside = topic({ lectureOn: addDays(TODAY, WEEK_WINDOW + 1) });
  const lastWeek = topic({ lectureOn: addDays(TODAY, -WEEK_WINDOW) });
  const longAgo = topic({ lectureOn: addDays(TODAY, -WEEK_WINDOW - 1) });

  assert.equal(matchesFilter(inside, 'week', TODAY), true);
  assert.equal(matchesFilter(outside, 'week', TODAY), false);
  assert.equal(matchesFilter(lastWeek, 'week', TODAY), true);
  assert.equal(matchesFilter(longAgo, 'week', TODAY), false);
});

test('unscheduled topics never disappear behind the week filter', () => {
  // A syllabus with no weekly schedule gives every topic a null lecture date.
  // Filtering those out would hide the whole course, permanently.
  assert.equal(matchesFilter(topic({ lectureOn: null }), 'week', TODAY), true);
});

test('the attention filter catches remediation and overdue reviews', () => {
  const remedial = topic({ stage: stage({ stage: 'retrieved', remedial: true }) });
  const dueToday = topic({ stage: stage({ stage: 'retrieved', nextRetrievalOn: TODAY }) });
  const overdue = topic({
    stage: stage({ stage: 'retrieved', nextRetrievalOn: addDays(TODAY, -4) }),
  });
  const healthy = topic({
    stage: stage({ stage: 'retrieved', nextRetrievalOn: addDays(TODAY, 6) }),
  });
  const untouched = topic();

  assert.equal(matchesFilter(remedial, 'attention', TODAY), true);
  assert.equal(matchesFilter(dueToday, 'attention', TODAY), true);
  assert.equal(matchesFilter(overdue, 'attention', TODAY), true);
  assert.equal(matchesFilter(healthy, 'attention', TODAY), false);
  assert.equal(matchesFilter(untouched, 'attention', TODAY), false);
});

test('the all filter keeps everything', () => {
  assert.equal(matchesFilter(topic({ lectureOn: addDays(TODAY, 400) }), 'all', TODAY), true);
});

test('subjects group alphabetically and topics keep their syllabus order', () => {
  const topics = [
    topic({ subject: 'PHYS 211', title: 'Kinematics' }),
    topic({ subject: 'CHEM 104', title: 'Bonding' }),
    topic({ subject: 'PHYS 211', title: 'Dynamics' }),
  ];

  const grouped = groupBySubject(topics);
  assert.deepEqual(
    grouped.map(([subject]) => subject),
    ['CHEM 104', 'PHYS 211'],
  );
  assert.deepEqual(
    grouped[1]![1].map((entry) => entry.title),
    ['Kinematics', 'Dynamics'],
  );
});

test('the headline counts are cumulative up the stage order', () => {
  const stages: Stage[] = [
    'new',
    'primed',
    'encoded',
    'referenced',
    'retrieved',
    'interleaved',
    'overlearned',
  ];
  const topics = stages.map((value) => topic({ stage: stage({ stage: value }) }));

  const totals = countByStage(topics);
  assert.equal(totals.started, 6, 'everything except the untouched topic');
  assert.equal(totals.tested, 3, 'retrieved, interleaved, overlearned');
  assert.equal(totals.mixed, 2, 'interleaved and overlearned');
});

test('an empty map counts to zero rather than throwing', () => {
  assert.deepEqual(countByStage([]), { started: 0, tested: 0, mixed: 0 });
  assert.deepEqual(groupBySubject([]), []);
});
