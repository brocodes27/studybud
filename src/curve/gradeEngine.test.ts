import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  computeCurrentStanding,
  computeGpa,
  componentFraction,
  letterFor,
  projectFinalGrade,
  requiredFractionForTarget,
  round,
  type GradingComponent,
  type ScoreEntry,
} from './gradeEngine.ts';

const SYLLABUS: GradingComponent[] = [
  { id: 'hw', name: 'Problem sets', kind: 'homework', weight: 20, dropLowest: 1 },
  { id: 'mt1', name: 'Midterm 1', kind: 'midterm', weight: 20 },
  { id: 'mt2', name: 'Midterm 2', kind: 'midterm', weight: 20 },
  { id: 'final', name: 'Final exam', kind: 'final', weight: 40 },
];

test('letter bands map at their boundaries', () => {
  assert.equal(letterFor(93), 'A');
  assert.equal(letterFor(92.9), 'A-');
  assert.equal(letterFor(90), 'A-');
  assert.equal(letterFor(83), 'B');
  assert.equal(letterFor(59.9), 'F');
  assert.equal(letterFor(0), 'F');
});

test('drop-lowest removes the worst ratio, not the smallest raw score', () => {
  const scores: ScoreEntry[] = [
    { componentId: 'hw', pointsEarned: 5, pointsPossible: 100 },
    { componentId: 'hw', pointsEarned: 9, pointsPossible: 10 },
    { componentId: 'hw', pointsEarned: 10, pointsPossible: 10 },
  ];

  const result = componentFraction(SYLLABUS[0]!, scores);

  assert.equal(result.droppedCount, 1);
  assert.equal(result.gradedCount, 2);
  assert.equal(round(result.fraction, 4), 0.95);
});

test('current standing ignores ungraded weight entirely', () => {
  const scores: ScoreEntry[] = [{ componentId: 'mt1', pointsEarned: 88, pointsPossible: 100 }];

  const standing = computeCurrentStanding(SYLLABUS, scores);

  assert.equal(round(standing.percent!, 6), 88);
  assert.equal(standing.letter, 'B+');
  assert.equal(standing.gradedWeight, 20);
  assert.equal(standing.ungradedWeight, 80);
});

test('current standing is null before anything is graded', () => {
  const standing = computeCurrentStanding(SYLLABUS, []);

  assert.equal(standing.percent, null);
  assert.equal(standing.letter, null);
  assert.equal(standing.gradedWeight, 0);
});

test('weights that do not sum to 100 are surfaced, not silently normalized', () => {
  const lopsided: GradingComponent[] = [
    { id: 'a', name: 'A', kind: 'homework', weight: 30 },
    { id: 'b', name: 'B', kind: 'final', weight: 55 },
  ];

  const standing = computeCurrentStanding(lopsided, []);

  assert.ok(standing.weightSumWarning);
  assert.match(standing.weightSumWarning!, /85/);
});

test('projection weights graded work against the estimate for the rest', () => {
  const scores: ScoreEntry[] = [
    { componentId: 'mt1', pointsEarned: 90, pointsPossible: 100 },
    { componentId: 'mt2', pointsEarned: 80, pointsPossible: 100 },
  ];

  // 40% graded at 85, remaining 60% assumed at 70.
  const projection = projectFinalGrade(SYLLABUS, scores, { expectedFraction: 0.7 });

  assert.equal(round(projection.percent, 2), 76);
  assert.equal(projection.letter, 'C');
  assert.ok(projection.low < projection.percent);
  assert.ok(projection.high > projection.percent);
});

test('the range collapses to a point once everything is graded', () => {
  const scores: ScoreEntry[] = [
    { componentId: 'hw', pointsEarned: 95, pointsPossible: 100 },
    { componentId: 'mt1', pointsEarned: 91, pointsPossible: 100 },
    { componentId: 'mt2', pointsEarned: 94, pointsPossible: 100 },
    { componentId: 'final', pointsEarned: 93, pointsPossible: 100 },
  ];

  const projection = projectFinalGrade(SYLLABUS, scores);

  assert.equal(projection.low, projection.percent);
  assert.equal(projection.high, projection.percent);
  assert.equal(projection.confidence, 'high');
});

test('stronger mastery evidence narrows the band without moving the estimate', () => {
  const scores: ScoreEntry[] = [{ componentId: 'mt1', pointsEarned: 85, pointsPossible: 100 }];

  const weak = projectFinalGrade(SYLLABUS, scores, { expectedFraction: 0.8, evidenceStrength: 0 });
  const strong = projectFinalGrade(SYLLABUS, scores, { expectedFraction: 0.8, evidenceStrength: 1 });

  assert.equal(round(weak.percent, 6), round(strong.percent, 6));
  assert.ok(strong.high - strong.low < weak.high - weak.low);
});

