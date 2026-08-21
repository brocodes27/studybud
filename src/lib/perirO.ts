/**
 * The PERIR-O stage machine — Priming, Encoding, Reference, Retrieval,
 * Interleaving, Overlearning (PRD v2 §2).
 *
 * Pure by design: no Supabase, no network, no clock. Every function takes the
 * state and the date it should reason about. Gates decide whether a student may
 * advance, so they must be deterministic and testable — an LLM never sits in
 * this path.
 *
 * The stage of a topic is the furthest stage it has cleared and is monotonic:
 * it never regresses. Decay routes a student back to earlier work through the
 * `remedial` flag instead, which keeps the stage map readable and keeps the
 * history of what actually happened honest.
 */

export type Stage =
  | 'new'
  | 'primed'
  | 'encoded'
  | 'referenced'
  | 'retrieved'
  | 'interleaved'
  | 'overlearned';

export type StageAction = 'prime' | 'encode' | 'reference' | 'retrieve' | 'interleave' | 'overlearn';

export const STAGE_ORDER: Stage[] = [
  'new',
  'primed',
  'encoded',
  'referenced',
  'retrieved',
  'interleaved',
  'overlearned',
];

/** The stage an action promotes a topic into when its gate passes. */
const ACTION_TARGET: Record<StageAction, Stage> = {
  prime: 'primed',
  encode: 'encoded',
  reference: 'referenced',
  retrieve: 'retrieved',
  interleave: 'interleaved',
  overlearn: 'overlearned',
};

/**
 * Gate thresholds. These are calibration knobs, not settled science — the
 * numbers came from the framework, not from our cohorts. Recalibrate against
 * measured outcomes (PRD §9); never inline these at a call site.
 */
export const STAGE_GATES = {
  /** Priming is active recall of what to listen for, not passive reading. */
  primingQuestionsMin: 3,
  /** Rubric is 0–5 across organize / simplify / connect / analogize. */
  encodeRubricMin: 3,
  referenceCardsMin: 5,
  retrievalItemsMin: 10,
  retrievalMasteryMin: 0.55,
  interleaveAppearancesMin: 2,
  interleaveSubjectsMin: 2,
  interleaveAccuracyMin: 0.65,
  interleaveMasteryMin: 0.75,
  overlearnDrillsMin: 3,
  overlearnAccuracyMin: 0.9,
  /** Fluency: median response time must fall to this share of the baseline. */
  overlearnSpeedRatioMax: 0.6,
} as const;

/**
 * Spaced retrieval ladder in days, indexed by retrievalStreak.
 *
 * ponytail: fixed ladder, not FSRS. A fitted model needs ~50k graded reviews
 * before its parameters beat a sensible constant; until then it would be noise
 * with a research paper attached. Upgrade path is PRD §2.4 / P6.6.
 */
export const RETRIEVAL_INTERVALS = [1, 3, 7, 16, 35] as const;

/** A retrieval session below this accuracy repeats its interval instead of advancing. */
export const RETRIEVAL_ADVANCE_ACCURACY = 0.6;

/** Expected mastery movement per action. Feeds planner leverage (PRD §3.2). */
export const STAGE_MASTERY_GAIN: Record<StageAction, number> = {
  prime: 0.05,
  encode: 0.2,
  reference: 0.05,
  retrieve: 0.15,
  interleave: 0.1,
  overlearn: 0.03,
};

/** Target session length per action, in minutes. */
export const STAGE_MINUTES: Record<StageAction, number> = {
  prime: 6,
  encode: 18,
  reference: 8,
  retrieve: 12,
  interleave: 15,
  overlearn: 20,
};

export const DECAY = {
  /** Below this mastery a topic is pulled forward for retrieval today. */
  dueThreshold: 0.4,
  /** Below this it needs re-encoding, not more testing. */
  remedialThreshold: 0.25,
} as const;

/** Overlearning only opens inside this window before a mapped exam. */
export const OVERLEARN_EXAM_WINDOW_DAYS = 14;

/** A topic whose lecture lands inside this window jumps the queue for priming. */
export const PRIMING_WINDOW_DAYS = 2;

/** Retrieval is pulled this many days earlier than an exam it feeds. */
const RETRIEVAL_PRE_EXAM_DAYS = 2;

