import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sameSemester, scopeLibrary } from './semester-scope';
import { validatePlan } from './workspace-contracts';

const materials = [
  { id: 'old', metadata: { course: 'Math', semester: 'Semester 1', topics: ['Limits'], confirmed: true } },
  { id: 'current', metadata: { course: 'Math', semester: 'Semester 2', topics: ['Integration', 'Series'], confirmed: true } },
  { id: 'unknown', metadata: { course: 'Math', topics: ['Integration'], confirmed: true } },
];
const scope = { semester: 'Semester 2', courses: [{ course: 'Math', taughtTopics: ['Integration'] }] };
test('scopes planning context to the current semester and explicitly selected topics without altering the library', () => {
  const scoped = scopeLibrary(materials, scope);
  assert.deepEqual(scoped.map(m => [m.id, m.metadata.topics]), [['current', ['Integration']]]);
  assert.deepEqual(materials[1].metadata.topics, ['Integration', 'Series']);
  assert.equal(sameSemester('Sem. 2', 'Semester 2'), true);
  assert.equal(sameSemester(undefined, 'Semester 2'), false);
});
test('server plan validation rejects other semesters and unselected topics', () => {
  const library = scopeLibrary(materials, scope);
  const plan = (materialId: string, topic: string) => ({ minutes: 10, steps: [{ materialId, topic, minutes: 10, kind: 'learn' }] });
  assert.doesNotThrow(() => validatePlan(plan('current', 'Integration'), library));
  for (const [id, topic] of [['old', 'Limits'], ['current', 'Series'], ['unknown', 'Integration']]) {
    assert.throws(() => validatePlan(plan(id, topic), library), /confirmed topics/);
  }
});
test('older accounts without a semester keep their existing planning behavior', () => {
  assert.equal(scopeLibrary(materials, undefined), materials);
  assert.equal(scopeLibrary(materials, { courses: [] }), materials);
});
