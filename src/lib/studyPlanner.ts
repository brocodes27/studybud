/**
 * The multi-subject daily planner (PRD v2 §3).
 *
 * Pure: no Supabase, no clock. It takes every topic the student is carrying —
 * across every enrolled course — and returns the handful of stage-correct
 * actions worth doing today.
 *
 * Two ideas do all the work here. The grade forecast decides *what* is worth
 * touching, through leverage: expected forecast movement per minute. The stage
 * machine decides *how* it gets touched. A planner with only the first is a
 * to-do list; with only the second it is a study method that ignores the exam
 * two days away.
 */

import {
  daysBetween,
  nextAction,
  PRIMING_WINDOW_DAYS,
  STAGE_MASTERY_GAIN,
  STAGE_MINUTES,
  atLeast,
  labelFor,
  type StageAction,
  type TopicStage,
} from './perirO.ts';

/** One syllabus topic, resolved against everything the planner needs to rank it. */
export interface PlannerTopic {
  topicId: string;
  enrollmentId: string;
  /** Course code — the unit of "subject" for the fairness and interleaving rules. */
  subject: string;
  title: string;
  kcId: string | null;
  stage: TopicStage;
  /** BKT posterior for this topic's knowledge component, 0–1. */
  pMastery: number;
  /** Percent of the final grade held by the component this topic feeds. */
  componentWeightPct: number;
  /** How many topics share that component. Splits its weight across them. */
  topicsInComponent: number;
  /** Derived from the course term start and the topic week; null when unscheduled. */
  lectureOn: string | null;
  /** Next exam mapped to this topic. */
  examOn: string | null;
  competitiveMode: boolean;
}

export interface PlannerInput {
  /** The student's local date, as ISO YYYY-MM-DD. */
  today: string;
  topics: PlannerTopic[];
  /** Minutes the student typically studies. Defaults to 90. */
  minuteBudget?: number;
}

export interface PlannedAction {
  topicId: string;
  enrollmentId: string;
  subject: string;
  title: string;
  action: StageAction;
  minutes: number;
  leverage: number;
  /** One line the card shows the student. Never prescribe without a reason. */
  why: string;
  /** True when a hard override put this here rather than its leverage score. */
  forced: boolean;
}

export interface InterleaveBlock {
  /** Topics the mixed set draws from, spanning at least two subjects. */
  topicIds: string[];
  subjects: string[];
  minutes: number;
  why: string;
}

export interface DayPlan {
  actions: PlannedAction[];
  interleave: InterleaveBlock | null;
  totalMinutes: number;
}

export const PLANNER_LIMITS = {
  maxActions: 3,
  /** No student with five courses should open the app to a queue of one subject. */
  maxPerSubject: 2,
  maxPrimingOverrides: 2,
  maxRetrievalOverrides: 3,
  defaultMinuteBudget: 90,
  /** An interleaved set is not worth assembling below this many ready topics. */
  interleaveMinTopics: 6,
  interleaveMinSubjects: 2,
  interleaveItemCount: 12,
} as const;

/** Exam pressure ramps over the last three weeks. */
const EXAM_HORIZON_DAYS = 21;

/**
 * Weight multiplier for how close an exam is. Flat 1.0 when no exam is known,
 * rising to 2.0 on the exam date itself.
 */
export function examProximityFactor(today: string, examOn: string | null): number {
  if (!examOn) return 1;
  const days = daysBetween(today, examOn);
  if (days < 0) return 1;
  return 1 + Math.max(0, (EXAM_HORIZON_DAYS - days) / EXAM_HORIZON_DAYS);
}

/**
 * Expected forecast movement per minute spent.
 *
 * ponytail: STAGE_MASTERY_GAIN is a table of hypotheses from the framework, not
 * measurements from our own cohorts. It is the one number in this file worth
 * refitting against observed mastery deltas once telemetry lands (PRD §9, P3.2).
 */
export function leverageOf(topic: PlannerTopic, action: StageAction, today: string): number {
  const gain = STAGE_MASTERY_GAIN[action];
  const minutes = STAGE_MINUTES[action];
  const share = topic.topicsInComponent > 0 ? 1 / topic.topicsInComponent : 1;
  return (gain * share * topic.componentWeightPct * examProximityFactor(today, topic.examOn)) / minutes;
}

function daysToExam(today: string, examOn: string | null): number | null {
  if (!examOn) return null;
  const days = daysBetween(today, examOn);
  return days < 0 ? null : days;
}

/** Is this topic's lecture close enough that priming it now still helps? */
export function inPrimingWindow(topic: PlannerTopic, today: string): boolean {
  if (topic.stage.stage !== 'new' || !topic.lectureOn) return false;
  const days = daysBetween(today, topic.lectureOn);
  return days >= 0 && days <= PRIMING_WINDOW_DAYS;
}

function whyFor(topic: PlannerTopic, action: StageAction, today: string): string {
  if (topic.stage.remedial) return 'This one has faded — worth rebuilding before testing it again';
  switch (action) {
    case 'prime': {
      if (!topic.lectureOn) return 'Not covered yet — a few minutes now makes the lecture stick';
      const days = daysBetween(today, topic.lectureOn);
      if (days <= 0) return 'Lecture is today';
      return days === 1 ? 'Lecture is tomorrow' : `Lecture in ${days} days`;
    }
    case 'encode':
      return 'Covered in class, never actually processed';
    case 'reference':
      return 'Park the details so they stop crowding your thinking';
    case 'retrieve': {
      const streak = topic.stage.retrievalStreak;
      if (topic.stage.nextRetrievalOn && daysBetween(topic.stage.nextRetrievalOn, today) >= 0) {
        return streak > 0 ? `Review ${streak + 1} — due today` : 'Due today';
      }
      return 'Ready for a closed-book test';
    }
    case 'interleave':
      return 'Time to see if it holds up mixed with everything else';
    case 'overlearn': {
      const days = daysToExam(today, topic.examOn);
      return days === null ? 'Speed drill' : `Exam in ${days} days — build speed`;
    }
  }
}