/** Per-(enrollment, topic) stage state. Mirrors `curve_topic_stage`. */
export interface TopicStage {
  stage: Stage;
  remedial: boolean;
  primedAt: string | null;
  encodedAt: string | null;
  referencedAt: string | null;
  firstRetrievedAt: string | null;
  interleavedAt: string | null;
  overlearnedAt: string | null;
  retrievalStreak: number;
  nextRetrievalOn: string | null;
  interleaveAppearances: number;
  overlearnDrills: number;
  baselineResponseMs: number | null;
}

/** What a completed session produced. Only the fields its gate reads are required. */
export interface GateEvidence {
  /** Priming: questions the student wrote to listen for. */
  primingQuestions?: number;
  /** Encoding: rubric score 0–5. */
  rubricScore?: number;
  /** Reference: cards the student accepted for this topic. */
  acceptedCards?: number;
  /** Retrieval / interleave / overlearn: items answered in this session. */
  items?: number;
  /** Fraction correct in this session, 0–1. */
  accuracy?: number;
  /** BKT posterior for the topic's knowledge component after the session. */
  pMastery?: number;
  /** Interleave: how many distinct subjects the set spanned. */
  subjectsInSet?: number;
  /** Overlearn: median response time for this drill. */
  medianResponseMs?: number;
}

export interface GateResult {
  passed: boolean;
  /** Why it did not pass, phrased for the student. Empty when it passed. */
  reason: string;
}

export function emptyTopicStage(): TopicStage {
  return {
    stage: 'new',
    remedial: false,
    primedAt: null,
    encodedAt: null,
    referencedAt: null,
    firstRetrievedAt: null,
    interleavedAt: null,
    overlearnedAt: null,
    retrievalStreak: 0,
    nextRetrievalOn: null,
    interleaveAppearances: 0,
    overlearnDrills: 0,
    baselineResponseMs: null,
  };
}