test('confidence stays low when almost nothing has been graded', () => {
  const scores: ScoreEntry[] = [{ componentId: 'hw', pointsEarned: 10, pointsPossible: 10 }];

  assert.equal(projectFinalGrade(SYLLABUS, scores).confidence, 'low');
});

test('required score for a target reports reachable, secured, and impossible', () => {
  const scores: ScoreEntry[] = [
    { componentId: 'mt1', pointsEarned: 90, pointsPossible: 100 },
    { componentId: 'mt2', pointsEarned: 90, pointsPossible: 100 },
  ];

  // 40% locked at 90. Needs 60% of remaining weight to average ~95 for an A.
  const forA = requiredFractionForTarget(SYLLABUS, scores, 93);
  assert.ok(forA.reachable);
  assert.equal(round(forA.required, 4), 0.95);

  const forC = requiredFractionForTarget(SYLLABUS, scores, 73);
  assert.equal(forC.alreadySecured, false);
  assert.ok(forC.required < 0.7);

  const failing: ScoreEntry[] = [
    { componentId: 'mt1', pointsEarned: 20, pointsPossible: 100 },
    { componentId: 'mt2', pointsEarned: 20, pointsPossible: 100 },
  ];
  const impossible = requiredFractionForTarget(SYLLABUS, failing, 93);
  assert.equal(impossible.reachable, false);
});

test('a target is secured when the remaining work cannot drop you below it', () => {
  const scores: ScoreEntry[] = [
    { componentId: 'hw', pointsEarned: 100, pointsPossible: 100 },
    { componentId: 'mt1', pointsEarned: 100, pointsPossible: 100 },
    { componentId: 'mt2', pointsEarned: 100, pointsPossible: 100 },
  ];

  const forD = requiredFractionForTarget(SYLLABUS, scores, 60);
  assert.equal(forD.alreadySecured, true);
});

test('GPA is weighted by credit hours', () => {
  const gpa = computeGpa([
    { creditHours: 4, percent: 95 },
    { creditHours: 1, percent: 70 },
  ]);

  // (4 * 4.0 + 1 * 1.7) / 5
  assert.equal(round(gpa!, 3), 3.54);
});

test('GPA is null with no valid courses', () => {
  assert.equal(computeGpa([]), null);
  assert.equal(computeGpa([{ creditHours: 0, percent: 90 }]), null);
});

/* --------------------------------------------------------------------------
 * Top-20 syllabus patterns (P1.3) — guard against regressions on the exact
 * shapes real US college syllabi take. Each block is one canonical scheme.
 * ------------------------------------------------------------------------ */

test('P01 — standard 2-midterm + final + homework (gen chem)', () => {
  const components: GradingComponent[] = [
    { id: 'hw', name: 'Problem sets', kind: 'homework', weight: 20 },
    { id: 'mt1', name: 'Midterm 1', kind: 'midterm', weight: 20 },
    { id: 'mt2', name: 'Midterm 2', kind: 'midterm', weight: 20 },
    { id: 'final', name: 'Final exam', kind: 'final', weight: 40 },
  ];
  const scores: ScoreEntry[] = [
    { componentId: 'hw', pointsEarned: 95, pointsPossible: 100 },
    { componentId: 'mt1', pointsEarned: 88, pointsPossible: 100 },
  ];
  const standing = computeCurrentStanding(components, scores);
  assert.equal(round(standing.percent!, 2), 91.5);
  assert.equal(standing.gradedWeight, 40);
});

test('P02 — drop lowest of N quizzes keeps the best of the rest', () => {
  const components: GradingComponent[] = [
    { id: 'quiz', name: 'Weekly quizzes', kind: 'quiz', weight: 25, dropLowest: 2 },
    { id: 'final', name: 'Final', kind: 'final', weight: 75 },
  ];
  // Five quizzes; drop 2 worst. Remaining 3 are 80, 90, 100 ⇒ 90% avg.
  const scores: ScoreEntry[] = [
    { componentId: 'quiz', pointsEarned: 40, pointsPossible: 100 },
    { componentId: 'quiz', pointsEarned: 50, pointsPossible: 100 },
    { componentId: 'quiz', pointsEarned: 80, pointsPossible: 100 },
    { componentId: 'quiz', pointsEarned: 90, pointsPossible: 100 },
    { componentId: 'quiz', pointsEarned: 100, pointsPossible: 100 },
    { componentId: 'final', pointsEarned: 70, pointsPossible: 100 },
  ];
  const standing = computeCurrentStanding(components, scores);
  // Kept quizzes 80/90/100 → contribution 90; final 70. (90*25 + 70*75)/100 = 75.
  assert.equal(round(standing.percent!, 4), 75.0);
  assert.equal(standing.components.find((c) => c.componentId === 'quiz')!.droppedCount, 2);
});

