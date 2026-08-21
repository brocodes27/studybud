/**
 * Supabase layer for the PERIR-O stage engine (PRD v2 §5).
 *
 * Kept apart from `data.ts`, which owns the grade model. This file only loads
 * the state the planner needs and writes back what a finished session proved.
 * All the reasoning lives in `perirO.ts` and `studyPlanner.ts`, which stay pure
 * and testable — nothing here decides whether a student may advance.
 */

import { supabase } from '../lib/supabase';
import {
  applyCompletion,
  applyDecay,
  emptyTopicStage,
  evaluateGate,
  lectureDateFor,
  type GateEvidence,
  type StageAction,
  type TopicStage,
} from '../lib/perirO';
import { planDay, type DayPlan, type PlannerTopic } from '../lib/studyPlanner';
import { STAGE_EVENTS, trackStage } from '../lib/stageTelemetry';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Component kinds that behave like an exam for scheduling purposes. */
const EXAM_KINDS = new Set(['midterm', 'final', 'quiz']);

const ENROLLMENT_STAGE_SELECT = `
  id, competitive_mode,
  course:curve_courses (
    id, course_code, term_start_on,
    topics:curve_course_topics ( id, topic, week, kc_id ),
    components:curve_grading_components ( id, kind, weight, due_on )
  )
`;

/** The student's local date. Every due-date comparison is made against this. */
export function localToday(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export interface StageSnapshot {
  topics: PlannerTopic[];
  plan: DayPlan;
}

/**
 * Loads every topic the student is carrying, across every active enrollment,
 * and plans the day from it.
 *
 * Returns an empty plan rather than throwing: a planner failure must never be
 * what stops someone from studying.
 */
export async function fetchStageSnapshot(
  userId: string,
  today: string = localToday(),
  minuteBudget?: number,
): Promise<StageSnapshot> {
  const empty: StageSnapshot = { topics: [], plan: { actions: [], interleave: null, totalMinutes: 0 } };

  try {
    const { data, error } = await supabase
      .from('curve_enrollments')
      .select(ENROLLMENT_STAGE_SELECT)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) throw error;
    const enrollments = (data ?? []) as any[];
    if (enrollments.length === 0) return empty;

    // Make sure every syllabus topic has a stage row before planning; a course
    // added since the last visit would otherwise be invisible to the planner.
    await Promise.all(
      enrollments.map((enrollment) =>
        supabase.rpc('curve_backfill_topic_stages', { p_enrollment_id: enrollment.id }),
      ),
    );

    const [stageRows, mastery] = await Promise.all([
      fetchStageRows(userId),
      fetchMasteryByKc(collectKcIds(enrollments)),
    ]);

    const topics: PlannerTopic[] = [];

    for (const enrollment of enrollments) {
      const course = Array.isArray(enrollment.course) ? enrollment.course[0] : enrollment.course;
      if (!course) continue;

      const courseTopics = (course.topics ?? []) as any[];
      const exam = nextExamComponent((course.components ?? []) as any[], today);

      for (const row of courseTopics) {
        const lectureOn = lectureDateFor(course.term_start_on ?? null, row.week ?? null);
        const stage = stageRows.get(row.id) ?? emptyTopicStage();
        const pMastery = (row.kc_id && mastery.get(row.kc_id)) || 0;

        topics.push({
          topicId: row.id,
          enrollmentId: enrollment.id,
          subject: course.course_code ?? 'Course',
          title: row.topic,
          kcId: row.kc_id ?? null,
          // Decay is applied on read: a topic that faded since the last session
          // should come due now, not at the next nightly job.
          stage: applyDecay(stage, pMastery, today),
          pMastery,
          componentWeightPct: exam?.weight ?? 0,
          topicsInComponent: countTopicsBefore(courseTopics, course.term_start_on ?? null, exam?.dueOn ?? null),
          lectureOn,
          examOn: exam?.dueOn ?? null,
          competitiveMode: Boolean(enrollment.competitive_mode),
        });
      }
    }

    return { topics, plan: planDay({ today, topics, minuteBudget }) };
  } catch (err) {
    console.warn('Stage snapshot failed:', err);
    return empty;
  }
}

