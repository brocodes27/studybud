import { supabase } from './supabase';
import { awardXp, updateStreak, XP_REWARDS } from './gamification';

export type TaskType = 'assignment' | 'prescription' | 'weak_area' | 'correction_sprint' | 'none';

export interface ClassUpdate {
  type: 'class_session' | 'announcement' | 'assignment_due' | 'meeting_note' | 'none';
  title: string;
  content: string;
  source: string;
  timestamp: string;
  sessions?: Array<{ subject: string; topics: string[]; homework?: string }>;
  metadata?: any;
}

export interface TodayTask {
  type: TaskType;
  id: string;
  title: string;
  description: string;
  subject?: string;
  durationMin?: number;
  urgency: 'critical' | 'high' | 'normal' | 'low';
  actionRoute?: string;
  actionLabel: string;
  completed: boolean;
  implementationIntentions?: Array<{ trigger: string; action: string; duration_min: number; completed?: boolean }>;
  prescriptionId?: string;
  sprintId?: string;
  taskOrder?: number;
  strategy?: string;
  resources?: string[];
  outputSubmitted?: boolean;
  taskType?: string;
}

export interface CorrectionSprint {
  id: string;
  sprintName: string;
  estimatedDays: number;
  tasksRemaining: number;
  status: string;
}

export interface StudentState {
  preferredTime: string;
  typicalSessionDuration: number;
  weakSubjects: string[];
  backlogCount: number;
  missedDaysStreak: number;
}

export interface DailyBriefingMemory {
  id: string;
  topic?: string;
  subject?: string;
  knowledgeType?: string;
  content: string;
  createdAt?: string;
}

export interface DailyBriefingSubmission {
  id: string;
  outputType: string;
  taskOrder: number;
  createdAt?: string;
  analysis?: {
    effort_score?: number;
    accuracy_score?: number;
    feedback?: string;
    next_steps?: string[];
  } | null;
}

export interface DailyBriefingData {
  greeting: string;
  userName: string;
  streak: number;
  classUpdate: ClassUpdate;
  todayTask: TodayTask;
  todayTasks: TodayTask[];
  isTaskCompleted: boolean;
  allTasksCompleted: boolean;
  completedCount: number;
  totalCount: number;
  hasPlan: boolean;
  hasClasses: boolean;
  activeRoadmap: boolean;
  roadmapId: string | null;
  prescriptionId: string | null;
  correctionSprint: CorrectionSprint | null;
  studentState: StudentState;
  totalEstimatedMinutes: number;
  implementationIntentions: Array<{ trigger: string; action: string; duration_min: number; completed?: boolean }>;
  recentKnowledge: DailyBriefingMemory[];
  recentSubmissions: DailyBriefingSubmission[];
}