test('P03 — pass/fail participation graded out of small points', () => {
  const components: GradingComponent[] = [
    { id: 'att', name: 'Participation', kind: 'participation', weight: 5 },
    { id: 'exam', name: 'Exam', kind: 'midterm', weight: 95 },
  ];
  const scores: ScoreEntry[] = [
    { componentId: 'att', pointsEarned: 5, pointsPossible: 5 },
    { componentId: 'exam', pointsEarned: 76, pointsPossible: 100 },
  ];
  const standing = computeCurrentStanding(components, scores);
  // Participation weight=5, fraction = 5/5 = 1.0 (contributes 5 full points).
  // Exam weight=95, fraction = 76/100 = 0.76 (contributes 72.2). Total = 77.2.
  assert.equal(round(standing.percent!, 2), 77.2);
});

test('P04 — extra credit added on top, capped so a true A cannot exceed 100', () => {
  const components: GradingComponent[] = [
    { id: 'exam', name: 'Exam', kind: 'midterm', weight: 100 },
    { id: 'ec', name: 'Bonus problem set', kind: 'other', weight: 5, isExtraCredit: true },
  ];
  // Perfect exam + full extra credit. Without the cap this would show 105.
  const scores: ScoreEntry[] = [
    { componentId: 'exam', pointsEarned: 100, pointsPossible: 100 },
    { componentId: 'ec', pointsEarned: 10, pointsPossible: 10 },
  ];
  const standing = computeCurrentStanding(components, scores);
  assert.equal(standing.percent, 100);
  assert.equal(standing.letter, 'A');
  assert.equal(standing.extraCreditPoints, 5);
});

test('P05 — extra credit lifts a borderline grade', () => {
  const components: GradingComponent[] = [
    { id: 'hw', name: 'Homework', kind: 'homework', weight: 50 },
    { id: 'exam', name: 'Exam', kind: 'midterm', weight: 50 },
    { id: 'ec', name: 'Bonus', kind: 'other', weight: 5, isExtraCredit: true },
  ];
  const scores: ScoreEntry[] = [
    { componentId: 'hw', pointsEarned: 80, pointsPossible: 100 },
    { componentId: 'exam', pointsEarned: 80, pointsPossible: 100 },
    { componentId: 'ec', pointsEarned: 10, pointsPossible: 10 }, // +5 points
  ];
  const standing = computeCurrentStanding(components, scores);
  // 80 + 5 bonus ⇒ 85 (B from B-... i.e. B, not B-).
  assert.equal(standing.percent, 85);
  assert.equal(standing.letter, 'B');
});

test('P06 — only extra credit graded: percent reflects bonus alone, not fabricate base', () => {
  const components: GradingComponent[] = [
    { id: 'exam', name: 'Exam', kind: 'midterm', weight: 100 },
    { id: 'ec', name: 'Bonus', kind: 'other', weight: 5, isExtraCredit: true },
  ];
  const scores: ScoreEntry[] = [
    { componentId: 'ec', pointsEarned: 10, pointsPossible: 10 },
  ];
  const standing = computeCurrentStanding(components, scores);
  // Base is ungraded ⇒ percent must stay honest (null core exists only when nothing graded).
  assert.equal(standing.percent, null);
  assert.equal(standing.extraCreditPoints, 5);
});

test('P07 — lab + lecture split (physics)', () => {
  const components: GradingComponent[] = [
    { id: 'lab', name: 'Lab reports', kind: 'lab', weight: 25 },
    { id: 'lec', name: 'Lecture exams', kind: 'midterm', weight: 55 },
    { id: 'final', name: 'Final', kind: 'final', weight: 20 },
  ];
  const scores: ScoreEntry[] = [
    { componentId: 'lab', pointsEarned: 92, pointsPossible: 100 },
    { componentId: 'lec', pointsEarned: 78, pointsPossible: 100 },
  ];
  const standing = computeCurrentStanding(components, scores);
  // (92*25 + 78*55) / (25+55) = 6590/80 = 82.375 → 82.38 at 2 places
  assert.equal(round(standing.percent!, 2), 82.38);
});

