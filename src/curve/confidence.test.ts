/* P1.1 — parser confidence tests */
import { strict as assert } from 'node:assert';
import {
  deriveFieldConfidence,
  summarizeConfidence,
  summarizeMany,
  type FieldConfidence,
} from './confidence';

function base() {
  return {
    courseCode: 'CHEM 2210',
    title: 'Organic Chemistry I',
    instructorName: null,
    term: 'Fall 2026',
    creditHours: 4,
    components: [
      { name: 'Problem sets', kind: 'homework' as const, weight: 20, dropLowest: 1 },
      { name: 'Midterm', kind: 'midterm' as const, weight: 30 },
      { name: 'Final', kind: 'final' as const, weight: 50 },
    ],
    topics: Array.from({ length: 14 }, (_, i) => ({ topic: `Week ${i + 1}`, week: i + 1 })),
  };
}

// 1 — clean syllabus yields no review flags
{
  const summary = summarizeConfidence(base(), []);
  assert.equal(summary.hasLowConfidence, false);
  assert.equal(summary.reviewNeeded.length, 0);
}

// 2 — missing components ⇒ low confidence on components
{
  const parsed = { ...base(), components: [] };
  const summary = summarizeConfidence(parsed, []);
  assert.equal(summary.hasLowConfidence, true);
  assert.ok(summary.reviewNeeded.some((f) => f.field === 'components' && f.level === 'low'));
}

// 3 — weight total way off ⇒ low; slightly off ⇒ medium
{
  const bad = summarizeConfidence(
    { ...base(), components: [{ name: 'Final', kind: 'final' as const, weight: 60 }] },
    [],
  );
  assert.ok(bad.reviewNeeded.some((f) => f.field === 'components' && f.level === 'low'));

  const off = summarizeConfidence(
    {
      ...base(),
      components: [
        { name: 'A', kind: 'quiz' as const, weight: 30 },
        { name: 'B', kind: 'quiz' as const, weight: 30 },
        { name: 'C', kind: 'quiz' as const, weight: 36 },
      ],
    },
    [],
  );
  assert.ok(
    off.reviewNeeded.some((f) => f.field === 'components' && f.level === 'medium'),
    `expected a medium components flag, got ${JSON.stringify(off.reviewNeeded)}`,
  );
}

// 4 — model-reported low wins over heuristic silence (worst-case merge)
{
  const model: FieldConfidence[] = [
    { field: 'courseCode', level: 'low', reason: 'Model could not read the header.' },
  ];
  const summary = summarizeConfidence(base(), model);
  assert.ok(summary.reviewNeeded.some((f) => f.field === 'courseCode' && f.level === 'low'));
}

// 5 — heuristic low wins over model high
{
  const model: FieldConfidence[] = [{ field: 'components', level: 'high', reason: '' }];
  const summary = summarizeConfidence({ ...base(), components: [] }, model);
  assert.ok(summary.hasLowConfidence);
}

// 6 — missing course code ⇒ low; weird format ⇒ medium
{
  const summary = summarizeConfidence({ ...base(), courseCode: 'COURSE 101' }, []);
  assert.ok(summary.reviewNeeded.some((f) => f.field === 'courseCode' && f.level === 'low'));

  const odd = summarizeConfidence({ ...base(), courseCode: '12345' }, []);
  assert.ok(odd.reviewNeeded.some((f) => f.field === 'courseCode' && f.level === 'medium'));
}

// 7 — zero-weight component ⇒ per-row low
{
  const parsed = {
    ...base(),
    components: [
      { name: 'Labs', kind: 'lab' as const, weight: 0 },
      { name: 'Final', kind: 'final' as const, weight: 100 },
    ],
  };
  const summary = summarizeConfidence(parsed, []);
  assert.ok(summary.reviewNeeded.some((f) => f.field === 'components.0.weight' && f.level === 'low'));
}

// 8 — few topics ⇒ medium, none ⇒ low
{
  const few = summarizeConfidence({ ...base(), topics: [{ topic: 'Intro', week: 1 }] }, []);
  assert.ok(few.reviewNeeded.some((f) => f.field === 'topics' && f.level === 'medium'));

  const none = summarizeConfidence({ ...base(), topics: [] }, []);
  assert.ok(none.reviewNeeded.some((f) => f.field === 'topics' && f.level === 'low'));
}

// 9 — summarizeMany aggregates blockers with course indices
{
  const { perCourse, blockers } = summarizeMany([
    { parsed: base(), modelReported: [] },
    { parsed: { ...base(), components: [] }, modelReported: [] },
  ]);
  assert.equal(perCourse.length, 2);
  assert.equal(perCourse[0]?.hasLowConfidence, false);
  assert.equal(perCourse[1]?.hasLowConfidence, true);
  assert.ok(blockers.every((b) => b.courseIndex === 1));
}

console.log('confidence tests passed (9/9)');