async function fetchStageRows(userId: string): Promise<Map<string, TopicStage>> {
  const result = new Map<string, TopicStage>();
  const { data, error } = await supabase.from('curve_topic_stage').select('*').eq('user_id', userId);
  if (error || !data) return result;

  for (const row of data as any[]) {
    result.set(row.topic_id, fromRow(row));
  }
  return result;
}

async function fetchMasteryByKc(kcIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (kcIds.length === 0) return result;

  const { data, error } = await supabase
    .from('student_cognitive_profiles')
    .select('kc_id, p_mastery')
    .in('kc_id', kcIds);

  if (error || !data) return result;
  for (const row of data as any[]) {
    result.set(row.kc_id, Number(row.p_mastery ?? 0));
  }
  return result;
}

function collectKcIds(enrollments: any[]): string[] {
  const ids = new Set<string>();
  for (const enrollment of enrollments) {
    const course = Array.isArray(enrollment.course) ? enrollment.course[0] : enrollment.course;
    for (const topic of (course?.topics ?? []) as any[]) {
      if (topic.kc_id) ids.add(topic.kc_id);
    }
  }
  return [...ids];
}

/**
 * The next graded component that behaves like an exam, which is what gives a
 * topic its weight and its deadline.
 *
 * ponytail: topics are not individually mapped to components — nothing in the
 * schema records which exam covers which topic — so every topic in a course
 * inherits that course's next exam. It is right about the deadline and roughly
 * right about the weight, which is all the ranking needs. A real topic→
 * component mapping is the upgrade, and it belongs with the concept graph work
 * (P3.3), not here.
 */
function nextExamComponent(
  components: any[],
  today: string,
): { dueOn: string; weight: number } | null {
  const upcoming = components
    .filter((component) => component.due_on && EXAM_KINDS.has(component.kind))
    .filter((component) => component.due_on >= today)
    .sort((a, b) => String(a.due_on).localeCompare(String(b.due_on)));

  const next = upcoming[0];
  return next ? { dueOn: next.due_on, weight: Number(next.weight ?? 0) } : null;
}

/** How many of a course's topics that exam plausibly covers. Never zero. */
function countTopicsBefore(topics: any[], termStartOn: string | null, examOn: string | null): number {
  if (!examOn || !termStartOn) return Math.max(topics.length, 1);
  const covered = topics.filter((topic) => {
    const lectureOn = lectureDateFor(termStartOn, topic.week ?? null);
    return !lectureOn || lectureOn <= examOn;
  });
  return Math.max(covered.length, 1);
}

function fromRow(row: any): TopicStage {
  return {
    stage: row.stage,
    remedial: Boolean(row.remedial),
    primedAt: row.primed_at ?? null,
    encodedAt: row.encoded_at ?? null,
    referencedAt: row.referenced_at ?? null,
    firstRetrievedAt: row.first_retrieved_at ?? null,
    interleavedAt: row.interleaved_at ?? null,
    overlearnedAt: row.overlearned_at ?? null,
    retrievalStreak: Number(row.retrieval_streak ?? 0),
    nextRetrievalOn: row.next_retrieval_on ?? null,
    interleaveAppearances: Number(row.interleave_appearances ?? 0),
    overlearnDrills: Number(row.overlearn_drills ?? 0),
    baselineResponseMs: row.baseline_response_ms ?? null,
  };
}

function toRow(state: TopicStage) {
  return {
    stage: state.stage,
    remedial: state.remedial,
    primed_at: state.primedAt,
    encoded_at: state.encodedAt,
    referenced_at: state.referencedAt,
    first_retrieved_at: state.firstRetrievedAt,
    interleaved_at: state.interleavedAt,
    overlearned_at: state.overlearnedAt,
    retrieval_streak: state.retrievalStreak,
    next_retrieval_on: state.nextRetrievalOn,
    interleave_appearances: state.interleaveAppearances,
    overlearn_drills: state.overlearnDrills,
    baseline_response_ms: state.baselineResponseMs,
    updated_at: new Date().toISOString(),
  };
}

export interface StageCompletion {
  userId: string;
  enrollmentId: string;
  topicId: string;
  action: StageAction;
  evidence: GateEvidence;
  /** False when the student chose this instead of the prescribed action. */
  wasPrescribed: boolean;
  durationSec?: number;
  /** Encoding artifact, primer answers, interleave breakdown. */
  payload?: Record<string, unknown>;
  examOn?: string | null;
  today?: string;
}