test('P08 — paper + presentation course (humanities style)', () => {
  const components: GradingComponent[] = [
    { id: 'papers', name: 'Papers', kind: 'project', weight: 40 },
    { id: 'pres', name: 'Presentation', kind: 'project', weight: 20 },
    { id: 'part', name: 'Participation', kind: 'participation', weight: 10 },
    { id: 'final', name: 'Final paper', kind: 'final', weight: 30 },
  ];
  const scores: ScoreEntry[] = [
    { componentId: 'papers', pointsEarned: 88, pointsPossible: 100 },
    { componentId: 'pres', pointsEarned: 95, pointsPossible: 100 },
  ];
  const standing = computeCurrentStanding(components, scores);
  // gradedWeight 60; (88*40 + 95*20) / 60 = 90.33
  assert.equal(round(standing.percent!, 2), 90.33);
});

test('P09 — attendance-only course (seminar)', () => {
  const components: GradingComponent[] = [
    { id: 'att', name: 'Attendance', kind: 'participation', weight: 100 },
  ];
  const scores: ScoreEntry[] = [
    { componentId: 'att', pointsEarned: 14, pointsPossible: 15 },
  ];
  const standing = computeCurrentStanding(components, scores);
  assert.ok(standing.percent! > 90);
});

test('P10 — 4 quizzes + 1 test + project (stem hybrid)', () => {
  const components: GradingComponent[] = [
    { id: 'q', name: 'Quizzes', kind: 'quiz', weight: 20, dropLowest: 1 },
    { id: 'test', name: 'Unit test', kind: 'midterm', weight: 50 },
    { id: 'proj', name: 'Term project', kind: 'project', weight: 30 },
  ];
  const scores: ScoreEntry[] = [
    { componentId: 'q', pointsEarned: 100, pointsPossible: 100 },
    { componentId: 'q', pointsEarned: 90, pointsPossible: 100 },
    { componentId: 'q', pointsEarned: 60, pointsPossible: 100 },
    { componentId: 'q', pointsEarned: 95, pointsPossible: 100 },
    { componentId: 'test', pointsEarned: 85, pointsPossible: 100 },
    { componentId: 'proj', pointsEarned: 92, pointsPossible: 100 },
  ];
  const standing = computeCurrentStanding(components, scores);
  // Quizzes: drop lowest (60) → 95 avg. (95*20 + 85*50 + 92*30) / 100 = 89.1
  assert.equal(round(standing.percent!, 2), 89.1);
  assert.equal(standing.components.find((c) => c.componentId === 'q')!.droppedCount, 1);
});

test('P11 — weights sum to less than 100 (flexible remainder ungraded)', () => {
  const components: GradingComponent[] = [
    { id: 'mt', name: 'Midterm', kind: 'midterm', weight: 50 },
  ];
  const scores: ScoreEntry[] = [{ componentId: 'mt', pointsEarned: 80, pointsPossible: 100 }];
  const standing = computeCurrentStanding(components, scores);
  assert.ok(standing.weightSumWarning);
  assert.equal(standing.percent, 80);
});

test('P12 — scores with 0 pointsPossible are ignored, not treated as 0%', () => {
  const components: GradingComponent[] = [
    { id: 'hw', name: 'Homework', kind: 'homework', weight: 50 },
    { id: 'mt', name: 'Midterm', kind: 'midterm', weight: 50 },
  ];
  const scores: ScoreEntry[] = [
    { componentId: 'hw', pointsEarned: 90, pointsPossible: 100 },
    { componentId: 'mt', pointsEarned: 0, pointsPossible: 0 }, // sentinel: not yet returned
  ];
  const standing = computeCurrentStanding(components, scores);
  assert.equal(standing.percent, 90);
  assert.equal(standing.gradedWeight, 50);
});

test('P13 — multiple scores within one category average across all (no drop specified)', () => {
  const components: GradingComponent[] = [
    { id: 'hw', name: 'Problem sets', kind: 'homework', weight: 30 },
    { id: 'final', name: 'Final', kind: 'final', weight: 70 },
  ];
  const scores: ScoreEntry[] = [
    { componentId: 'hw', pointsEarned: 100, pointsPossible: 100 },
    { componentId: 'hw', pointsEarned: 80, pointsPossible: 100 },
    { componentId: 'hw', pointsEarned: 90, pointsPossible: 100 },
    { componentId: 'final', pointsEarned: 80, pointsPossible: 100 },
  ];
  const standing = computeCurrentStanding(components, scores);
  // HW avg 90; (0.9*30 + 0.8*70)*100/100 = 83
  assert.equal(round(standing.percent!, 2), 83);
});