interface Candidate extends PlannedAction {
  forceRank: number; // 0 = priming override, 1 = retrieval override, 2 = ranked
}

/**
 * Builds today's queue.
 *
 * Order of operations matters: hard overrides claim their slots first, because
 * a lecture happening tomorrow and a review that is already due are both
 * time-bound in a way that leverage scoring cannot see. Everything else
 * competes on leverage.
 */
export function planDay(input: PlannerInput): DayPlan {
  const { today, topics } = input;
  const budget = input.minuteBudget ?? PLANNER_LIMITS.defaultMinuteBudget;

  const candidates: Candidate[] = [];

  for (const topic of topics) {
    const action = nextAction({
      state: topic.stage,
      today,
      daysToExam: daysToExam(today, topic.examOn),
      competitiveMode: topic.competitiveMode,
    });
    if (!action) continue;

    // Interleaving is pooled across subjects, not scheduled per topic (§3.5).
    if (action === 'interleave') continue;

    const priming = action === 'prime' && inPrimingWindow(topic, today);
    const retrievalDue =
      action === 'retrieve' &&
      topic.stage.nextRetrievalOn !== null &&
      daysBetween(topic.stage.nextRetrievalOn, today) >= 0;

    candidates.push({
      topicId: topic.topicId,
      enrollmentId: topic.enrollmentId,
      subject: topic.subject,
      title: topic.title,
      action,
      minutes: STAGE_MINUTES[action],
      leverage: leverageOf(topic, action, today),
      why: whyFor(topic, action, today),
      forced: priming || retrievalDue,
      forceRank: priming ? 0 : retrievalDue ? 1 : 2,
    });
  }

  const forced = [
    ...capped(
      candidates.filter((c) => c.forceRank === 0),
      PLANNER_LIMITS.maxPrimingOverrides,
      (a, b) => b.leverage - a.leverage,
    ),
    ...capped(
      candidates.filter((c) => c.forceRank === 1),
      PLANNER_LIMITS.maxRetrievalOverrides,
      // Oldest due first: a review already three days late decays fastest.
      (a, b) => a.title.localeCompare(b.title),
    ),
  ];

  const ranked = candidates
    .filter((c) => c.forceRank === 2)
    .sort((a, b) => b.leverage - a.leverage);

  const selected = select([...forced, ...ranked], budget);

  return {
    actions: selected.map(stripInternal),
    interleave: buildInterleaveBlock(topics, selected),
    totalMinutes: selected.reduce((sum, action) => sum + action.minutes, 0),
  };
}

function capped<T>(items: T[], limit: number, sort: (a: T, b: T) => number): T[] {
  return items.slice().sort(sort).slice(0, limit);
}

/**
 * Applies the three selection limits in one pass: total actions, per-subject
 * fairness, and the minute budget.
 *
 * Forced actions are exempt from the budget trim. They are time-bound by
 * definition, and at most 2 primings plus 3 reviews is well under any realistic
 * budget — if a student's budget is genuinely smaller than that, the honest
 * answer is a short queue of the time-critical work, not a balanced one.
 */
function select(candidates: Candidate[], budget: number): Candidate[] {
  const chosen: Candidate[] = [];
  const perSubject = new Map<string, number>();
  let minutes = 0;

  for (const candidate of candidates) {
    if (chosen.length >= PLANNER_LIMITS.maxActions) break;

    const used = perSubject.get(candidate.subject) ?? 0;
    if (used >= PLANNER_LIMITS.maxPerSubject) continue;

    if (!candidate.forced && minutes + candidate.minutes > budget) continue;

    chosen.push(candidate);
    perSubject.set(candidate.subject, used + 1);
    minutes += candidate.minutes;
  }

  return chosen;
}

function stripInternal(candidate: Candidate): PlannedAction {
  const { forceRank: _forceRank, ...action } = candidate;
  return action;
}

/**
 * Assembles the day's single interleaved set.
 *
 * Interleaving is the one stage that cannot belong to a topic — its whole
 * purpose is testing across topics and subjects in an order the student cannot
 * predict. It is offered only once there is enough ready material for the mix
 * to be real; four questions from two topics is blocked practice in a costume.
 */
export function buildInterleaveBlock(
  topics: PlannerTopic[],
  selected: PlannedAction[],
): InterleaveBlock | null {
  const busy = new Set(selected.map((action) => action.topicId));

  const ready = topics.filter(
    (topic) =>
      atLeast(topic.stage.stage, 'retrieved') &&
      !topic.stage.remedial &&
      topic.kcId !== null &&
      !busy.has(topic.topicId),
  );

  if (ready.length < PLANNER_LIMITS.interleaveMinTopics) return null;

  const subjects = [...new Set(ready.map((topic) => topic.subject))];
  if (subjects.length < PLANNER_LIMITS.interleaveMinSubjects) return null;

  return {
    topicIds: ready.map((topic) => topic.topicId),
    subjects,
    minutes: STAGE_MINUTES.interleave,
    why: `${PLANNER_LIMITS.interleaveItemCount} mixed questions across ${subjects.length} subjects`,
  };
}

/** Card heading for a planned action, e.g. "Encode · Organic Chemistry". */
export function headingFor(action: PlannedAction): string {
  return `${labelFor(action.action)} · ${action.subject}`;
}
