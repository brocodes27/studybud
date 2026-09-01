import assert from 'node:assert/strict';
import { chunkPages, courseKey, isEmptyCourse, mergeParsedCourses } from './syllabusMerge';
import type { ParsedSyllabus } from './ai';

function course(partial: Partial<ParsedSyllabus>): ParsedSyllabus {
  return {
    courseCode: '',
    title: '',
    instructorName: null,
    term: 'Fall 2026',
    creditHours: 3,
    components: [],
    topics: [],
    warnings: [],
    confidence: [],
    hasLowConfidence: false,
    ...partial,
  } as ParsedSyllabus;
}

// --- page windowing ---------------------------------------------------------
assert.deepEqual(chunkPages([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
assert.deepEqual(chunkPages([], 8), []);
assert.equal(chunkPages(Array.from({ length: 40 }, (_, i) => i), 8).length, 5);

// --- identity ---------------------------------------------------------------
assert.equal(courseKey({ courseCode: 'CHEM 2210', title: 'Orgo' }), courseKey({ courseCode: 'chem2210', title: '' }));
assert.equal(courseKey({ courseCode: '', title: 'Organic Chemistry' }), 'title:organic chemistry');
// Two anonymous courses must NOT collapse into one.
assert.notEqual(courseKey({ courseCode: '', title: '' }, 1), courseKey({ courseCode: '', title: '' }, 2));

// --- a course split across two windows comes back as one --------------------
const merged = mergeParsedCourses([
  [
    course({
      courseCode: 'CHEM 2210',
      title: 'Organic Chemistry I',
      components: [{ name: 'Problem sets', kind: 'homework', weight: 20, dropLowest: 1, dueOn: null }],
      warnings: [],
    }),
    course({ courseCode: 'MATH 1210', title: 'Calculus I' }),
  ],
  [
    course({
      courseCode: 'chem 2210',
      title: '',
      topics: [{ topic: 'Stereochemistry', week: 2 }],
      warnings: ['No grading breakdown was found, so components need to be added by hand.'],
    }),
    course({ courseCode: 'PHYS 1500', title: 'Physics I' }),
  ],
]);

assert.equal(merged.length, 3, 'CHEM halves merge; MATH and PHYS stay separate');
assert.deepEqual(merged.map((c) => c.courseCode), ['CHEM 2210', 'MATH 1210', 'PHYS 1500']);

const chem = merged[0];
assert.equal(chem.title, 'Organic Chemistry I', 'keeps the title from the window that had one');
assert.equal(chem.components.length, 1, 'grading table survives the merge');
assert.equal(chem.topics?.length, 1, 'weekly topics from the later window are kept');
assert.equal(
  chem.warnings.some((w) => w.startsWith('No grading breakdown')),
  false,
  'the missing-components warning is dropped once the other half supplied them',
);

// --- duplicate components across windows do not double up ------------------
const deduped = mergeParsedCourses([
  [course({ courseCode: 'BIO 101', components: [{ name: 'Final', kind: 'final', weight: 40, dropLowest: 0, dueOn: null }] })],
  [course({ courseCode: 'BIO 101', components: [{ name: 'final', kind: 'final', weight: 0, dropLowest: 0, dueOn: '2026-12-10' }] })],
]);
assert.equal(deduped[0].components.length, 1);
assert.equal(deduped[0].components[0].weight, 40, 'a real weight beats a zero');
assert.equal(deduped[0].components[0].dueOn, '2026-12-10', 'a due date beats null');

// --- empty shells ----------------------------------------------------------
assert.equal(isEmptyCourse(course({})), true);
assert.equal(isEmptyCourse(course({ title: 'Anything' })), false);

console.log('syllabusMerge: all assertions passed');
