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

export interface DailyBriefingData {
  greeting: string;
  userName: string;
  streak: number;
  classUpdate: ClassUpdate;
  todayTask: TodayTask;
  isTaskCompleted: boolean;
  hasPlan: boolean;
  hasClasses: boolean;
  activeRoadmap: boolean;
  roadmapId: string | null;
  correctionSprint: CorrectionSprint | null;
  studentState: StudentState;
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
      .maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}

// Mark a task complete via RPC function + award XP
export async function markTaskCompleted(
  userId: string,
  sourceType: 'prescription' | 'sprint' | 'assignment' | 'weak_area',
  sourceId: string,
  taskOrder: number = 0,
  actualDurationMin?: number,
  engagementScore?: number
): Promise<{ success: boolean; xpEarned?: number; levelUp?: boolean; newLevel?: number }> {
  try {
    let success = false;

    if (sourceType === 'prescription') {
      const { error } = await supabase.rpc('mark_prescription_task_complete', {
        p_user_id: userId,
        p_prescription_id: sourceId,
        p_task_order: taskOrder,
        p_actual_duration_min: actualDurationMin ?? null,
        p_engagement_score: engagementScore ?? null,
      });
      success = !error;
    } else if (sourceType === 'sprint') {
      const { error } = await supabase.rpc('mark_sprint_task_complete', {
        p_user_id: userId,
        p_sprint_id: sourceId,
        p_task_order: taskOrder,
        p_actual_duration_min: actualDurationMin ?? null,
      });
      success = !error;
    } else {
      // Fallback: generic insert
      const { error } = await supabase.from('task_completions_v2').insert({
        user_id: userId,
        source_type: sourceType,
        source_id: sourceId,
        task_order: taskOrder,
        scheduled_date: getTodayDateStr(),
        actual_duration_min: actualDurationMin,
        engagement_score: engagementScore,
      });
      success = !error;
    }

    if (!success) return { success: false };

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
      const { newTotal, levelUp, newLevel } = await awardXp(
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
  } catch {
    return { success: false };
  }
}

export async function ensureBehavioralProfile(userId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('student_behavioral_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) {
      await supabase.from('student_behavioral_profiles').insert({
        user_id: userId,
        preferred_time: 'evening',
        typical_session_duration_min: 90,
        weak_subjects: [],
        strong_subjects: [],
        stress_signals: {},
        backlog_count: 0,
        missed_days_streak: 0,
      });
    }
  } catch {
    // Table may not exist yet — ignore
  }
}

export async function generateDailyPrescription(userId: string, roadmapId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-daily-prescription', {
      body: { roadmap_id: roadmapId, target_date: getTodayDateStr() },
    });
    return !error && data?.success;
  } catch {
    return false;
  }
}

