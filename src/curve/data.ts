import { supabase } from '../lib/supabase';
import {
  computeCurrentStanding,
  computeGpa,
  projectFinalGrade,
  round,
  type ComponentKind,
  type CurrentStanding,
  type GradeScale,
  type GradingComponent,
  type Projection,
  type ScoreEntry,
} from './gradeEngine';
import type { CurveTone } from './ui';

export interface CurveCourse {
  id: string;
  courseCode: string;
  title: string;
  instructorName: string | null;
  term: string;
  creditHours: number;
  gradeScale: GradeScale | null;
  /**
   * First day of week 1. Lecture dates for the course's topics derive from
   * this, so a null here means the priming window never fires for this course.
   */
  termStartOn: string | null;
}

/** A returned score, carrying the row identity the detail page needs to edit it. */
export interface ScoreRow extends ScoreEntry {
  id: string;
  label: string | null;
  gradedOn: string | null;
}

export interface ComponentRow extends GradingComponent {
  dueOn: string | null;
}

export interface CourseSnapshot {
  enrollmentId: string;
  course: CurveCourse;
  tone: CurveTone;
  creditHours: number;
  targetLetter: string | null;
  components: ComponentRow[];
  scores: ScoreEntry[];
  scoreRows: ScoreRow[];
  standing: CurrentStanding;
  projection: Projection;
  nextDue: { name: string; dueOn: string; daysAway: number } | null;
  mastery: MasteryInfo | null;
}

export interface MasteryInfo {
  avgMastery: number;
  profiledTopics: number;
  totalTopics: number;
}

const TONES: CurveTone[] = ['violet', 'amber', 'mint', 'blush'];

