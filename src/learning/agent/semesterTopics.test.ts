import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getActualAndSuggestedTopics } from './semesterTopics';
import type { Material } from '../model';
import type { ParsedSyllabus } from '../../curve/ai';
const material = (course: string, topics: string[], confirmed_topics: string[] = []) => ({
  title: course, metadata: { course, topics, confirmed_topics },
}) as Material;

test('quick add includes all parsed topics, including ones not yet confirmed', () => {
  const topics = Array.from({ length: 25 }, (_, index) => `Topic ${index}`);
  assert.deepEqual(getActualAndSuggestedTopics('Physics', [material('Physics', topics, [topics[0]])]), { topics, isActual: true });
});
test('a single unrelated or unnamed upload does not populate another course', () => {
  assert.deepEqual(getActualAndSuggestedTopics('Math', [material('Physics', ['Waves'])]), { topics: [], isActual: false });
  assert.deepEqual(getActualAndSuggestedTopics('Math', [material('', ['Waves'])]), { topics: [], isActual: false });
});
test('handoff course codes and enrolled course topics are included and deduplicated', () => {
  const parsed = [{ title: 'Programming', courseCode: 'CS201', topics: [{ topic: 'Loops' }] }] as ParsedSyllabus[];
  assert.deepEqual(getActualAndSuggestedTopics('CS201', [material('CS201', ['Loops'])], parsed, { CS201: ['Functions'] }), { topics: ['Loops', 'Functions'], isActual: true });
});
