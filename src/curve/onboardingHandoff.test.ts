/* P1.2 — onboarding handoff tests. node:test; sessionStorage stubbed. */
import { strict as assert } from 'node:assert';
import type { ParsedSyllabus, ParsedMultiSubjectSyllabus } from './ai';
import {
  stashPendingParse,
  peekPendingParse,
  readAndClearPendingParse,
  clearPendingParse,
  handoffToCourseInputs,
} from './onboardingHandoff';

function makeCourse(code = 'CHEM 2210'): ParsedSyllabus {
  return {
    courseCode: code,
    title: 'Organic Chemistry I',
    instructorName: null,
    term: 'Fall 2026',
    creditHours: 4,
    components: [
      { name: 'Final', kind: 'final' as const, weight: 50, dueOn: null },
      { name: 'Problem sets', kind: 'homework' as const, weight: 50, dropLowest: 1, dueOn: null },
    ],
    topics: [{ topic: 'Bonding', week: 1 }],
    warnings: [],
    confidence: [],
    hasLowConfidence: false,
  };
}

function makeMulti(courses = [makeCourse()]): ParsedMultiSubjectSyllabus {
  return { courses, globalWarnings: [] };
}

function installSessionStorage() {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).sessionStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } satisfies Storage;
  return store;
}

function resetSessionStorage() {
  delete (globalThis as Record<string, unknown>).sessionStorage;
}

let passed = 0;

// 1 — empty parse ⇒ not stashed, peek null
{
  installSessionStorage();
  const ok = stashPendingParse(makeMulti([]));
  assert.equal(ok, false, 'empty parse should not stash');
  assert.equal(peekPendingParse(), null);
  passed++;
}

// 2 — stash + peek round-trip
{
  installSessionStorage();
  const input = makeMulti();
  assert.equal(stashPendingParse(input), true);
  const peeked = peekPendingParse();
  assert.ok(peeked);
  assert.equal(peeked!.version, 1);
  assert.equal(peeked!.courses[0]!.courseCode, 'CHEM 2210');
  assert.ok(peeked!.stashedAt <= Date.now());
  // peek must NOT clear
  assert.ok(peekPendingParse(), 'peek must not clear storage');
  passed++;
}

// 3 — readAndClear returns once, then gone
{
  installSessionStorage();
  stashPendingParse(makeMulti());
  assert.ok(readAndClearPendingParse());
  assert.equal(readAndClearPendingParse(), null, 'second read must be null');
  assert.equal(peekPendingParse(), null, 'peek after read must be null');
  passed++;
}

// 4 — clearPendingParse empties
{
  installSessionStorage();
  stashPendingParse(makeMulti());
  clearPendingParse();
  assert.equal(peekPendingParse(), null);
  passed++;
}

// 5 — expired stash (older than MAX_AGE) returns null
{
  installSessionStorage();
  stashPendingParse(makeMulti());
  const realNow = Date.now;
  const FUTURE = realNow() + 31 * 60 * 1000;
  (Date as { now: () => number }).now = () => FUTURE;
  try {
    assert.equal(peekPendingParse(), null, 'stash older than 30 min must be ignored');
  } finally {
    (Date as { now: () => number }).now = realNow;
  }
  passed++;
}

// 6 — malformed storage value ⇒ null, no throw
{
  installSessionStorage();
  sessionStorage.setItem('curve.pending-onboarding-parse.v1', '{"weird": true');
  assert.equal(peekPendingParse(), null);
  sessionStorage.setItem('curve.pending-onboarding-parse.v1', '{"version":2,"courses":[]}');
  assert.equal(peekPendingParse(), null, 'wrong version rejected');
  passed++;
}

// 7 — handoffToCourseInputs maps dropLowest + dueOn + topics correctly
{
  installSessionStorage();
  const handoff = { version: 1 as const, stashedAt: Date.now(), courses: [makeCourse()], globalWarnings: [] };
  const inputs = handoffToCourseInputs(handoff);
  assert.equal(inputs.length, 1);
  const input = inputs[0]!;
  assert.equal(input.courseCode, 'CHEM 2210');
  const ps = input.components.find((c) => c.name === 'Problem sets')!;
  assert.equal(ps.dropLowest, 1);
  assert.equal(input.topics?.[0]?.topic, 'Bonding');
  passed++;
}

// 8 — no sessionStorage available ⇒ every call is a no-op
{
  resetSessionStorage();
  assert.equal(stashPendingParse(makeMulti()), false);
  assert.equal(peekPendingParse(), null);
  assert.equal(readAndClearPendingParse(), null);
  clearPendingParse();
  passed++;
}

console.log(`onboardingHandoff tests passed (${passed}/8)`);
resetSessionStorage();