function toTone(value: unknown, index: number): CurveTone {
  return TONES.includes(value as CurveTone) ? (value as CurveTone) : TONES[index % TONES.length]!;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function daysUntil(dateIso: string): number {
  return Math.round((startOfDay(new Date(dateIso)) - startOfDay(new Date())) / 86_400_000);
}

const ENROLLMENT_SELECT = `
  id, tone, credit_hours, target_letter,
  course:curve_courses (
    id, course_code, title, instructor_name, term, credit_hours, grade_scale, term_start_on,
    components:curve_grading_components ( id, name, kind, weight, drop_lowest, due_on, position )
  ),
  scores:curve_scores ( id, component_id, label, points_earned, points_possible, graded_on )
`;

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Reads the BKT mastery snapshot for an enrollment. Falls back to null when
 * the RPC is unavailable (migration not yet applied) so the app still works
 * on the deterministic engine alone.
 */
async function fetchMastery(enrollmentId: string): Promise<MasteryInfo | null> {
  const { data, error } = await supabase.rpc('curve_mastery_for_enrollment', {
    p_enrollment_id: enrollmentId,
  });
  if (error || !data) return null;
  const totalTopics = Number(data.topics ?? 0);
  const profiledTopics = Number(data.profiled_topics ?? 0);
  const avgMastery = Number(data.avg_mastery ?? 0);
  if (totalTopics <= 0 || profiledTopics <= 0) return null;
  return { avgMastery, profiledTopics, totalTopics };
}

function buildSnapshot(row: any, index: number, mastery: MasteryInfo | null = null): CourseSnapshot {
  const courseRow = Array.isArray(row.course) ? row.course[0] : row.course;

  const components: ComponentRow[] = ((courseRow?.components ?? []) as any[])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((component) => ({
      id: component.id,
      name: component.name,
      kind: component.kind as ComponentKind,
      weight: Number(component.weight),
      dropLowest: Number(component.drop_lowest ?? 0),
      dueOn: component.due_on ?? null,
    }));

  const scoreRows: ScoreRow[] = ((row.scores ?? []) as any[]).map((score) => ({
    id: score.id,
    componentId: score.component_id,
    label: score.label ?? null,
    pointsEarned: Number(score.points_earned),
    pointsPossible: Number(score.points_possible),
    gradedOn: score.graded_on ?? null,
  }));

  const scores: ScoreEntry[] = scoreRows.map((score) => ({
    componentId: score.componentId,
    pointsEarned: score.pointsEarned,
    pointsPossible: score.pointsPossible,
  }));

  const scale: GradeScale | null = courseRow?.grade_scale ?? null;
  const standing = computeCurrentStanding(components, scores, scale ?? undefined);

  // Mastery feeds the ungraded-performance assumption: the BKT posterior is
  // the expected fraction on work still to come, and evidence strength is the
  // share of syllabus topics with actual knowledge traces.
  const projection = projectFinalGrade(components, scores, {
    scale: scale ?? undefined,
    ...(mastery
      ? { expectedFraction: mastery.avgMastery, evidenceStrength: mastery.profiledTopics / mastery.totalTopics }
      : {}),
  });

  const gradedComponentIds = new Set(scores.map((score) => score.componentId));
  const upcoming = components
    .filter((component) => component.dueOn && !gradedComponentIds.has(component.id))
    .map((component) => ({
      name: component.name,
      dueOn: component.dueOn!,
      daysAway: daysUntil(component.dueOn!),
    }))
    .filter((item) => item.daysAway >= 0)
    .sort((a, b) => a.daysAway - b.daysAway);

  return {
    enrollmentId: row.id,
    course: {
      id: courseRow?.id,
      courseCode: courseRow?.course_code ?? 'Course',
      title: courseRow?.title ?? 'Untitled course',
      instructorName: courseRow?.instructor_name ?? null,
      term: courseRow?.term ?? '',
      creditHours: Number(courseRow?.credit_hours ?? 3),
      gradeScale: scale,
      termStartOn: courseRow?.term_start_on ?? null,
    },
    tone: toTone(row.tone, index),
    creditHours: Number(row.credit_hours ?? courseRow?.credit_hours ?? 3),
    targetLetter: row.target_letter ?? null,
    components,
    scores,
    scoreRows,
    standing,
    projection,
    nextDue: upcoming[0] ?? null,
    mastery,
  };
}

/**
 * Loads every active enrollment with its syllabus components and returned
 * scores, then runs the grade engine over each one.
 *
 * When the BKT mastery substrate has traces for the course's topics, the
 * ungraded portion is modeled at the mastery posterior; otherwise it is
 * assumed to continue at the student's current pace.
 */
export function getLocalSnapshots(userId: string): CourseSnapshot[] {
  try {
    const raw = localStorage.getItem(`curve_local_snapshots_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalSnapshot(userId: string, snapshot: CourseSnapshot) {
  try {
    const existing = getLocalSnapshots(userId);
    const updated = [snapshot, ...existing.filter((s) => s.enrollmentId !== snapshot.enrollmentId)];
    localStorage.setItem(`curve_local_snapshots_${userId}`, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Loads every active enrollment with its syllabus components and returned
 * scores, then runs the grade engine over each one.
 *
 * Merges Supabase remote enrollments with local snapshots so courses never
 * vanish even if network requests fail or table migrations are missing.
 */
export async function fetchCourseSnapshots(userId: string): Promise<CourseSnapshot[]> {
  const localSnapshots = getLocalSnapshots(userId);
  try {
    const { data, error } = await supabase
      .from('curve_enrollments')
      .select(ENROLLMENT_SELECT)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true });

    if (error) throw error;
    const rows = ((data ?? []) as any[]).map((row, index) =>
      fetchMastery(row.id).then((mastery) => buildSnapshot(row, index, mastery)),
    );
    const remoteSnapshots = await Promise.all(rows);
    remoteSnapshots.forEach((snap) => {
      saveLocalSnapshot(userId, snap);
      recordForecastDaily(snap).catch(console.error);
    });

    const remoteIds = new Set(remoteSnapshots.map((s) => s.enrollmentId));
    const extraLocal = localSnapshots.filter((s) => !remoteIds.has(s.enrollmentId));
    return [...remoteSnapshots, ...extraLocal];
  } catch (err) {
    console.warn('Supabase fetch failed, returning local snapshots:', err);
    return localSnapshots;
  }
}

export async function fetchCourseSnapshot(
  userId: string,
  enrollmentId: string,
): Promise<CourseSnapshot | null> {
  try {
    const { data, error } = await supabase
      .from('curve_enrollments')
      .select(ENROLLMENT_SELECT)
      .eq('user_id', userId)
      .eq('id', enrollmentId)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      const snap = buildSnapshot(data, 0, await fetchMastery(enrollmentId));
      saveLocalSnapshot(userId, snap);
      return snap;
    }
  } catch {
    // Fall back to local storage
  }

  const local = getLocalSnapshots(userId);
  return local.find((s) => s.enrollmentId === enrollmentId) ?? null;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export interface NewCourseInput {
  courseCode: string;
  title: string;
  instructorName?: string | null;
  term: string;
  creditHours: number;
  tone?: CurveTone;
  targetLetter?: string | null;
  components: Array<{
    name: string;
    kind: ComponentKind;
    weight: number;
    dropLowest?: number;
    dueOn?: string | null;
  }>;
  /** Weekly syllabus topics, persisted into the BKT substrate after save. */
  topics?: Array<{ topic: string; week: number }>;
  /**
   * First day of week 1. Lecture dates are derived from this plus each topic's
   * week, so without it the priming window never fires for the course.
   */
  termStartOn?: string | null;
}

/**
 * Links syllabus topics to the course's knowledge substrate. Each topic is
 * canonicalized into knowledge_components (idempotent by name) and mapped to
 * the course by week; later BKT traces key off these kc_ids. Failures are
 * logged and swallowed: a topic mapping problem must never block saving a
 * course.
 */
export async function persistCourseTopics(
  courseId: string,
  topics: Array<{ topic: string; week: number }>,
): Promise<void> {
  for (const topic of topics) {
    const { error } = await supabase.rpc('curve_ensure_course_kc', {
      p_course_id: courseId,
      p_topic: topic.topic,
      p_week: topic.week,
    });
    if (error) console.error('Topic persistence failed:', error);
  }
}

/**
 * Creates a student-owned course with its grading components and enrolls the
 * student in it. Saves locally first so the course IMMEDIATELY appears on the
 * dashboard, and syncs to Supabase.
 */
export async function createCourseWithComponents(
  userId: string,
  input: NewCourseInput,
): Promise<{ enrollmentId: string; courseId: string }> {
  const localCourseId = crypto.randomUUID();
  const localEnrollmentId = `local-${crypto.randomUUID()}`;

  const localComponents: ComponentRow[] = input.components.map((c, idx) => ({
    id: `comp-${idx}-${crypto.randomUUID()}`,
    name: c.name,
    kind: c.kind,
    weight: c.weight,
    dropLowest: c.dropLowest ?? 0,
    dueOn: c.dueOn || null,
  }));

  const localSnapshot: CourseSnapshot = {
    enrollmentId: localEnrollmentId,
    course: {
      id: localCourseId,
      courseCode: input.courseCode.trim(),
      title: input.title.trim(),
      instructorName: input.instructorName?.trim() || null,
      term: input.term.trim(),
      creditHours: input.creditHours,
      gradeScale: null,
      termStartOn: input.termStartOn ?? null,
    },
    tone: input.tone ?? 'violet',
    creditHours: input.creditHours,
    targetLetter: input.targetLetter ?? null,
    components: localComponents,
    scores: [],
    scoreRows: [],
    standing: computeCurrentStanding(localComponents, []),
    projection: projectFinalGrade(localComponents, []),
    nextDue: null,
    mastery: null,
  };

  saveLocalSnapshot(userId, localSnapshot);

  try {
    const { data: course, error: courseError } = await supabase
      .from('curve_courses')
      .insert({
        course_code: input.courseCode.trim(),
        title: input.title.trim(),
        instructor_name: input.instructorName?.trim() || null,
        term: input.term.trim(),
        term_start_on: input.termStartOn || null,
        credit_hours: input.creditHours,
        is_catalog: false,
        created_by: userId,
      })
      .select('id')
      .single();

    if (courseError || !course) throw courseError ?? new Error('Could not create the course.');

    if (input.components.length > 0) {
      const { error: componentError } = await supabase.from('curve_grading_components').insert(
        input.components.map((component, index) => ({
          course_id: course.id,
          name: component.name.trim(),
          kind: component.kind,
          weight: component.weight,
          drop_lowest: component.dropLowest ?? 0,
          due_on: component.dueOn || null,
          position: index,
        })),
      );
      if (componentError) console.error('Component insert error:', componentError);
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('curve_enrollments')
      .insert({
        user_id: userId,
        course_id: course.id,
        credit_hours: input.creditHours,
        tone: input.tone ?? 'violet',
        target_letter: input.targetLetter ?? null,
      })
      .select('id')
      .single();

    if (enrollmentError || !enrollment) throw enrollmentError ?? new Error('Could not enroll in the course.');

    if (input.topics && input.topics.length > 0) {
      await persistCourseTopics(course.id, input.topics).catch(console.error);
    }

    const remoteSnapshot: CourseSnapshot = {
      ...localSnapshot,
      enrollmentId: enrollment.id,
      course: { ...localSnapshot.course, id: course.id },
    };
    saveLocalSnapshot(userId, remoteSnapshot);

    return { enrollmentId: enrollment.id, courseId: course.id };
  } catch (err) {
    console.warn('Saved course locally due to Supabase error:', err);
    return { enrollmentId: localEnrollmentId, courseId: localCourseId };
  }
}

/**
 * Sets the course's term start, which is what switches priming on.
 *
 * Courses created before the stage engine shipped have no term start, so their
 * topics have no lecture dates and the priming window can never fire for them.
 * Rather than guessing from due dates, the course page asks once.
 */
export async function setTermStart(courseId: string, termStartOn: string): Promise<boolean> {
  const { error } = await supabase
    .from('curve_courses')
    .update({ term_start_on: termStartOn })
    .eq('id', courseId);
  if (error) {
    console.warn('Could not save the term start:', error.message);
    return false;
  }
  return true;
}

/**
 * Marks every topic up to a given syllabus week as already covered in class,
 * moving it from 'new' to 'primed'.
 *
 * A student joining mid-semester should not be told to prime a lecture that
 * happened weeks ago. Sitting through the lecture is what priming prepares you
 * for, so those topics belong at Encoding — which is where 'primed' sends them.
 *
 * Returns how many topics moved. Failures are swallowed: this is a convenience
 * on top of a saved course, never a reason to lose one.
 */
export async function markTopicsCovered(
  enrollmentId: string,
  throughWeek: number,
): Promise<number> {
  if (!Number.isFinite(throughWeek) || throughWeek < 1) return 0;
  const { data, error } = await supabase.rpc('curve_mark_topics_covered', {
    p_enrollment_id: enrollmentId,
    p_through_week: Math.floor(throughWeek),
  });
  if (error) {
    console.warn('Could not mark topics as covered:', error.message);
    return 0;
  }
  return Number(data ?? 0);
}

/**
 * Publishes a shareable forecast card. Returns the public slug; the receipt
 * is visible to anyone on /m/:slug, so it only carries the projection band,
 * never individual scores or student identity.
 */
export async function createForecastReceipt(
  userId: string,
  snapshot: CourseSnapshot,
): Promise<string> {
  const slug = `cv-${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await supabase.from('curve_forecast_receipts').insert({
    slug,
    user_id: userId,
    enrollment_id: snapshot.enrollmentId,
    course_code: snapshot.course.courseCode,
    course_title: snapshot.course.title,
    institution_name: null,
    projected_letter: snapshot.projection.letter,
    low_percent: round(snapshot.projection.low, 1),
    high_percent: round(snapshot.projection.high, 1),
    next_exam_name: snapshot.nextDue?.name ?? null,
    days_to_exam: snapshot.nextDue?.daysAway ?? null,
    public_visible: true,
  });
  if (error) throw error;
  return slug;
}

export async function addScore(input: {
  enrollmentId: string;
  componentId: string;
  label?: string | null;
  pointsEarned: number;
  pointsPossible: number;
  gradedOn?: string | null;
  /**
   * True for the component's FINAL course grade (or high-stakes exam logged
   * by the student as the official number). Terminal scores settle every
   * open forecast for this enrollment via DB trigger (see
   * 20260804000000_curve_accuracy_trigger.sql) — that's the WVL truth loop.
   */
  isTerminalGrade?: boolean;
}): Promise<void> {
  const { error } = await supabase.from('curve_scores').insert({
    enrollment_id: input.enrollmentId,
    component_id: input.componentId,
    label: input.label?.trim() || null,
    points_earned: input.pointsEarned,
    points_possible: input.pointsPossible,
    graded_on: input.gradedOn || new Date().toISOString().slice(0, 10),
    is_terminal_grade: Boolean(input.isTerminalGrade),
  });

  if (error) throw error;
}

export async function deleteScore(scoreId: string): Promise<void> {
  const { error } = await supabase.from('curve_scores').delete().eq('id', scoreId);
  if (error) throw error;
}

export async function updateEnrollment(
  enrollmentId: string,
  patch: { tone?: CurveTone; targetLetter?: string | null; status?: 'active' | 'completed' | 'dropped' },
): Promise<void> {
  const { error } = await supabase
    .from('curve_enrollments')
    .update({
      ...(patch.tone ? { tone: patch.tone } : {}),
      ...(patch.targetLetter !== undefined ? { target_letter: patch.targetLetter } : {}),
      ...(patch.status ? { status: patch.status } : {}),
    })
    .eq('id', enrollmentId);

  if (error) throw error;
}

export async function removeEnrollment(enrollmentId: string): Promise<void> {
  const { error } = await supabase.from('curve_enrollments').delete().eq('id', enrollmentId);
  if (error) throw error;
}

/** Credit-weighted projected GPA across the loaded courses. */
export function projectedGpa(snapshots: CourseSnapshot[]): number | null {
  return computeGpa(
    snapshots.map((snapshot) => ({
      creditHours: snapshot.creditHours,
      percent: snapshot.projection.percent,
    })),
  );
}

/**
 * Ranks courses by where attention pays off most: closest deadline first,
 * weighted by how much of the grade is still in play and how far the current
 * projection sits below the student's target.
 */
export function rankByLeverage(snapshots: CourseSnapshot[]): CourseSnapshot[] {
  return [...snapshots].sort((a, b) => leverageScore(b) - leverageScore(a));
}

function leverageScore(snapshot: CourseSnapshot): number {
  const atStake = snapshot.standing.ungradedWeight / 100;
  const urgency = snapshot.nextDue ? 1 / (1 + snapshot.nextDue.daysAway / 7) : 0.25;
  const shortfall = Math.max(0, 85 - snapshot.projection.percent) / 100;
  return atStake * 0.4 + urgency * 0.35 + shortfall * 0.25;
}

/**
 * Persists a forecast so calibration error can be measured later, at most
 * once a day per enrollment so a page refresh does not skew the record.
 */
export async function recordForecastDaily(snapshot: CourseSnapshot): Promise<void> {
  const since = new Date(Date.now() - 86_400_000).toISOString();

  const { count, error: countError } = await supabase
    .from('curve_forecasts')
    .select('id', { count: 'exact', head: true })
    .eq('enrollment_id', snapshot.enrollmentId)
    .gte('created_at', since);

  if (countError || (count ?? 0) > 0) return;

  await supabase.from('curve_forecasts').insert({
    enrollment_id: snapshot.enrollmentId,
    projected_percent: snapshot.projection.percent,
    low_percent: snapshot.projection.low,
    high_percent: snapshot.projection.high,
    projected_letter: snapshot.projection.letter,
    confidence: snapshot.projection.confidence,
    graded_weight: snapshot.standing.gradedWeight,
    horizon_days: snapshot.nextDue?.daysAway ?? null,
  });
}
