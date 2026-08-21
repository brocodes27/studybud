/**
 * Curve grade engine.
 *
 * Two layers, deliberately separated:
 *
 *   1. Current standing is pure arithmetic over syllabus weights and the
 *      scores that have actually come back. No model, no AI, no estimate.
 *      This is the number a student would compute in a spreadsheet, and it
 *      is correct on day one.
 *
 *   2. The projection extends that with an estimate for the components that
 *      have not been graded yet, and always reports a range rather than a
 *      single letter. The range collapses to a point as the semester is
 *      graded out, because uncertainty scales with ungraded weight.
 *
 * Keeping layer 1 free of estimation is what stops a bad model from ever
 * producing a fabricated letter grade.
 */

export type ComponentKind =
  | 'homework'
  | 'quiz'
  | 'midterm'
  | 'final'
  | 'project'
  | 'lab'
  | 'participation'
  | 'other';

export interface GradingComponent {
  id: string;
  name: string;
  kind: ComponentKind;
  /** Percent of the final grade, e.g. 20 for "Homework 20%". */
  weight: number;
  /** Number of lowest scores the syllabus drops from this category. */
  dropLowest?: number;
  /**
   * Extra credit adds points above the nominal category weight instead of
   * competing inside it. Common syllabus shapes: bonus assignments, reading
   * quizzes, optional presentations.
   */
  isExtraCredit?: boolean;
}

export interface ScoreEntry {
  componentId: string;
  pointsEarned: number;
  pointsPossible: number;
}

export interface LetterBand {
  letter: string;
  /** Inclusive lower bound, as a percentage. */
  min: number;
  gpaPoints: number;
}

export interface GradeScale {
  name: string;
  bands: LetterBand[];
}

/** Standard US plus/minus scale. Institutions vary, so this is overridable. */
export const DEFAULT_SCALE: GradeScale = {
  name: 'Standard plus/minus',
  bands: [
    { letter: 'A', min: 93, gpaPoints: 4.0 },
    { letter: 'A-', min: 90, gpaPoints: 3.7 },
    { letter: 'B+', min: 87, gpaPoints: 3.3 },
    { letter: 'B', min: 83, gpaPoints: 3.0 },
    { letter: 'B-', min: 80, gpaPoints: 2.7 },
    { letter: 'C+', min: 77, gpaPoints: 2.3 },
    { letter: 'C', min: 73, gpaPoints: 2.0 },
    { letter: 'C-', min: 70, gpaPoints: 1.7 },
    { letter: 'D+', min: 67, gpaPoints: 1.3 },
    { letter: 'D', min: 63, gpaPoints: 1.0 },
    { letter: 'D-', min: 60, gpaPoints: 0.7 },
    { letter: 'F', min: 0, gpaPoints: 0 },
  ],
};

export interface ComponentStanding {
  componentId: string;
  name: string;
  weight: number;
  /** Fraction earned in this category, 0..1, after drop-lowest. */
  fraction: number;
  gradedCount: number;
  droppedCount: number;
}

export interface CurrentStanding {
  /** Percentage across graded work only, or null when nothing is graded. */
  percent: number | null;
  letter: string | null;
  /** Share of the final grade already determined, 0..100. */
  gradedWeight: number;
  ungradedWeight: number;
  components: ComponentStanding[];
  /** Weights that do not sum to 100, surfaced rather than silently normalized. */
  weightSumWarning: string | null;
  /**
   * Extra-credit points earned across the course so far, in percentage-of-grade
   * terms (already normalized into [0..] and excluded from gradedWeight). Added
   * on top of earned percentage in computeCurrentStanding.
   */
  extraCreditPoints: number;
}