interface TaskCompletionOptions {
  taskTitle?: string;
  subject?: string;
  notes?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTodayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

// Query DB for today's task completions
export async function isTaskCompletedToday(userId: string, sourceType: string, sourceId: string, taskOrder: number = 0): Promise<boolean> {
  try {
    const todayStr = getTodayDateStr();
    const { data, error } = await supabase
      .from('task_completions_v2')
      .select('id')
      .eq('user_id', userId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('task_order', taskOrder)
      .eq('scheduled_date', todayStr)
      .limit(1)
      .maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}

async function insertTaskCompletion(
  userId: string,
  sourceType: 'prescription' | 'sprint' | 'assignment' | 'weak_area',
  sourceId: string,
  taskOrder: number,
  actualDurationMin?: number,
  engagementScore?: number,
  options?: TaskCompletionOptions
): Promise<{ success: boolean; error?: string }> {
  console.log('[DEBUG insertTaskCompletion] writing completion:', { userId, sourceType, sourceId, taskOrder });
  const payload = {
    user_id: userId,
    source_type: sourceType,
    source_id: sourceId,
    task_order: taskOrder,
    task_title: options?.taskTitle ?? null,
    subject: options?.subject ?? null,
    completed_at: new Date().toISOString(),
    scheduled_date: getTodayDateStr(),
    actual_duration_min: actualDurationMin,
    engagement_score: engagementScore,
    notes: options?.notes ?? null,
  };

  // 1. Try upsert (requires unique index)
  const { error: upsertError } = await supabase
    .from('task_completions_v2')
    .upsert(payload, {
      onConflict: 'user_id,source_type,source_id,task_order,scheduled_date',
      ignoreDuplicates: false,
    });

  if (!upsertError) return { success: true };

  console.warn('task_completions_v2 upsert failed:', upsertError.message);

  // 2. Fall back to plain INSERT if the unique constraint is missing.
  //    This at least lets first-time completions land in the DB.
  const { error: insertError } = await supabase
    .from('task_completions_v2')
    .insert(payload);

  if (!insertError) return { success: true };

  // If INSERT also failed because row already exists, treat as success
  const msg = insertError.message || '';
  if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already exists')) {
    return { success: true };
  }

  console.error('task_completions_v2 insert failed:', insertError);
  return { success: false, error: insertError.message };
}

async function syncSourceTaskCompletion(
  userId: string,
  sourceType: 'prescription' | 'sprint' | 'assignment' | 'weak_area',
  sourceId: string,
  taskOrder: number
): Promise<void> {
  if (sourceType === 'prescription') {
    const { data: prescription } = await supabase
      .from('daily_prescriptions')
      .select('tasks, status')
      .eq('id', sourceId)
      .eq('user_id', userId)
      .maybeSingle();

    const tasks = Array.isArray(prescription?.tasks) ? prescription.tasks : [];
    if (!tasks.length) return;

    const updatedTasks = tasks.map((task: any, index: number) => {
      const order = typeof task?.order === 'number' ? task.order : index;
      return order === taskOrder ? { ...task, completed: true } : task;
    });
    const allCompleted = updatedTasks.every((task: any) => !!task?.completed);

    await supabase
      .from('daily_prescriptions')
      .update({
        tasks: updatedTasks,
        status: allCompleted ? 'completed' : prescription?.status || 'active',
      })
      .eq('id', sourceId)
      .eq('user_id', userId);
    return;
  }

  if (sourceType === 'sprint') {
    const { data: sprint } = await supabase
      .from('correction_sprints')
      .select('sprint_tasks, status')
      .eq('id', sourceId)
      .eq('user_id', userId)
      .maybeSingle();

    const tasks = Array.isArray(sprint?.sprint_tasks) ? sprint.sprint_tasks : [];
    if (!tasks.length) return;

    const updatedTasks = tasks.map((task: any, index: number) => {
      const order = typeof task?.order === 'number' ? task.order : index;
      return order === taskOrder ? { ...task, completed: true } : task;
    });
    const allCompleted = updatedTasks.every((task: any) => !!task?.completed);

    await supabase
      .from('correction_sprints')
      .update({
        sprint_tasks: updatedTasks,
        status: allCompleted ? 'completed' : sprint?.status || 'active',
        completed_at: allCompleted ? new Date().toISOString() : null,
      })
      .eq('id', sourceId)
      .eq('user_id', userId);
  }
}

// Mark a task complete via RPC function + award XP
export async function markTaskCompleted(
  userId: string,
  sourceType: 'prescription' | 'sprint' | 'assignment' | 'weak_area',
  sourceId: string,
  taskOrder: number = 0,
  actualDurationMin?: number,
  engagementScore?: number,
  options?: TaskCompletionOptions
): Promise<{ success: boolean; xpEarned?: number; levelUp?: boolean; newLevel?: number; error?: string }> {
  try {
    let success = false;
    let failureReason: string | undefined;

    if (sourceType === 'prescription') {
      const { error } = await supabase.rpc('mark_prescription_task_complete', {
        p_user_id: userId,
        p_prescription_id: sourceId,
        p_task_order: taskOrder,
        p_actual_duration_min: actualDurationMin ?? null,
        p_engagement_score: engagementScore ?? null,
      });
      success = !error;
      if (!success) {
        failureReason = error?.message || 'RPC completion write failed';
        console.error('mark_prescription_task_complete failed:', error);
        const fallback = await insertTaskCompletion(userId, sourceType, sourceId, taskOrder, actualDurationMin, engagementScore, options);
        success = fallback.success;
        if (!success) {
          failureReason = fallback.error || failureReason;
        } else {
          await syncSourceTaskCompletion(userId, sourceType, sourceId, taskOrder);
        }
      }
    } else if (sourceType === 'sprint') {
      const { error } = await supabase.rpc('mark_sprint_task_complete', {
        p_user_id: userId,
        p_sprint_id: sourceId,
        p_task_order: taskOrder,
        p_actual_duration_min: actualDurationMin ?? null,
      });
      success = !error;
      if (!success) {
        failureReason = error?.message || 'RPC completion write failed';
        console.error('mark_sprint_task_complete failed:', error);
        const fallback = await insertTaskCompletion(userId, sourceType, sourceId, taskOrder, actualDurationMin, engagementScore, options);
        success = fallback.success;
        if (!success) {
          failureReason = fallback.error || failureReason;
        } else {
          await syncSourceTaskCompletion(userId, sourceType, sourceId, taskOrder);
        }
      }
    } else {
      const fallback = await insertTaskCompletion(userId, sourceType, sourceId, taskOrder, actualDurationMin, engagementScore, options);
      console.log('[DEBUG markTaskCompleted] assignment fallback result:', fallback);
      success = fallback.success;
      failureReason = fallback.error;
    }

    if (!success) return { success: false, error: failureReason || 'Could not save task completion' };

    void supabase.rpc('refresh_behavioral_profile', { p_user_id: userId });

    // Award XP based on task type
    const xpMap: Record<string, number> = {
      prescription: XP_REWARDS.prescription_task_complete,
      sprint: XP_REWARDS.sprint_task_complete,
      assignment: XP_REWARDS.assignment_complete,
      weak_area: 20,
    };
    const baseXp = xpMap[sourceType] || 20;

    // Bonus for high engagement
    const engagementBonus = engagementScore && engagementScore >= 4 ? 10 : 0;
    const totalXp = baseXp + engagementBonus;

    // Update streak + award XP (fire-and-forget, don't block on failure)
    try {
      await updateStreak(userId);
      const { levelUp, newLevel } = await awardXp(
        userId,
        totalXp,
        `Completed ${sourceType} task`,
        sourceType,
        sourceId
      );
      return { success: true, xpEarned: totalXp, levelUp, newLevel };
    } catch (xpErr) {
      // XP failure should not fail the task completion
      return { success: true, xpEarned: totalXp };
    }
  } catch (error: any) {
    console.error('markTaskCompleted crashed:', error);
    return { success: false, error: error?.message || 'Unexpected completion error' };
  }
}

export async function ensureBehavioralProfile(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data } = await supabase
      .from('student_behavioral_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) return { success: true };

    const { error } = await supabase.from('student_behavioral_profiles').insert({
      user_id: userId,
      preferred_time: 'evening',
      typical_session_duration_min: 90,
      weak_subjects: [],
      strong_subjects: [],
      stress_signals: {},
    });

    if (error) {
      console.error('ensureBehavioralProfile insert failed:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    const msg = e?.message || 'Unknown error ensuring profile';
    console.error('ensureBehavioralProfile crashed:', msg);
    return { success: false, error: msg };
  }
}

export async function generateDailyPrescription(userId: string, roadmapId: string): Promise<boolean> {
  try {
    const todayStr = getTodayDateStr();

    // 1) Deterministic planner (backend source of truth)
    const { data, error } = await supabase.functions.invoke('plan-daily-mission', {
      body: { roadmap_id: roadmapId, target_date: todayStr },
    });
    if (error || !data?.success || !data?.plan) return false;

    const plan = data.plan;
    const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
    const totalMinutes = tasks.reduce((sum: number, t: any) => sum + (Number(t?.duration_min) || Number(t?.estimated_minutes) || 0), 0);

    // 2) Persist as today's prescription (used by dashboards + parent/admin reporting)
    const { error: upsertErr } = await supabase
      .from('daily_prescriptions')
      .upsert(
        {
          user_id: userId,
          roadmap_id: roadmapId,
          prescription_date: todayStr,
          tasks,
          total_estimated_minutes: totalMinutes,
          implementation_intentions: plan.implementation_intentions || [],
          context_snapshot: plan.context_snapshot || {},
          status: 'active',
          generated_by: 'deterministic_engine_v1',
          prescription_source: {
            planner: 'plan-daily-mission',
            version: 1,
            generated_at: new Date().toISOString(),
          },
        } as any,
        { onConflict: 'user_id,prescription_date' }
      );

    return !upsertErr;
  } catch {
    return false;
  }
}

export async function uploadTestResult(
  _userId: string,
  roadmapId: string,
  payload: {
    test_name: string;
    base64_image?: string;
    manual_weaknesses?: any[];
    score_obtained?: number;
    score_total?: number;
  }
): Promise<{ testResult?: any; sprint?: any; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('analyse-test-result', {
      body: { roadmap_id: roadmapId, ...payload },
    });
    if (error) return { error: error.message };
    return { testResult: data?.testResult, sprint: data?.sprint };
  } catch (e: any) {
    return { error: e?.message || 'Upload failed' };
  }
}

// Helper: safely query Supabase, return fallback on any error
async function safeQuery<T>(queryPromise: any, fallback: T): Promise<T> {
  try {
    const { data, error } = await queryPromise;
    if (error) {
      if (!error.message?.includes('does not exist') && !error.message?.includes('No rows')) {
        console.warn('Supabase query warning:', error.message);
      }
      return fallback;
    }
    return data ?? fallback;
  } catch (e: any) {
    if (!e?.message?.includes('does not exist')) {
      console.warn('Supabase query error:', e?.message);
    }
    return fallback;
  }
}

export async function fetchDailyBriefing(userId: string): Promise<DailyBriefingData> {
  const todayStr = getTodayDateStr();

  // ------------------------------------------------------------------
  // A. Try roadmap-aware path (new tables)
  // ------------------------------------------------------------------
  let activeRoadmap: any = null;
  let roadmapId: string | null = null;
  let classSessions: any[] = [];
  let prescription: any = null;
  let correctionSprint: any = null;
  let behavioralProfile: any = null;
  let roadmapPathAvailable = false;

  try {
    const roadmapRes = await supabase
      .from('student_roadmaps')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!roadmapRes.error && roadmapRes.data) {
      activeRoadmap = roadmapRes.data;
      roadmapId = activeRoadmap.id;
      roadmapPathAvailable = true;

      // Fetch parallel roadmap data
      const [sessionsRes, prescriptionRes, sprintRes, behaviorRes, upcomingTestRes] = await Promise.all([
        supabase.from('class_sessions').select('*').eq('roadmap_id', roadmapId).eq('session_date', todayStr),
        supabase.from('daily_prescriptions').select('*').eq('user_id', userId).eq('prescription_date', todayStr).limit(1).maybeSingle(),
        supabase.from('correction_sprints').select('*').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('student_behavioral_profiles').select('*').eq('user_id', userId).limit(1).maybeSingle(),
        supabase.from('upcoming_tests').select('test_name, test_date, syllabus').eq('user_id', userId).eq('status', 'upcoming').gte('test_date', todayStr).order('test_date', { ascending: true }).limit(1).maybeSingle(),
      ]);

      classSessions = sessionsRes.data || [];
      prescription = prescriptionRes.data || null;
      correctionSprint = sprintRes.data || null;
      behavioralProfile = behaviorRes.data || null;

      // If a test is close but the existing prescription wasn't generated with test context, adapt it automatically
      const nextTest = upcomingTestRes.data || null;
      if (prescription && nextTest && activeRoadmap) {
        const daysUntil = Math.ceil((new Date(nextTest.test_date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil <= 7 && !prescription.context_snapshot?.next_test) {
          try {
            const adaptedTasks = (prescription.tasks || []).map((t: any, i: number) => {
              const newType = daysUntil <= 3 ? 'timed_set' : (['timed_set', 'retrieval_check', 'guided_examples'][i % 3]);
              return {
                ...t,
                type: newType,
                strategy: daysUntil <= 3
                  ? `Test sprint — ${nextTest.test_name} in ${daysUntil} days. Solve under exam conditions, no notes, then review errors.`
                  : `Revision focus for ${nextTest.test_name} (${daysUntil} days away). ${t.strategy || ''}`,
                details: t.details ? `[${nextTest.test_name} prep] ${t.details}` : `[${nextTest.test_name} prep] ${t.title || ''}`,
              };
            });
            await supabase
              .from('daily_prescriptions')
              .update({
                tasks: adaptedTasks,
                context_snapshot: { ...(prescription.context_snapshot || {}), next_test: { name: nextTest.test_name, date: nextTest.test_date, days_until: daysUntil } },
                generated_by: 'test_adaptation',
              })
              .eq('id', prescription.id)
              .eq('user_id', userId);
            prescription.tasks = adaptedTasks;
          } catch {
            // Best-effort adaptation — continue with original tasks if DB update fails
          }
        }
      }

      // If no prescription for today, generate one locally from the coaching template
      if (!prescription && activeRoadmap.template_id) {
        try {
          // Preferred path: use backend deterministic planner and persist the result.
          const generated = await generateDailyPrescription(userId, roadmapId);
          if (generated) {
            const { data: freshPrescription } = await supabase
              .from('daily_prescriptions')
              .select('*')
              .eq('user_id', userId)
              .eq('prescription_date', todayStr)
              .limit(1)
              .maybeSingle();
            if (freshPrescription) prescription = freshPrescription;
          }

          // Fallback only if planner/persist failed (kept for rollout resilience)
          if (!prescription) {
          // Fetch weak areas and behavioral profile for personalization
          const [{ data: weakAreasFallback }, { data: profileFallback }] = await Promise.all([
            supabase.from('user_subject_mastery')
              .select('domain, subdomain, mastery_score, questions_attempted, questions_correct')
              .eq('user_id', userId)
              .order('mastery_score', { ascending: true })
              .limit(3),
            supabase.from('student_behavioral_profiles')
              .select('preferred_time, typical_session_duration_min, weak_subjects, missed_days_streak')
              .eq('user_id', userId)
              .maybeSingle(),
          ]);

          const weakAreaMap = new Map<string, { mastery: number; accuracy: number }>();
          (weakAreasFallback || []).forEach((w: any) => {
            const key = `${w.domain}${w.subdomain ? ` — ${w.subdomain}` : ''}`;
            const accuracy = w.questions_attempted > 0 ? Math.round((w.questions_correct / w.questions_attempted) * 100) : 0;
            weakAreaMap.set(key, { mastery: Math.round((w.mastery_score || 0) * 100), accuracy });
          });
          const weakestThree = Array.from(weakAreaMap.entries()).slice(0, 3);

          const { data: template } = await supabase
            .from('coaching_templates')
            .select('weekly_schedule')
            .eq('id', activeRoadmap.template_id)
            .maybeSingle();

          if (template?.weekly_schedule) {
            const schedule = template.weekly_schedule;
            let todaySessions: any[] = [];

            // Task type rotation based on day of week for variety
            const dayOfWeek = new Date().getDay();
            const taskTypeRotation = [
              ['review_notes', 'guided_examples', 'retrieval_check'],  // Sun
              ['review_notes', 'timed_set', 'guided_examples'],        // Mon
              ['guided_examples', 'retrieval_check', 'review_notes'],  // Tue
              ['review_notes', 'guided_examples', 'timed_set'],        // Wed
              ['retrieval_check', 'review_notes', 'guided_examples'],  // Thu
              ['timed_set', 'guided_examples', 'retrieval_check'],     // Fri
              ['review_notes', 'retrieval_check', 'timed_set'],        // Sat
            ];
            let todayTypes = taskTypeRotation[dayOfWeek];

            // If an upcoming test is within 7 days, override with exam-focused revision types
            const nextTestFallback = nextTest;
            if (nextTestFallback) {
              const daysUntilFallback = Math.ceil((new Date(nextTestFallback.test_date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
              if (daysUntilFallback <= 3) {
                todayTypes = ['timed_set', 'timed_set', 'timed_set'];
              } else if (daysUntilFallback <= 7) {
                todayTypes = ['timed_set', 'retrieval_check', 'timed_set'];
              }
            }

            // Rich, personalized task type definitions — never generic
            const taskTypeLabels: Record<string, { verb: string; strategy: string; duration: number; checkpoint: string; coachNote: string }> = {
              review_notes: {
                verb: 'Build the foundation',
                strategy: 'Open your notes to the exact chapter. Write down the 3 most important formulas WITHOUT looking first. Then verify. If you miss even one, re-read the derivation before moving on.',
                duration: 30,
                checkpoint: 'Can you write the key formula from memory and explain what each symbol means?',
                coachNote: 'Slow is smooth, smooth is fast. Don\'t rush the theory — every JEE top-ranker I know spends 40% of their time here.',
              },
              guided_examples: {
                verb: 'Pattern-mastery drill',
                strategy: 'Pick 1 solved example. Cover the solution, attempt it yourself, then reveal and compare your steps. Now do 2 fresh problems using the SAME pattern. Name the pattern out loud before you start each one.',
                duration: 40,
                checkpoint: 'Could you explain the solution to a friend who\'s struggling? If not, redo the solved example first.',
                coachNote: 'You don\'t need more problems — you need to SEE the pattern in the ones you already have.',
              },
              retrieval_check: {
                verb: 'Closed-book pressure test',
                strategy: 'Put ALL notes away. Set a 12-minute timer. Write everything you know about this topic: definitions, formulas, 2 solved examples from memory, and one common mistake. Then grade yourself honestly.',
                duration: 20,
                checkpoint: 'Did you recall at least 80% correctly? If below 60%, this topic needs review_notes tomorrow.',
                coachNote: 'Retrieval is the single most effective learning technique — but only if you\'re honest about what you missed.',
              },
              timed_set: {
                verb: 'Exam simulation',
                strategy: 'Set a stopwatch. 1 minute per easy, 3 per medium, 5 per hard. NO notes, NO phone, NO breaks. After the timer, mark what you got wrong and classify each error: silly mistake, formula forgotten, or concept gap.',
                duration: 25,
                checkpoint: 'How many errors were silly mistakes vs. not knowing the concept? Write the ratio down — I\'ll remember it.',
                coachNote: 'Speed without accuracy is worthless. If you\'re getting 3+ silly mistakes, slow down by 20% tomorrow.',
              },
            };

            if (Array.isArray(schedule)) {
              const weekEntry = schedule.find((w: any) => w.week === activeRoadmap.current_week);
              if (weekEntry) {
                const subjects = ['physics', 'chemistry', 'mathematics'].filter(s => weekEntry[s]);

                todaySessions = subjects.map((subj, i) => {
                  const topicData = weekEntry[subj];
                  const subtopics = topicData.subtopics || [];
                  const taskType = todayTypes[i] || 'review_notes';
                  const meta = taskTypeLabels[taskType];
                  const subjectName = subj.charAt(0).toUpperCase() + subj.slice(1);

                  // Build a personalized, actionable description
                  const subtopicList = subtopics.length > 0
                    ? `\n\nSpecific targets:\n${subtopics.map((st: string, idx: number) => `${idx + 1}. ${st}`).join('\n')}`
                    : '';

                  // Find if this subject/topic matches a known weak area
                  const weakMatch = weakestThree.find(([key]) =>
                    key.toLowerCase().includes(subjectName.toLowerCase()) ||
                    key.toLowerCase().includes(topicData.topic.toLowerCase())
                  );
                  const weakHook = weakMatch
                    ? `🎯 Personal Focus: Your accuracy on ${weakMatch[0]} is ${weakMatch[1].accuracy}%. ${weakMatch[1].mastery < 40 ? 'This is a red flag — we fix it today.' : 'Let\'s push this above 70%.\n\n'}`
                    : '';

                  let description = `${meta.verb} — ${topicData.topic} (${subjectName})\n\n` +
                    `${weakHook}` +
                    `📋 Strategy: ${meta.strategy}${subtopicList}\n\n` +
                    `✅ Before you mark done: ${meta.checkpoint}\n\n` +
                    `📝 Coach's Note: ${meta.coachNote}`;

                  if (nextTestFallback) {
                    const daysUntilFallback = Math.ceil((new Date(nextTestFallback.test_date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
                    if (daysUntilFallback <= 7) {
                      description = `${meta.verb} — ${topicData.topic} (${subjectName})\n\n` +
                        `${weakHook}` +
                        `📋 Strategy: ${meta.strategy}${subtopicList}\n\n` +
                        `🎯 Test Focus: ${nextTestFallback.test_name} is in ${daysUntilFallback} days. This topic maps to ~8-12 marks. Treat every problem like it costs you a rank.\n\n` +
                        `✅ Before you mark done: ${meta.checkpoint}\n\n` +
                        `📝 Coach's Note: ${meta.coachNote}`;
                    }
                  }

                  return {
                    order: i + 1,
                    title: `${subjectName}: ${topicData.topic}`,
                    subject: subjectName,
                    description,
                    type: taskType,
                    estimated_minutes: meta.duration,
                    resources: [`${subjectName} textbook — ${topicData.topic}`, `Class notes (Week ${activeRoadmap.current_week})`],
                  };
                });
              }
            } else {
              // Object format (e.g. RSA timetable): { monday: [{ subject, topic, duration_min }] }
              // These have broad generic topics ("Modern Physics / Optics") — NOT week-appropriate.
              // Cross-reference with the progressive syllabus to get actual week-specific topics.
              const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
              const todayDay = dayNames[dayOfWeek];

              // Fetch the progressive syllabus from the Standard JEE template for week-specific topics
              let progressiveSyllabus: any = null;
              try {
                const { data: progressiveTemplate } = await supabase
                  .from('coaching_templates')
                  .select('weekly_schedule')
                  .neq('id', activeRoadmap.template_id)
                  .eq('program', activeRoadmap.program || 'JEE')
                  .eq('is_active', true)
                  .limit(1)
                  .maybeSingle();
                if (progressiveTemplate?.weekly_schedule && Array.isArray(progressiveTemplate.weekly_schedule)) {
                  const weekEntry = progressiveTemplate.weekly_schedule.find(
                    (w: any) => w.week === activeRoadmap.current_week
                  );
                  if (weekEntry) progressiveSyllabus = weekEntry;
                }
              } catch {
                // No progressive template found — continue with generic topics
              }

              if (schedule[todayDay]) {
                todaySessions = schedule[todayDay].map((s: any, i: number) => {
                  const taskType = todayTypes[i] || 'review_notes';
                  const meta = taskTypeLabels[taskType];
                  const subjectKey = s.subject?.toLowerCase();

                  // Try to get week-specific topic from progressive syllabus
                  let topicTitle = s.topic;
                  let subtopics: string[] = [];

                  if (progressiveSyllabus && subjectKey && progressiveSyllabus[subjectKey]) {
                    const weekTopic = progressiveSyllabus[subjectKey];
                    topicTitle = weekTopic.topic || s.topic;
                    subtopics = weekTopic.subtopics || [];
                  }

                  const subtopicList = subtopics.length > 0
                    ? `\n\nSpecific targets:\n${subtopics.map((st: string, idx: number) => `${idx + 1}. ${st}`).join('\n')}`
                    : '';

                  const weakMatch = weakestThree.find(([key]) =>
                    key.toLowerCase().includes(s.subject?.toLowerCase() || '') ||
                    key.toLowerCase().includes(topicTitle.toLowerCase())
                  );
                  const weakHook = weakMatch
                    ? `🎯 Personal Focus: Your accuracy on ${weakMatch[0]} is ${weakMatch[1].accuracy}%. ${weakMatch[1].mastery < 40 ? 'This is a red flag — we fix it today.' : 'Let\'s push this above 70%.\n\n'}`
                    : '';

                  let description = `${meta.verb} — ${topicTitle} (${s.subject})\n\n` +
                    `${weakHook}` +
                    `📋 Strategy: ${meta.strategy}${subtopicList}\n\n` +
                    `✅ Before you mark done: ${meta.checkpoint}\n\n` +
                    `📝 Coach's Note: ${meta.coachNote}`;

                  if (nextTestFallback) {
                    const daysUntilFallback = Math.ceil((new Date(nextTestFallback.test_date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
                    if (daysUntilFallback <= 7) {
                      description = `${meta.verb} — ${topicTitle} (${s.subject})\n\n` +
                        `${weakHook}` +
                        `📋 Strategy: ${meta.strategy}${subtopicList}\n\n` +
                        `🎯 Test Focus: ${nextTestFallback.test_name} is in ${daysUntilFallback} days. This topic maps to ~8-12 marks. Treat every problem like it costs you a rank.\n\n` +
                        `✅ Before you mark done: ${meta.checkpoint}\n\n` +
                        `📝 Coach's Note: ${meta.coachNote}`;
                    }
                  }

                  return {
                    order: i + 1,
                    title: `${s.subject}: ${topicTitle}`,
                    subject: s.subject,
                    description,
                    type: taskType,
                    estimated_minutes: Math.min(s.duration_min || meta.duration, 45),
                    resources: [`${s.subject} textbook — ${topicTitle}`, `Class notes (Week ${activeRoadmap.current_week})`],
                  };
                });
              }
            }

            if (todaySessions.length > 0) {
              const totalMin = todaySessions.reduce((sum: number, t: any) => sum + (t.estimated_minutes || 30), 0);
              const firstSubject = todaySessions[0]?.subject || 'studying';

              const { data: inserted } = await supabase
                .from('daily_prescriptions')
                .insert({
                  user_id: userId,
                  roadmap_id: roadmapId,
                  prescription_date: todayStr,
                  status: 'active',
                  context_snapshot: { source: 'template_schedule', week: activeRoadmap.current_week },
                  tasks: todaySessions,
                  implementation_intentions: [
                    { trigger: `At ${profileFallback?.preferred_time || '7:00 PM'}`, action: `Phone in another room. Open ${firstSubject} notes to Task 1. Set a 25-minute timer before touching the first problem.`, duration_min: 5 },
                    { trigger: 'If I feel like skipping the self-test or giving up', action: 'Do exactly 2 problems instead of 5, then stop. Consistency beats intensity.', duration_min: 2 },
                    { trigger: 'After completing each task', action: '30-second reflection: what was the one thing that still felt fuzzy? Write it in one sentence.', duration_min: 5 },
                    { trigger: `If I finish all tasks before ${profileFallback?.typical_session_duration_min || 90} minutes`, action: 'Pick the weakest subject from today and do 1 retrieval check. No notes.', duration_min: 10 },
                  ],
                  total_estimated_minutes: totalMin,
                  generated_by: 'template_fallback',
                })
                .select('*')
                .maybeSingle();

              if (inserted) {
                prescription = inserted;
              }
            }
          }
          }
        } catch {
          // Template fetch failed — continue without prescription
        }
      }
    }
  } catch {
    // Roadmap tables don't exist yet — silently fall back
  }

  // Ensure behavioral profile (best effort)
  if (roadmapPathAvailable) {
    await ensureBehavioralProfile(userId);
  }

  // ------------------------------------------------------------------
  // B. Fetch today's completions for fast lookup
  // ------------------------------------------------------------------
  const completionsRes = await safeQuery(
    supabase.from('task_completions_v2').select('*').eq('user_id', userId).eq('scheduled_date', todayStr),
    []
  );
  const todayCompletions = new Set((completionsRes as any[]).map((c: any) => `${c.source_type}:${c.source_id}:${c.task_order}`));

  // ------------------------------------------------------------------
  // B2. Fetch all-time assignment completions so finished teacher
  //     assignments don't reappear tomorrow.
  // ------------------------------------------------------------------
  const assignmentCompletionsRes = await safeQuery(
    supabase.from('task_completions_v2').select('source_id').eq('user_id', userId).eq('source_type', 'assignment'),
    []
  );
  const completedAssignmentIds = new Set((assignmentCompletionsRes as any[]).map((c: any) => c.source_id));
  console.log('[DEBUG dailyBriefing] assignment completions count:', completedAssignmentIds.size);
  console.log('[DEBUG dailyBriefing] completed assignment ids:', Array.from(completedAssignmentIds).slice(0, 10));

  // ------------------------------------------------------------------
  // C. Always fetch generic data (old tables)
  // ------------------------------------------------------------------
  const [
    profileRes,
    gamificationRes,
    classesRes,
    announcementsRes,
    assignmentsRes,
    meetingNotesRes,
    knowledgeRes,
    recentOutputsRes,
  ] = await Promise.all([
    safeQuery(supabase.from('user_profiles').select('full_name').eq('id', userId).maybeSingle(), null),
    safeQuery(supabase.from('user_gamification').select('current_streak').eq('user_id', userId).maybeSingle(), null),
    safeQuery(supabase.from('class_members').select('class_id').eq('user_id', userId), []),
    safeQuery(
      supabase.from('announcements').select('id, content, created_at, class_id, classes(name)').order('created_at', { ascending: false }).limit(10),
      []
    ),
    safeQuery(
      supabase.from('assignments').select('id, title, description, due_date, class_id, classes(name)').order('due_date', { ascending: true }).limit(20),
      []
    ),
    safeQuery(supabase.from('user_subject_mastery').select('*').eq('user_id', userId).order('mastery_score', { ascending: true }).limit(3), []),
    safeQuery(supabase.from('meeting_notes').select('id, notes, saved_at, title').eq('user_id', userId).order('saved_at', { ascending: false }).limit(3), []),
    safeQuery(
      supabase
        .from('user_knowledge')
        .select('id, topic, subject, knowledge_type, source_type, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      []
    ),
    safeQuery(
      supabase
        .from('task_outputs')
        .select('id, output_type, task_order, ai_analysis, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      []
    ),
  ]);

  const userName = (profileRes as any)?.full_name || 'Student';
  const streak = (gamificationRes as any)?.current_streak || 0;

  // Helper: check if completed via DB
  const isCompleted = (type: string, id: string, order: number = 0) =>
    todayCompletions.has(`${type}:${id}:${order}`);

  // --- Build Class Update ---
  const enrolledClassIds = new Set((classesRes as any[]).map((c: any) => c.class_id));
  let classUpdate: ClassUpdate = { type: 'none', title: '', content: '', source: '', timestamp: '' };

  if (classSessions.length > 0) {
    const sessionList = classSessions.map((s: any) => ({
      subject: s.subject,
      topics: s.topics_covered || [],
      homework: s.homework_assigned,
    }));
    classUpdate = {
      type: 'class_session',
      title: "Today's Classes",
      content: classSessions.map((s: any) => `${s.subject}: ${(s.topics_covered || []).join(', ')}`).join('; '),
      source: activeRoadmap?.institute_name || 'Your Batch',
      timestamp: todayStr,
      sessions: sessionList,
    };
  } else {
    const relevantAnnouncements = (announcementsRes as any[]).filter((a: any) => enrolledClassIds.has(a.class_id));
    if (relevantAnnouncements.length > 0) {
      const latest = relevantAnnouncements[0];
      classUpdate = {
        type: 'announcement',
        title: 'Announcement',
        content: latest.content || '',
        source: latest.classes?.class_name || 'Your Class',
        timestamp: latest.created_at,
      };
    } else {
      const relevantAssignments = (assignmentsRes as any[]).filter((a: any) => enrolledClassIds.has(a.class_id));
      const dueSoon = relevantAssignments.find((a: any) => {
        if (!a.due_date) return false;
        const due = new Date(a.due_date);
        const now = new Date();
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 3;
      });
      if (dueSoon) {
        classUpdate = {
          type: 'assignment_due',
          title: dueSoon.title,
          content: dueSoon.description || `Due soon — don't forget to submit!`,
          source: dueSoon.classes?.class_name || 'Your Class',
          timestamp: dueSoon.due_date,
          metadata: { assignmentId: dueSoon.id },
        };
      } else if (meetingNotesRes && (meetingNotesRes as any[]).length > 0) {
        const note = (meetingNotesRes as any[])[0];
        classUpdate = {
          type: 'meeting_note',
          title: note.title || 'Class Notes',
          content: (note.notes || '').slice(0, 200) + ((note.notes || '').length > 200 ? '...' : ''),
          source: 'Your Notes',
          timestamp: note.saved_at,
          metadata: { noteId: note.id },
        };
      }
    }
  }

  // --- Active Correction Sprint ---
  let correctionSprintData: CorrectionSprint | null = null;
  if (correctionSprint) {
    const tasks = correctionSprint.sprint_tasks || [];
    const completed = tasks.filter((t: any) => t.completed).length;
    correctionSprintData = {
      id: correctionSprint.id,
      sprintName: correctionSprint.sprint_name,
      estimatedDays: correctionSprint.estimated_days,
      tasksRemaining: tasks.length - completed,
      status: correctionSprint.status,
    };
  }

  // --- Build ALL tasks for today ---
  let allTasks: TodayTask[] = [];
  let prescriptionIntentions: Array<{ trigger: string; action: string; duration_min: number; completed?: boolean }> = [];
  let activePrescriptionId: string | null = null;

  // Fetch task output statuses
  let taskOutputs: any[] = [];
  if (prescription?.id) {
    try {
      const { data: outputs } = await supabase
        .from('task_outputs')
        .select('task_order')
        .eq('user_id', userId)
        .eq('prescription_id', prescription.id);
      taskOutputs = outputs || [];
    } catch { /* table may not exist yet */ }
  }
  const submittedOrders = new Set(taskOutputs.map((o: any) => o.task_order));

  // 1. Correction sprint tasks
  if (correctionSprint) {
    const sprintTasks = correctionSprint.sprint_tasks || [];
    sprintTasks.forEach((t: any, i: number) => {
      const order = t.order ?? i;
      allTasks.push({
        type: 'correction_sprint',
        id: `sprint_${correctionSprint.id}_${order}`,
        title: t.topic || t.description || 'Correction Sprint Task',
        description: t.description || 'Complete your correction sprint task.',
        strategy: t.strategy || 'Focus on understanding why you got this wrong, then re-attempt similar problems.',
        subject: t.topic,
        durationMin: t.duration_min || 30,
        urgency: 'critical',
        actionRoute: '/atlas',
        actionLabel: 'Start Repair Task',
        completed: t.completed || isCompleted('sprint', correctionSprint.id, order),
        sprintId: correctionSprint.id,
        taskOrder: order,
        taskType: 'correction',
      });
    });
  }

  // 2. All prescription tasks (not just the first pending one)
  if (prescription) {
    activePrescriptionId = prescription.id;
    const tasks = prescription.tasks || [];
    const rawIntentions = prescription.implementation_intentions || [];
    prescriptionIntentions = rawIntentions.map((intent: any) => {
      if (typeof intent === 'string') {
        const parts = intent.split(/→|then/i);
        if (parts.length >= 2) {
          return { trigger: parts[0].replace(/^If\s+/i, '').trim(), action: parts[1].trim(), duration_min: 5 };
        }
        return { trigger: intent, action: '', duration_min: 5 };
      }
      return { trigger: intent.trigger || '', action: intent.action || '', duration_min: intent.duration_min || 5, completed: intent.completed };
    }).filter((i: any) => i.trigger);

    tasks.forEach((t: any, i: number) => {
      const order = t.order ?? i;
      allTasks.push({
        type: 'prescription',
        id: `prescription_${prescription.id}_${order}`,
        title: t.title || t.topic || 'Study Task',
        description: t.description || t.details || `${t.type}: ${t.title || t.topic}`,
        strategy: t.strategy || '',
        resources: t.resources || [],
        subject: t.subject,
        durationMin: t.estimated_minutes || t.duration_min || 30,
        urgency: 'high',
        actionRoute: '/atlas',
        actionLabel: 'Start with Atlas',
        completed: t.completed || submittedOrders.has(order) || isCompleted('prescription', prescription.id, order),
        prescriptionId: prescription.id,
        taskOrder: order,
        taskType: t.type || 'study',
        outputSubmitted: submittedOrders.has(order),
      });
    });
  }

  // 3. Teacher assignments — surface ALL pending assignments with tiered urgency
  const allRelevantAssignments = (assignmentsRes as any[]).filter((a: any) => enrolledClassIds.has(a.class_id));
  console.log('[DEBUG dailyBriefing] relevant assignments count:', allRelevantAssignments.length);
  console.log('[DEBUG dailyBriefing] relevant assignment ids:', allRelevantAssignments.map((a: any) => a.id).slice(0, 10));
  allRelevantAssignments.forEach((a: any) => {
    const checkId = `assignment_${a.id}`;
    const isDone = completedAssignmentIds.has(checkId);
    console.log('[DEBUG dailyBriefing] checking assignment', a.id, '->', checkId, 'done?', isDone);
    if (isDone) return;
    let urgency: TodayTask['urgency'] = 'normal';
    let dueLabel = '';
    if (a.due_date) {
      const due = new Date(a.due_date);
      const now = new Date();
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) { urgency = 'critical'; dueLabel = 'Overdue'; }
      else if (diffDays <= 1) { urgency = 'high'; dueLabel = 'Due soon'; }
      else if (diffDays <= 3) { urgency = 'normal'; dueLabel = `Due in ${diffDays} days`; }
      else { urgency = 'low'; dueLabel = `Due in ${diffDays} days`; }
    }
    allTasks.push({
      type: 'assignment',
      id: `assignment_${a.id}`,
      title: a.title,
      description: (a.description || 'Complete and submit this assignment.') + (dueLabel ? ` (${dueLabel})` : ''),
      urgency,
      actionRoute: `/class/${a.class_id}`,
      actionLabel: 'Go to Assignment',
      completed: false,
      taskType: 'assignment',
    });
  });

  // Sort: critical assignments first, then high, then other tasks by urgency
  const urgencyOrder = { critical: 0, high: 1, normal: 2, low: 3 };
  allTasks.sort((a, b) => {
    if (a.type === 'assignment' && b.type !== 'assignment') return -1;
    if (b.type === 'assignment' && a.type !== 'assignment') return 1;
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  // Build legacy single todayTask (first pending for backward compat)
  const firstPendingTask = allTasks.find(t => !t.completed) || allTasks[0];
  let todayTask: TodayTask = firstPendingTask || (roadmapPathAvailable
    ? {
        type: 'none' as TaskType,
        id: 'none',
        title: 'All caught up for today!',
        description: 'No pending tasks right now. Your daily prescription will be generated soon — check back later or explore Atlas.',
        urgency: 'low' as const,
        actionRoute: '/atlas',
        actionLabel: 'Explore Atlas',
        completed: false,
      }
    : {
        type: 'none' as TaskType,
        id: 'none',
        title: 'Choose your roadmap',
        description: 'Pick a study roadmap to get daily tasks, revision plans, and personalized guidance.',
        urgency: 'normal' as const,
        actionRoute: '/',
        actionLabel: 'Choose Roadmap',
        completed: false,
      });

  if (firstPendingTask && prescriptionIntentions.length > 0) {
    todayTask = { ...todayTask, implementationIntentions: prescriptionIntentions };
  }

  const completedCount = allTasks.filter(t => t.completed).length;
  const totalCount = allTasks.length;
  const allDone = totalCount > 0 && completedCount === totalCount;
  const totalMinutes = allTasks.reduce((sum, t) => sum + (t.durationMin || 0), 0);

  const behavior = behavioralProfile;
  const studentState: StudentState = {
    preferredTime: behavior?.preferred_time || 'evening',
    typicalSessionDuration: behavior?.typical_session_duration_min || 90,
    weakSubjects: behavior?.weak_subjects || [],
    backlogCount: behavior?.backlog_count || 0,
    missedDaysStreak: behavior?.missed_days_streak || 0,
  };

  const recentKnowledge: DailyBriefingMemory[] = (knowledgeRes as any[]).map((entry: any) => ({
    id: entry.id,
    topic: entry.topic,
    subject: entry.subject,
    knowledgeType: entry.knowledge_type || entry.source_type,
    content: entry.content,
    createdAt: entry.created_at,
  }));

  const recentSubmissions: DailyBriefingSubmission[] = (recentOutputsRes as any[]).map((entry: any) => ({
    id: entry.id,
    outputType: entry.output_type,
    taskOrder: entry.task_order,
    createdAt: entry.created_at,
    analysis: entry.ai_analysis,
  }));

  return {
    greeting: getGreeting(),
    userName,
    streak,
    classUpdate,
    todayTask,
    todayTasks: allTasks,
    isTaskCompleted: todayTask.completed,
    allTasksCompleted: allDone,
    completedCount,
    totalCount,
    hasPlan: !!activeRoadmap,
    hasClasses: enrolledClassIds.size > 0,
    activeRoadmap: !!activeRoadmap,
    roadmapId,
    prescriptionId: activePrescriptionId,
    correctionSprint: correctionSprintData,
    studentState,
    totalEstimatedMinutes: totalMinutes,
    implementationIntentions: prescriptionIntentions,
    recentKnowledge,
    recentSubmissions,
  };
}