export async function uploadTestResult(
  userId: string,
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
async function safeQuery<T>(queryPromise: Promise<{ data: T | null; error: any }>, fallback: T): Promise<T> {
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
      const [sessionsRes, prescriptionRes, sprintRes, behaviorRes] = await Promise.all([
        supabase.from('class_sessions').select('*').eq('roadmap_id', roadmapId).eq('session_date', todayStr),
        supabase.from('daily_prescriptions').select('*').eq('user_id', userId).eq('prescription_date', todayStr).maybeSingle(),
        supabase.from('correction_sprints').select('*').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('student_behavioral_profiles').select('*').eq('user_id', userId).maybeSingle(),
      ]);

      classSessions = sessionsRes.data || [];
      prescription = prescriptionRes.data || null;
      correctionSprint = sprintRes.data || null;
      behavioralProfile = behaviorRes.data || null;

      // If no prescription for today, generate one locally from the coaching template
      if (!prescription && activeRoadmap.template_id) {
        try {
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
            const todayTypes = taskTypeRotation[dayOfWeek];

            const taskTypeLabels: Record<string, { verb: string; strategy: string; duration: number }> = {
              review_notes: { verb: 'Review & understand', strategy: 'Read through the theory, highlight key formulas, and write summary notes in your own words.', duration: 30 },
              guided_examples: { verb: 'Practice with examples', strategy: 'Work through solved examples first, then attempt 5 similar problems on your own. Check solutions only after attempting.', duration: 40 },
              retrieval_check: { verb: 'Self-test', strategy: 'Close your notes. Write down everything you remember about this topic — key concepts, formulas, and steps. Then verify against your notes.', duration: 20 },
              timed_set: { verb: 'Timed problem set', strategy: 'Set a timer and solve problems under exam-like conditions. No peeking at notes. Mark what you got wrong and review those.', duration: 25 },
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

                  // Build a detailed, actionable description
                  const subtopicList = subtopics.length > 0
                    ? `\n\nKey concepts to cover:\n${subtopics.map((st: string, idx: number) => `${idx + 1}. ${st}`).join('\n')}`
                    : '';

                  const description = `${meta.verb} — ${topicData.topic} (${subjectName})\n\n` +
                    `📋 Strategy: ${meta.strategy}${subtopicList}\n\n` +
                    `💡 Tip: Focus on understanding the "why" behind each concept, not just memorizing formulas.`;

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
                    ? `\n\nKey concepts to cover:\n${subtopics.map((st: string, idx: number) => `${idx + 1}. ${st}`).join('\n')}`
                    : '';

                  const description = `${meta.verb} — ${topicTitle} (${s.subject})\n\n` +
                    `📋 Strategy: ${meta.strategy}${subtopicList}\n\n` +
                    `💡 Tip: Focus on understanding the "why" behind each concept, not just memorizing formulas. Keep an error log for problems you get wrong.`;

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
                    { trigger: 'After I finish dinner', action: `Open my ${firstSubject} notes and start Task 1`, duration_min: 5 },
                    { trigger: 'If I feel stuck on a problem for more than 10 minutes', action: 'Mark it with a ❓, skip to the next one, and return later with fresh eyes', duration_min: 2 },
                    { trigger: 'After completing each task', action: 'Take a 5-minute break — stretch, drink water, look away from the screen', duration_min: 5 },
                    { trigger: 'If I finish all tasks early', action: 'Revise the error log from last session or attempt 2 bonus problems', duration_min: 15 },
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
  // C. Always fetch generic data (old tables)
  // ------------------------------------------------------------------
  const [
    profileRes,
    gamificationRes,
    classesRes,
    announcementsRes,
    assignmentsRes,
    masteryRes,
    meetingNotesRes,
  ] = await Promise.all([
    safeQuery(supabase.from('user_profiles').select('full_name').eq('id', userId).maybeSingle(), null),
    safeQuery(supabase.from('user_gamification').select('current_streak').eq('user_id', userId).maybeSingle(), null),
    safeQuery(supabase.from('class_members').select('class_id').eq('user_id', userId), []),
    safeQuery(
      supabase.from('announcements').select('id, content, created_at, class_id, classes:class_id(class_name)').order('created_at', { ascending: false }).limit(10),
      []
    ),
    safeQuery(
      supabase.from('assignments').select('id, title, description, due_date, class_id, classes:class_id(class_name)').order('due_date', { ascending: true }).limit(20),
      []
    ),
    safeQuery(supabase.from('user_subject_mastery').select('*').eq('user_id', userId).order('mastery_score', { ascending: true }).limit(3), []),
    safeQuery(supabase.from('meeting_notes').select('id, notes, saved_at, title').eq('user_id', userId).order('saved_at', { ascending: false }).limit(3), []),
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

  // --- Determine Today's Task (priority order) ---
  let todayTask: TodayTask = roadmapPathAvailable
    ? {
        type: 'none',
        id: 'none',
        title: 'All caught up for today!',
        description: 'No pending tasks right now. Your daily prescription will be generated soon — check back later or explore Atlas.',
        urgency: 'low',
        actionRoute: '/atlas',
        actionLabel: 'Explore Atlas',
        completed: false,
      }
    : {
        type: 'none',
        id: 'none',
        title: 'Choose your roadmap',
        description: 'Pick a study roadmap to get daily tasks, revision plans, and personalized guidance.',
        urgency: 'normal',
        actionRoute: '/',
        actionLabel: 'Choose Roadmap',
        completed: false,
      };

  // 1. Active correction sprint
  if (correctionSprint) {
    const tasks = correctionSprint.sprint_tasks || [];
    const firstPending = tasks.find((t: any) => !t.completed);
    if (firstPending) {
      const order = firstPending.order || 0;
      todayTask = {
        type: 'correction_sprint',
        id: `sprint_${correctionSprint.id}_${order}`,
        title: firstPending.topic || firstPending.description || 'Correction Sprint Task',
        description: firstPending.description || 'Complete your correction sprint task.',
        subject: firstPending.topic,
        durationMin: firstPending.duration_min || 30,
        urgency: 'critical',
        actionRoute: '/atlas',
        actionLabel: 'Start Repair Task',
        completed: isCompleted('sprint', correctionSprint.id, order),
        sprintId: correctionSprint.id,
        taskOrder: order,
      };
    }
  }

  // 2. Today's AI-generated prescription
  if (todayTask.type === 'none' && prescription) {
    const tasks = prescription.tasks || [];
    const rawIntentions = prescription.implementation_intentions || [];
    // Normalize intentions: handle both string[] and object[] formats
    const intentions = rawIntentions.map((intent: any) => {
      if (typeof intent === 'string') {
        const parts = intent.split(/→|then/i);
        if (parts.length >= 2) {
          return { trigger: parts[0].replace(/^If\s+/i, '').trim(), action: parts[1].trim() };
        }
        return { trigger: intent, action: '' };
      }
      return { trigger: intent.trigger || '', action: intent.action || '' };
    }).filter((i: any) => i.trigger);

    const firstPending = tasks.find((t: any) => !t.completed);
    if (firstPending) {
      const order = firstPending.order || 0;
      todayTask = {
        type: 'prescription',
        id: `prescription_${prescription.id}_${order}`,
        title: firstPending.title || firstPending.topic || 'Tonight\'s Study Task',
        description: firstPending.description || firstPending.details || `${firstPending.type}: ${firstPending.title || firstPending.topic}`,
        subject: firstPending.subject,
        durationMin: firstPending.estimated_minutes || firstPending.duration_min || 30,
        urgency: 'high',
        actionRoute: '/atlas',
        actionLabel: 'Start with Atlas',
        completed: isCompleted('prescription', prescription.id, order),
        implementationIntentions: intentions,
        prescriptionId: prescription.id,
        taskOrder: order,
      };
    }
  }

  // 3. Overdue assignment
  if (todayTask.type === 'none') {
    const allRelevantAssignments = (assignmentsRes as any[]).filter((a: any) => enrolledClassIds.has(a.class_id));
    const overdueOrDueToday = allRelevantAssignments.find((a: any) => {
      if (!a.due_date) return false;
      const due = new Date(a.due_date);
      const now = new Date();
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 0;
    });
    if (overdueOrDueToday) {
      todayTask = {
        type: 'assignment',
        id: `assignment_${overdueOrDueToday.id}`,
        title: overdueOrDueToday.title,
        description: overdueOrDueToday.description || 'Complete and submit this assignment.',
        urgency: 'critical',
        actionRoute: `/class/${overdueOrDueToday.class_id}`,
        actionLabel: 'Go to Assignment',
        completed: isCompleted('assignment', overdueOrDueToday.id),
      };
    }
  }

  // 4. Weak area fallback
  if (todayTask.type === 'none' && (masteryRes as any[]).length > 0) {
    const weak = (masteryRes as any[])[0];
    todayTask = {
      type: 'weak_area',
      id: `weak_${weak.domain}`,
      title: `Revise ${weak.domain}`,
      description: `Your mastery in ${weak.domain}${weak.subdomain ? ` (${weak.subdomain})` : ''} is at ${Math.round((weak.mastery_score || 0) * 100)}%. Let's plug this gap.`,
      subject: weak.exam_type,
      durationMin: 30,
      urgency: 'normal',
      actionRoute: '/atlas',
      actionLabel: 'Plug with Atlas',
      completed: isCompleted('weak_area', `weak_${weak.domain}`),
    };
  }

  const behavior = behavioralProfile;
  const studentState: StudentState = {
    preferredTime: behavior?.preferred_time || 'evening',
    typicalSessionDuration: behavior?.typical_session_duration_min || 90,
    weakSubjects: behavior?.weak_subjects || [],
    backlogCount: behavior?.backlog_count || 0,
    missedDaysStreak: behavior?.missed_days_streak || 0,
  };

  return {
    greeting: getGreeting(),
    userName,
    streak,
    classUpdate,
    todayTask,
    isTaskCompleted: todayTask.completed,
    hasPlan: !!activeRoadmap,
    hasClasses: enrolledClassIds.size > 0,
    activeRoadmap: !!activeRoadmap,
    roadmapId,
    correctionSprint: correctionSprintData,
    studentState,
  };
}
