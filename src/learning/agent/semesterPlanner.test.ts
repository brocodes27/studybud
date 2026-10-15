import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSemesterSchedule, localDate, semesterExamTimeline, plannedSessionContext } from './semesterPlanner';
import type { EnlistedExam, SemesterPlan } from './contracts';
const now = new Date(2026, 9, 15, 10);
const exam = (id: string, course: string, date: string, topics: string[]): EnlistedExam => ({ id, title: `${course} exam`, course, date, topics });
function plan(exams: EnlistedExam[] = []): SemesterPlan {
  return { stage: 'mid', stageLabel: 'Mid-Semester', courses: [
    { course: 'Math', taughtTopics: ['Limits', 'Integration'] },
    { course: 'Physics', taughtTopics: ['Waves', 'Optics'] },
  ], exams, breaks: { restDaysPerWeek: 1, preExamBufferHours: 48, preferredRestDays: ['Sunday'] }, roadmap: [], createdAt: now.toISOString(), updatedAt: now.toISOString() };
}
test('builds a useful routine without inventing exams', () => {
  const result = buildSemesterSchedule(plan(), 30, now);
  assert.equal(result.semesterPlan.exams.length, 0);
  assert.equal(result.semesterPlan.roadmap.length, 14);
  assert.deepEqual(new Set(result.semesterPlan.roadmap.filter(d => d.type === 'study').map(d => d.course)), new Set(['Math', 'Physics']));
  assert.equal(result.studyPlan.steps.reduce((total, s) => total + s.minutes, 0), 30);
});
test('balances subjects and uses only selected upcoming exam topics', () => {
  const result = buildSemesterSchedule(plan([exam('math', 'Math', '2026-10-23', ['Integration']), exam('physics', 'Physics', '2026-10-24', ['Optics'])]), 30, now);
  const sessions = result.semesterPlan.roadmap.filter(d => (d.type === 'study' || d.type === 'buffer') && d.date < '2026-10-23');
  assert.deepEqual(new Set(sessions.map(d => d.course)), new Set(['Math', 'Physics']));
  assert.ok(sessions.every(d => d.topics?.every(t => ['Integration', 'Optics'].includes(t))));
});
test('records both exams on a shared date and ignores past exams for countdown planning', () => {
  const result = buildSemesterSchedule(plan([exam('old', 'Math', '2026-10-14', ['Limits']), exam('m', 'Math', '2026-10-20', ['Integration']), exam('p', 'Physics', '2026-10-20', ['Optics'])]), 30, now);
  const target = result.semesterPlan.roadmap.find(d => d.date === '2026-10-20')!;
  assert.equal(target.type, 'exam');
  assert.match(target.title, /Math exam.*Physics exam/);
  assert.deepEqual(target.topics, ['Integration', 'Optics']);
});
test('respects selected rest days even during an exam buffer', () => {
  const source = plan([exam('m', 'Math', '2026-10-20', ['Integration'])]);
  const result = buildSemesterSchedule(source, 45, now);
  assert.equal(result.semesterPlan.roadmap.find(d => d.date === '2026-10-18')?.type, 'rest');
  const buffer = result.semesterPlan.roadmap.find(d => d.date === '2026-10-19')!;
  assert.equal(buffer.type, 'buffer');
  assert.equal(buffer.minutes, 20);
  assert.deepEqual(buffer.topics, ['Integration']);
});
test('rest days and exam days never create a practice session for a future day', () => {
  for (const [date, source] of [[new Date(2026, 9, 18), plan()], [now, plan([exam('m', 'Math', '2026-10-15', ['Limits'])])]] as const) {
    const result = buildSemesterSchedule(source, 30, date);
    assert.equal(result.studyPlan.minutes, 0);
    assert.deepEqual(result.studyPlan.steps, []);
  }
});
test('recent exam topics become review work, never future exam markers', () => {
  const source = plan([{ ...exam('recent', 'Math', '2026-10-14', ['Integration']), isRecent: true }]);
  const result = buildSemesterSchedule(source, 10, now);
  assert.equal(result.semesterPlan.roadmap.some(d => d.type === 'exam'), false);
  assert.ok(result.semesterPlan.roadmap.filter(d => d.course === 'Math').every(d => d.topics?.includes('Integration')));
  assert.equal(result.studyPlan.steps.reduce((sum, s) => sum + s.minutes, 0), 10);
  assert.ok(result.studyPlan.steps.every(s => s.minutes > 0));
});
test('rebuilding after a date change produces fresh today actions and preserves exam inputs', () => {
  const source = plan([exam('m', 'Math', '2026-10-23', ['Limits'])]);
  const first = buildSemesterSchedule(source, 45, now);
  const next = buildSemesterSchedule(first.semesterPlan, first.semesterPlan.dailyMinutes!, new Date(2026, 9, 16));
  assert.equal(next.semesterPlan.roadmap[0].date, '2026-10-16');
  assert.deepEqual(next.semesterPlan.exams, source.exams);
  assert.equal(localDate(new Date(2026, 0, 1)), '2026-01-01');
});