export interface StageCompletionResult {
  state: TopicStage;
  advanced: boolean;
  /** Why the gate did not open, when it did not. Shown to the student. */
  reason: string;
}

/**
 * Records a finished session: logs the event, advances the stage if its gate
 * opened, and persists the result.
 *
 * The event log is written first and unconditionally. It is append-only and is
 * the evidence later gates read from, so it must survive even when the stage
 * write fails.
 */
export async function recordStageCompletion(
  completion: StageCompletion,
): Promise<StageCompletionResult> {
  const today = completion.today ?? localToday();
  const before = await fetchTopicStage(completion.userId, completion.topicId);
  const gate = evaluateGate(before, completion.action, completion.evidence);

  const after = applyCompletion(before, completion.action, completion.evidence, {
    today,
    examOn: completion.examOn ?? null,
  });

  await supabase.from('curve_stage_events').insert({
    user_id: completion.userId,
    enrollment_id: completion.enrollmentId,
    topic_id: completion.topicId,
    stage_action: completion.action,
    outcome: 'completed',
    duration_sec: completion.durationSec ?? null,
    accuracy: completion.evidence.accuracy ?? null,
    rubric_score: completion.evidence.rubricScore ?? null,
    median_response_ms: completion.evidence.medianResponseMs ?? null,
    payload: completion.payload ?? {},
    was_prescribed: completion.wasPrescribed,
  });

  const { error } = await supabase
    .from('curve_topic_stage')
    .update(toRow(after))
    .eq('user_id', completion.userId)
    .eq('topic_id', completion.topicId);

  if (error) console.error('Stage write failed:', error);

  const advanced = after.stage !== before.stage;

  trackStage(STAGE_EVENTS.completed, {
    action: completion.action,
    topic_id: completion.topicId,
    from_stage: before.stage,
    was_prescribed: completion.wasPrescribed,
    duration_sec: completion.durationSec ?? null,
    accuracy: completion.evidence.accuracy ?? null,
    rubric_score: completion.evidence.rubricScore ?? null,
    advanced,
  });

  if (advanced) {
    trackStage(STAGE_EVENTS.advanced, {
      action: completion.action,
      topic_id: completion.topicId,
      from_stage: before.stage,
      to_stage: after.stage,
    });
  } else {
    // A completed session that did not clear its gate is the signal that a
    // threshold may be wrong. It has to be separable from an abandoned one.
    trackStage(STAGE_EVENTS.gateBlocked, {
      action: completion.action,
      topic_id: completion.topicId,
      stage: before.stage,
      reason: gate.reason,
    });
  }

  return { state: after, advanced, reason: gate.reason };
}

/**
 * Logs a session that did not complete. Answered items have already reached the
 * BKT engine on their own; the stage is deliberately left untouched.
 */
export async function recordStageOutcome(
  completion: Pick<StageCompletion, 'userId' | 'enrollmentId' | 'topicId' | 'action' | 'wasPrescribed'>,
  outcome: 'abandoned' | 'gate_blocked' | 'overridden',
  payload: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from('curve_stage_events').insert({
    user_id: completion.userId,
    enrollment_id: completion.enrollmentId,
    topic_id: completion.topicId,
    stage_action: completion.action,
    outcome,
    payload,
    was_prescribed: completion.wasPrescribed,
  });

  if (outcome === 'overridden') {
    // Override rate per gate is a product health metric. A rising one means a
    // threshold is wrong, not that students are.
    trackStage(STAGE_EVENTS.overrideUsed, {
      action: completion.action,
      topic_id: completion.topicId,
      ...payload,
    });
  }
}

export async function fetchTopicStage(userId: string, topicId: string): Promise<TopicStage> {
  const { data, error } = await supabase
    .from('curve_topic_stage')
    .select('*')
    .eq('user_id', userId)
    .eq('topic_id', topicId)
    .maybeSingle();

  if (error || !data) return emptyTopicStage();
  return fromRow(data);
}

/* eslint-enable @typescript-eslint/no-explicit-any */