export interface Projection {
  /** Best-estimate final percentage. */
  percent: number;
  letter: string;
  /** Likely range, roughly one standard deviation. */
  low: number;
  high: number;
  lowLetter: string;
  highLetter: string;
  confidence: 'low' | 'medium' | 'high';
  /** Fraction 0..1 assumed for the ungraded work. */
  assumedFraction: number;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function isUsableScore(score: ScoreEntry): boolean {
  return (
    Number.isFinite(score.pointsEarned) &&
    Number.isFinite(score.pointsPossible) &&
    score.pointsPossible > 0
  );
}

export function letterFor(percent: number, scale: GradeScale = DEFAULT_SCALE): string {
  const bands = [...scale.bands].sort((a, b) => b.min - a.min);
  const hit = bands.find((band) => percent >= band.min);
  return hit ? hit.letter : bands[bands.length - 1]!.letter;
}

export function gpaPointsFor(percent: number, scale: GradeScale = DEFAULT_SCALE): number {
  const bands = [...scale.bands].sort((a, b) => b.min - a.min);
  const hit = bands.find((band) => percent >= band.min);
  return hit ? hit.gpaPoints : 0;
}

/**
 * Earned fraction for one category, applying the syllabus drop-lowest rule.
 * Scores are dropped by ratio rather than raw points so that a missed 5-point
 * quiz is not treated as worse than a missed 100-point exam.
 */
export function componentFraction(
  component: GradingComponent,
  scores: ScoreEntry[],
): { fraction: number; gradedCount: number; droppedCount: number } {
  const usable = scores.filter(
    (score) => score.componentId === component.id && isUsableScore(score),
  );

  if (usable.length === 0) {
    return { fraction: 0, gradedCount: 0, droppedCount: 0 };
  }

  const drop = clamp(Math.floor(component.dropLowest ?? 0), 0, Math.max(0, usable.length - 1));
  const ranked = [...usable].sort(
    (a, b) => a.pointsEarned / a.pointsPossible - b.pointsEarned / b.pointsPossible,
  );
  const kept = ranked.slice(drop);

  const earned = kept.reduce((sum, score) => sum + score.pointsEarned, 0);
  const possible = kept.reduce((sum, score) => sum + score.pointsPossible, 0);

  return {
    fraction: possible > 0 ? clamp(earned / possible, 0, 1.5) : 0,
    gradedCount: kept.length,
    droppedCount: drop,
  };
}

/**
 * Layer 1. Where the student stands right now, across graded work only.
 * This is the number they would get from a spreadsheet, and it involves no
 * estimation of any kind.
 */
export function computeCurrentStanding(
  components: GradingComponent[],
  scores: ScoreEntry[],
  scale: GradeScale = DEFAULT_SCALE,
): CurrentStanding {
  // Extra credit contributes its earned points on top of the 100-point scale
  // but is not part of the core weight sum nor the drop-lowest computation.
  const core = components.filter((component) => !component.isExtraCredit);
  const extras = components.filter((component) => component.isExtraCredit);

  const valid = core.filter((component) => Number.isFinite(component.weight) && component.weight > 0);

  const standings: ComponentStanding[] = valid.map((component) => {
    const { fraction, gradedCount, droppedCount } = componentFraction(component, scores);
    return {
      componentId: component.id,
      name: component.name,
      weight: component.weight,
      fraction,
      gradedCount,
      droppedCount,
    };
  });

  const graded = standings.filter((standing) => standing.gradedCount > 0);
  const gradedWeight = graded.reduce((sum, standing) => sum + standing.weight, 0);
  const totalWeight = standings.reduce((sum, standing) => sum + standing.weight, 0);

  const earnedWeighted = graded.reduce(
    (sum, standing) => sum + standing.weight * standing.fraction,
    0,
  );

  const percentCore = gradedWeight > 0 ? (earnedWeighted / gradedWeight) * 100 : null;

  // Extra-credit: weight acts as the *max* bonus points the bucket can add
  // (e.g., weight 3 with half earned → +1.5%). The fraction is computed the
  // same way as anything else (excluding drop-lowest — optional work is opt-in).
  let extraCreditPoints = 0;
  for (const extra of extras) {
    if (!Number.isFinite(extra.weight) || extra.weight <= 0) continue;
    const { fraction } = componentFraction(extra, scores);
    extraCreditPoints += extra.weight * fraction;
  }
  // Clamp total at 100 so bonus work can't push a true-A student over 100.
  const percent = percentCore === null ? null : Math.min(100, percentCore + extraCreditPoints);

  let weightSumWarning: string | null = null;
  if (totalWeight > 0 && Math.abs(totalWeight - 100) > 0.5) {
    weightSumWarning = `Grading weights sum to ${round(totalWeight, 1)}%, not 100%.`;
  }

  return {
    percent,
    letter: percent === null ? null : letterFor(percent, scale),
    gradedWeight,
    ungradedWeight: Math.max(0, totalWeight - gradedWeight),
    components: standings,
    weightSumWarning,
    extraCreditPoints,
  };
}

/**
 * Layer 2. Project the final grade by locking in graded work and estimating
 * the remainder.
 *
 * `expectedFraction` is where mastery feeds in: 0..1 for how the student is
 * expected to perform on work not yet graded. When omitted it falls back to
 * their current performance, which assumes no change in trajectory.
 *
 * `evidenceStrength` (0..1) reflects how much we trust that estimate and only
 * narrows the band; it never shifts the point estimate.
 */
export function projectFinalGrade(
  components: GradingComponent[],
  scores: ScoreEntry[],
  options: {
    expectedFraction?: number;
    evidenceStrength?: number;
    scale?: GradeScale;
  } = {},
): Projection {
  const scale = options.scale ?? DEFAULT_SCALE;
  const standing = computeCurrentStanding(components, scores, scale);

  const totalWeight = standing.gradedWeight + standing.ungradedWeight;
  if (totalWeight <= 0) {
    return {
      percent: 0,
      letter: letterFor(0, scale),
      low: 0,
      high: 0,
      lowLetter: letterFor(0, scale),
      highLetter: letterFor(0, scale),
      confidence: 'low',
      assumedFraction: 0,
    };
  }

  const currentFraction = standing.percent === null ? null : standing.percent / 100;
  const assumed = clamp(
    options.expectedFraction ?? currentFraction ?? 0.75,
    0,
    1,
  );

  const lockedPoints = (currentFraction ?? 0) * standing.gradedWeight;
  const projectedPoints = assumed * standing.ungradedWeight;
  const percent = clamp(((lockedPoints + projectedPoints) / totalWeight) * 100, 0, 150);

  // Uncertainty lives entirely in the ungraded portion, so the band narrows
  // on its own as the semester is graded out and vanishes at 100% graded.
  const ungradedShare = standing.ungradedWeight / totalWeight;
  const evidence = clamp(options.evidenceStrength ?? 0, 0, 1);
  const sigma = 0.16 * (1 - 0.5 * evidence);
  const spread = sigma * ungradedShare * 100;

  const low = clamp(percent - spread, 0, 150);
  const high = clamp(percent + spread, 0, 150);

  const gradedShare = standing.gradedWeight / totalWeight;
  let confidence: Projection['confidence'] = 'low';
  if (gradedShare >= 0.6 || (gradedShare >= 0.3 && evidence >= 0.5)) {
    confidence = 'high';
  } else if (gradedShare >= 0.25 || evidence >= 0.4) {
    confidence = 'medium';
  }

  return {
    percent,
    letter: letterFor(percent, scale),
    low,
    high,
    lowLetter: letterFor(low, scale),
    highLetter: letterFor(high, scale),
    confidence,
    assumedFraction: assumed,
  };
}

/**
 * "What do I need on the final to still get an A?"
 *
 * Returns the fraction (0..1) required across all remaining ungraded weight
 * to land on `targetPercent`. Above 1 means it is no longer reachable, which
 * the UI should say plainly rather than hide.
 */
export function requiredFractionForTarget(
  components: GradingComponent[],
  scores: ScoreEntry[],
  targetPercent: number,
): { required: number; reachable: boolean; alreadySecured: boolean } {
  const standing = computeCurrentStanding(components, scores);
  const totalWeight = standing.gradedWeight + standing.ungradedWeight;

  if (totalWeight <= 0 || standing.ungradedWeight <= 0) {
    const finalPercent = standing.percent ?? 0;
    return {
      required: 0,
      reachable: finalPercent >= targetPercent,
      alreadySecured: finalPercent >= targetPercent,
    };
  }

  const lockedPoints = ((standing.percent ?? 0) / 100) * standing.gradedWeight;
  const neededPoints = (targetPercent / 100) * totalWeight - lockedPoints;
  const required = neededPoints / standing.ungradedWeight;

  return {
    required,
    reachable: required <= 1,
    alreadySecured: required <= 0,
  };
}

export interface CourseGpaInput {
  creditHours: number;
  percent: number;
}

/** Credit-weighted GPA across courses. */
export function computeGpa(
  courses: CourseGpaInput[],
  scale: GradeScale = DEFAULT_SCALE,
): number | null {
  const valid = courses.filter(
    (course) => Number.isFinite(course.creditHours) && course.creditHours > 0,
  );
  if (valid.length === 0) return null;

  const credits = valid.reduce((sum, course) => sum + course.creditHours, 0);
  const points = valid.reduce(
    (sum, course) => sum + course.creditHours * gpaPointsFor(course.percent, scale),
    0,
  );

  return credits > 0 ? points / credits : null;
}

export function round(value: number, places = 0): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