test('unfinished revision stops targeting an elapsed exam and shifts to the next exam', () => {
  const source = plan([exam('finished', 'Math', '2026-10-14', ['Limits']), exam('next', 'Physics', '2026-10-16', ['Optics'])]);
  const old = buildSemesterSchedule(source, 30, new Date(2026, 9, 13)).semesterPlan;
  const result = buildSemesterSchedule(old, 30, now);
  assert.equal(result.semesterPlan.roadmap[0].date, '2026-10-15');
  assert.equal(result.semesterPlan.roadmap[0].course, 'Physics');
  assert.deepEqual(result.semesterPlan.roadmap[0].topics, ['Optics']);
  assert.deepEqual(semesterExamTimeline(result.semesterPlan, now).elapsed.map(e => e.id), ['finished']);
  assert.deepEqual(result.semesterPlan.exams, source.exams); // History is preserved, not marked complete.
});

test('after the final exam the plan becomes a routine without an expired target', () => {
  const source = plan([exam('finished', 'Math', '2026-10-14', ['Limits'])]);
  const result = buildSemesterSchedule(source, 30, now);
  assert.equal(semesterExamTimeline(result.semesterPlan, now).upcoming.length, 0);
  assert.ok(result.semesterPlan.roadmap.every(d => d.type !== 'exam' && d.type !== 'buffer'));
  assert.ok(result.studyPlan.steps.some(s => s.topic.endsWith('Spaced Practice')));
  assert.equal(result.studyPlan.steps.some(s => s.topic.includes('Exam Practice')), false);
});

test('a same-day exam stays active until the student explicitly finishes it', () => {
  const source = plan([exam('today', 'Math', localDate(now), ['Limits'])]);
  assert.equal(buildSemesterSchedule(source, 30, now).semesterPlan.roadmap[0].type, 'exam');
  const finished = { ...source, exams: source.exams.map(e => ({ ...e, isRecent: true })) };
  const result = buildSemesterSchedule(finished, 30, now);
  assert.equal(semesterExamTimeline(result.semesterPlan, now).upcoming.length, 0);
  assert.equal(semesterExamTimeline(result.semesterPlan, now).elapsed[0].id, 'today');
  assert.notEqual(result.semesterPlan.roadmap[0].type, 'exam');
  assert.ok(result.studyPlan.steps.length > 0);
});


test('connects today to saved work using course, topic and local completion date', () => {
  const materials = [
    { id: 'math', title: 'Math', created_at: now.toISOString(), extracted_text: null, metadata: { course: 'Math', confirmed: true, topics: ['Limits'] } },
    { id: 'physics', title: 'Physics', created_at: now.toISOString(), extracted_text: null, metadata: { course: 'Physics', confirmed: true, topics: ['Limits'] } },
  ];
  const base = { mode: 'practice' as const, topic: 'Limits', questions: [{ id: 'q', topic: 'Limits', question: '?', options: ['a'], page: 1 }], answers: {}, hints: [], results: null, created_at: now.toISOString(), completed_at: null };
  const sessions = [{ ...base, id: 'other', material_id: 'physics' }, { ...base, id: 'saved', material_id: 'math' }];
  assert.equal(plannedSessionContext('Math', ' limits ', materials, sessions, now).pending?.id, 'saved');
  assert.equal(plannedSessionContext('Math', 'Limits', materials, sessions, now).material?.id, 'math');
  const finished = [{ ...sessions[1], completed_at: now.toISOString() }];
  assert.equal(plannedSessionContext('Math', 'Limits', materials, finished, now).completed?.id, 'saved');
  assert.equal(plannedSessionContext('Math', 'Limits', materials, finished, new Date(2026, 9, 16)).completed, undefined);
  assert.equal(plannedSessionContext('Chemistry', 'Limits', materials, sessions, now).pending, undefined);
});