test('P14 — final-heavy course with nothing yet on the final', () => {
  const components: GradingComponent[] = [
    { id: 'mt', name: 'Midterm', kind: 'midterm', weight: 40 },
    { id: 'final', name: 'Final', kind: 'final', weight: 60 },
  ];
  const scores: ScoreEntry[] = [{ componentId: 'mt', pointsEarned: 92, pointsPossible: 100 }];
  const standing = computeCurrentStanding(components, scores);
  // Only the midterm is graded, so standing = its 92 (float can give 92.00000000000001).
  assert.ok(standing.percent !== null && Math.abs(standing.percent - 92) < 1e-9);
  assert.equal(standing.ungradedWeight, 60);
});

test('P15 — 5-point micro-quizzes ignored in drop-lowest denominator when all dropped', () => {
  const components: GradingComponent[] = [
    { id: 'q', name: 'Quizzes', kind: 'quiz', weight: 20, dropLowest: 5 },
    { id: 'final', name: 'Final', kind: 'final', weight: 80 },
  ];
  const scores: ScoreEntry[] = [
    { componentId: 'q', pointsEarned: 10, pointsPossible: 10 },
    { componentId: 'q', pointsEarned: 10, pointsPossible: 10 },
    { componentId: 'q', pointsEarned: 10, pointsPossible: 10 },
  ];
  const standing = computeCurrentStanding(components, scores);
  // drop=clamped to usable-1=2, so keep 1 quiz ⇒ fraction 1.0
  assert.equal(standing.components.find((c) => c.componentId === 'q')!.fraction, 1);
});

test('P16 — letter-for boundaries across full plus/minus scale', () => {
  const cases: Array<[number, string]> = [
    [93, 'A'], [90, 'A-'], [87, 'B+'], [83, 'B'], [80, 'B-'],
    [77, 'C+'], [73, 'C'], [70, 'C-'], [67, 'D+'], [63, 'D'], [60, 'D-'], [59, 'F'],
  ];
  for (const [percent, letter] of cases) {
    assert.equal(letterFor(percent), letter, `${percent} → ${letter}`);
  }
});

test('P17 — GPA with mixed credit hours, including a failed course', () => {
  const gpa = computeGpa([
    { creditHours: 3, percent: 88 },
    { creditHours: 4, percent: 55 },
    { creditHours: 1, percent: 96 },
  ]);
  assert.ok(gpa !== null);
  // (3*3.3 + 4*0 + 1*4.0)/8 = 1.74
  assert.equal(round(gpa, 2), 1.74);
});

test('P18 — half-credit lab component with fractional weight', () => {
  const components: GradingComponent[] = [
    { id: 'mt', name: 'Midterm', kind: 'midterm', weight: 50 },
    { id: 'lab', name: 'Lab', kind: 'lab', weight: 49.5 },
  ];
  const scores: ScoreEntry[] = [
    { componentId: 'mt', pointsEarned: 85, pointsPossible: 100 },
    { componentId: 'lab', pointsEarned: 95, pointsPossible: 100 },
  ];
  const standing = computeCurrentStanding(components, scores);
  // (85*50 + 95*49.5) / 99.5 = 8952.5 / 99.5 ≈ 89.97
  assert.ok(standing.percent! > 89.9 && standing.percent! < 90.05);
  // weights sum to 99.5 ⇒ within the 0.5 tolerance ⇒ no warning
  assert.equal(standing.weightSumWarning, null);
});

test('P19 — required fraction: A already secured when remaining weights cannot hurt', () => {
  const components: GradingComponent[] = [
    { id: 'mt1', name: 'MT1', kind: 'midterm', weight: 50 },
    { id: 'final', name: 'Final', kind: 'final', weight: 50 },
  ];
  const scores: ScoreEntry[] = [{ componentId: 'mt1', pointsEarned: 98, pointsPossible: 100 }];
  const needsZero = requiredFractionForTarget(components, scores, 49);
  assert.equal(needsZero.alreadySecured, true);
});

test('P20 — required fraction: impossible to reach target honestly reported', () => {
  const components: GradingComponent[] = [
    { id: 'mt1', name: 'MT1', kind: 'midterm', weight: 50 },
    { id: 'final', name: 'Final', kind: 'final', weight: 50 },
  ];
  const scores: ScoreEntry[] = [{ componentId: 'mt1', pointsEarned: 20, pointsPossible: 100 }];
  const result = requiredFractionForTarget(components, scores, 95);
  assert.equal(result.reachable, false);
  assert.ok(result.required > 1);
});
