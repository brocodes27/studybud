/**
 * Scoring for the Encoding stage (PRD v2 §4.2).
 *
 * Kept apart from `ai.ts` so the part that decides whether a student may
 * advance carries no network and no environment — a gate is only trustworthy
 * if it can be tested.
 */

import { round } from './gradeEngine';

export type EncodingArtifactKind = 'explanation' | 'analogy' | 'simplification' | 'concept_link';

export interface EncodingContext {
  courseCode: string;
  topic: string;
  kind: EncodingArtifactKind;
  /** For a concept link: the earlier topic being connected to. */
  linkedTopic?: string | null;
  /** Course of that earlier topic. A different one means a cross-subject link. */
  linkedSubject?: string | null;
}

export interface EncodingRubric {
  /** Did they impose a structure, or just restate? */
  organize: number;
  /** Is it in their own plain words? */
  simplify: number;
  /** Is it tied to something they already know? */
  connect: number;
  /** Is there a mapping that carries the mechanism, not just a vibe? */
  analogize: number;
  /** Mean of the four, 0–5. The gate reads this. */
  score: number;
  /** One or two sentences the student sees. */
  feedback: string;
  /** The weakest dimension, so a revision has somewhere to go. */
  weakest: string;
}

export const ARTIFACT_BRIEF: Record<EncodingArtifactKind, string> = {
  explanation: 'explain the topic from scratch to someone who has never seen it',
  analogy: 'map the topic onto something from everyday life, mechanism for mechanism',
  simplification: 'compress the topic to its smallest honest form without losing what makes it work',
  concept_link:
    'connect the topic to something already learned and say exactly what the connection buys you',
};

export const RUBRIC_DIMENSIONS = ['organize', 'simplify', 'connect', 'analogize'] as const;

/** Reward for linking across courses, added to the connect dimension. */
export const CROSS_SUBJECT_BONUS = 0.5;

function clampScore(value: unknown): number {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(5, score));
}

/**
 * A concept link only counts as cross-subject when it reaches another course.
 *
 * Judged in code rather than asked of the model: a link that crosses subjects
 * is measurably harder to make and holds better, and that call should not drift
 * with a model's mood.
 */
export function isCrossSubject(context: EncodingContext): boolean {
  return (
    context.kind === 'concept_link' &&
    Boolean(context.linkedSubject) &&
    context.linkedSubject !== context.courseCode
  );
}

/**
 * Turns a model's raw rubric JSON into the scored result the gate reads.
 *
 * Defensive throughout: a missing, non-numeric, or out-of-range dimension
 * scores zero rather than passing by accident. A malformed response must never
 * be what advances a student.
 */
export function buildRubric(parsed: Record<string, unknown>, crossSubject: boolean): EncodingRubric {
  const scores = {
    organize: clampScore(parsed.organize),
    simplify: clampScore(parsed.simplify),
    connect: clampScore(parsed.connect),
    analogize: clampScore(parsed.analogize),
  };

  if (crossSubject) scores.connect = Math.min(5, scores.connect + CROSS_SUBJECT_BONUS);

  const score =
    RUBRIC_DIMENSIONS.reduce((sum, dimension) => sum + scores[dimension], 0) /
    RUBRIC_DIMENSIONS.length;

  const reported = String(parsed.weakest ?? '');

  return {
    ...scores,
    score: round(score, 1),
    feedback: String(parsed.feedback ?? '').slice(0, 400),
    // Trust the model's own read when it names a real dimension; otherwise fall
    // back to the arithmetic, so a revision always has somewhere to go.
    weakest: (RUBRIC_DIMENSIONS as readonly string[]).includes(reported)
      ? reported
      : RUBRIC_DIMENSIONS.reduce((worst, dimension) =>
          scores[dimension] < scores[worst] ? dimension : worst,
        ),
  };
}