export function stageRank(stage: Stage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function atLeast(stage: Stage, floor: Stage): boolean {
  return stageRank(stage) >= stageRank(floor);
}

/* ------------------------------------------------------------------ dates -- */

/** ISO date (YYYY-MM-DD) arithmetic in UTC, so a plan never shifts under a timezone. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/**
 * The Monday of the week a date falls in.
 *
 * Used to prefill a course's term start. Terms are described by week number, so
 * anchoring to a Monday keeps derived lecture dates aligned with how a syllabus
 * actually talks about time.
 */
export function weekStartOn(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  // getUTCDay() is 0 for Sunday, which belongs to the week that began six days
  // earlier — not to the one starting tomorrow.
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(isoDate, -offset);
}

/**
 * Lecture date for a syllabus topic, derived rather than stored: a corrected
 * term start must move every topic at once, not trigger a bulk rewrite.
 * Returns null when the course has no term start, which is what makes the
 * priming window override skip schedule-less syllabi (PRD §10).
 */
export function lectureDateFor(termStartOn: string | null, week: number | null): string | null {
  if (!termStartOn || !week || week < 1) return null;
  return addDays(termStartOn, (week - 1) * 7);
}

/* ------------------------------------------------------------------ gates -- */

/**
 * Does this completed session clear the gate out of the topic's current stage?
 *
 * A gate is evaluated against the action the student ran, not against what they
 * intended: running Retrieval on a topic still at `primed` cannot advance it,
 * because the stage before it was never cleared.
 */
export function evaluateGate(state: TopicStage, action: StageAction, evidence: GateEvidence): GateResult {
  const required = requiredStageFor(action);
  if (state.stage !== required) {
    return {
      passed: false,
      reason: `This topic is at ${state.stage}. ${labelFor(action)} advances it from ${required}.`,
    };
  }

  switch (action) {
    case 'prime':
      return check(
        (evidence.primingQuestions ?? 0) >= STAGE_GATES.primingQuestionsMin,
        `Write at least ${STAGE_GATES.primingQuestionsMin} questions you want the lecture to answer.`,
      );

    case 'encode':
      return check(
        (evidence.rubricScore ?? 0) >= STAGE_GATES.encodeRubricMin,
        `Your explanation scored below ${STAGE_GATES.encodeRubricMin}/5. Tighten the weakest part and try again.`,
      );

    case 'reference':
      return check(
        (evidence.acceptedCards ?? 0) >= STAGE_GATES.referenceCardsMin,
        `Keep at least ${STAGE_GATES.referenceCardsMin} reference cards for this topic.`,
      );

    case 'retrieve':
      if ((evidence.items ?? 0) < STAGE_GATES.retrievalItemsMin) {
        return fail(`Answer at least ${STAGE_GATES.retrievalItemsMin} questions closed-book.`);
      }
      return check(
        (evidence.pMastery ?? 0) >= STAGE_GATES.retrievalMasteryMin,
        'Your mastery on this topic is still low. One more retrieval session should clear it.',
      );

    case 'interleave':
      if ((evidence.subjectsInSet ?? 0) < STAGE_GATES.interleaveSubjectsMin) {
        return fail(`An interleaved set has to span at least ${STAGE_GATES.interleaveSubjectsMin} subjects.`);
      }
      if (state.interleaveAppearances < STAGE_GATES.interleaveAppearancesMin) {
        return fail('This topic needs to survive one more mixed set.');
      }
      if ((evidence.accuracy ?? 0) < STAGE_GATES.interleaveAccuracyMin) {
        return fail('This topic slipped when it was mixed with others. Worth another pass.');
      }
      return check(
        (evidence.pMastery ?? 0) >= STAGE_GATES.interleaveMasteryMin,
        'Close — mastery is not quite high enough to call this one interleaved.',
      );

    case 'overlearn': {
      if (state.overlearnDrills < STAGE_GATES.overlearnDrillsMin) {
        return fail(
          `${STAGE_GATES.overlearnDrillsMin - state.overlearnDrills} more timed drill(s) at speed.`,
        );
      }
      if ((evidence.accuracy ?? 0) < STAGE_GATES.overlearnAccuracyMin) {
        return fail('Accuracy has to hold above 90% under time pressure.');
      }
      const baseline = state.baselineResponseMs;
      const median = evidence.medianResponseMs;
      if (!baseline || !median) {
        return fail('No speed baseline yet — one more drill sets it.');
      }
      return check(
        median <= baseline * STAGE_GATES.overlearnSpeedRatioMax,
        'You are accurate but not yet fast. Fluency is the whole point of this stage.',
      );
    }
  }
}

/** The stage a topic must already hold for this action to advance it. */
export function requiredStageFor(action: StageAction): Stage {
  const target = ACTION_TARGET[action];
  return STAGE_ORDER[stageRank(target) - 1]!;
}

function check(passed: boolean, reason: string): GateResult {
  return passed ? { passed: true, reason: '' } : { passed: false, reason };
}

function fail(reason: string): GateResult {
  return { passed: false, reason };
}

export function labelFor(action: StageAction): string {
  const labels: Record<StageAction, string> = {
    prime: 'Prime',
    encode: 'Encode',
    reference: 'Reference',
    retrieve: 'Retrieve',
    interleave: 'Interleave',
    overlearn: 'Overlearn',
  };
  return labels[action];
}

/* ------------------------------------------------------------ transitions -- */

export interface CompletionContext {
  /** Today, as the student's local ISO date. */
  today: string;
  /** Date of the next exam mapped to this topic, if any. */
  examOn?: string | null;
}

/**
 * Applies a completed session to a topic's stage state.
 *
 * Counters (interleave appearances, overlearn drills) always accumulate, since
 * a gate can need several sessions. The stage and its timestamps only ever move
 * forward one step and are never rewritten, so replaying the same completion
 * against the resulting state is a no-op on stage — the write layer still
 * dedupes the event row itself (PRD §8).
 */
export function applyCompletion(
  state: TopicStage,
  action: StageAction,
  evidence: GateEvidence,
  context: CompletionContext,
): TopicStage {
  const next: TopicStage = { ...state };

  // Accumulate evidence first: it is what later gates read.
  if (action === 'interleave') next.interleaveAppearances += 1;
  if (action === 'overlearn') {
    next.overlearnDrills += 1;
    // The baseline is the first drill's median and is never overwritten —
    // fluency is measured against where the student started.
    if (next.baselineResponseMs === null && evidence.medianResponseMs) {
      next.baselineResponseMs = evidence.medianResponseMs;
    }
  }

  if (action === 'retrieve') {
    const schedule = scheduleNextRetrieval(next, evidence.accuracy ?? 0, context);
    next.retrievalStreak = schedule.retrievalStreak;
    next.nextRetrievalOn = schedule.nextRetrievalOn;
  }

  // Clearing an encoding rubric is what lifts remediation, at any stage.
  if (action === 'encode' && (evidence.rubricScore ?? 0) >= STAGE_GATES.encodeRubricMin) {
    next.remedial = false;
  }

  const gate = evaluateGate(next, action, evidence);
  if (!gate.passed) return next;

  const target = ACTION_TARGET[action];
  next.stage = target;

  const at = `${context.today}T00:00:00.000Z`;
  if (target === 'primed' && !next.primedAt) next.primedAt = at;
  if (target === 'encoded' && !next.encodedAt) next.encodedAt = at;
  if (target === 'referenced' && !next.referencedAt) next.referencedAt = at;
  if (target === 'retrieved' && !next.firstRetrievedAt) next.firstRetrievedAt = at;
  if (target === 'interleaved' && !next.interleavedAt) next.interleavedAt = at;
  if (target === 'overlearned' && !next.overlearnedAt) next.overlearnedAt = at;

  return next;
}

/**
 * Next spaced-retrieval date. A weak session repeats its interval rather than
 * advancing — the ladder measures how well the topic is holding, not how many
 * times it has been seen.
 */
export function scheduleNextRetrieval(
  state: TopicStage,
  accuracy: number,
  context: CompletionContext,
): { retrievalStreak: number; nextRetrievalOn: string } {
  const advance = accuracy >= RETRIEVAL_ADVANCE_ACCURACY;
  const streak = advance
    ? Math.min(state.retrievalStreak + 1, RETRIEVAL_INTERVALS.length - 1)
    : state.retrievalStreak;

  const interval = RETRIEVAL_INTERVALS[streak]!;
  let due = addDays(context.today, interval);

  // A review after the exam it was meant to prepare for is worthless.
  if (context.examOn) {
    const latestUseful = addDays(context.examOn, -RETRIEVAL_PRE_EXAM_DAYS);
    if (daysBetween(latestUseful, due) > 0 && daysBetween(context.today, latestUseful) > 0) {
      due = latestUseful;
    }
  }

  return { retrievalStreak: streak, nextRetrievalOn: due };
}

/**
 * Mastery decay. A topic that has faded comes back for retrieval; one that has
 * collapsed goes back to encoding, because more testing on something never
 * properly processed is the exact failure this method exists to prevent.
 */
export function applyDecay(state: TopicStage, pMastery: number, today: string): TopicStage {
  if (!atLeast(state.stage, 'retrieved')) return state;
  if (pMastery >= DECAY.dueThreshold) return state;

  return {
    ...state,
    nextRetrievalOn: today,
    remedial: pMastery < DECAY.remedialThreshold,
  };
}

/* ----------------------------------------------------------------- policy -- */

export interface OverlearnPolicyInput {
  stage: Stage;
  /** Days until the next exam mapped to this topic; null when none is known. */
  daysToExam: number | null;
  competitiveMode: boolean;
}

/**
 * Overlearning is a polish stage, and treating it as a starting point is the
 * single most common way students waste effort. Exam proximity alone never
 * unlocks it — the topic must already have survived interleaving.
 */
export function canOverlearn(input: OverlearnPolicyInput): boolean {
  if (input.stage !== 'interleaved') return false;
  if (input.competitiveMode) return true;
  return input.daysToExam !== null && input.daysToExam <= OVERLEARN_EXAM_WINDOW_DAYS;
}

export interface NextActionInput {
  state: TopicStage;
  today: string;
  daysToExam: number | null;
  competitiveMode: boolean;
}

/**
 * The single next thing a topic needs. One action per topic — offering a menu
 * per topic across six subjects is how a planner becomes a to-do list nobody
 * opens.
 */
export function nextAction(input: NextActionInput): StageAction | null {
  const { state, today } = input;

  // Remediation outranks everything: a collapsed topic gets re-encoded before
  // it is tested again.
  if (state.remedial) return 'encode';

  switch (state.stage) {
    case 'new':
      return 'prime';
    case 'primed':
      return 'encode';
    case 'encoded':
      return 'reference';
    case 'referenced':
      return 'retrieve';
    case 'retrieved':
      return isRetrievalDue(state, today) ? 'retrieve' : 'interleave';
    case 'interleaved':
      if (isRetrievalDue(state, today)) return 'retrieve';
      return canOverlearn({
        stage: state.stage,
        daysToExam: input.daysToExam,
        competitiveMode: input.competitiveMode,
      })
        ? 'overlearn'
        : null;
    case 'overlearned':
      return isRetrievalDue(state, today) ? 'retrieve' : null;
  }
}

export function isRetrievalDue(state: TopicStage, today: string): boolean {
  if (!state.nextRetrievalOn) return false;
  return daysBetween(state.nextRetrievalOn, today) >= 0;
}
