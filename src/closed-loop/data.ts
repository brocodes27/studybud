/* Supabase rows and JSONB payloads are runtime-shaped until generated DB types are available. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "../lib/supabase";
import {
  gapAssigneesFromKnowledge as gapAssigneesFromKnowledgeRows,
  sanitizeDraftQuestions,
} from "./metrics";
import {
  normalizeVideoRecommendations,
  type VideoRecommendation,
} from "../lib/videoRecommendations";

export { gapAssigneesFromKnowledgeRows as gapAssigneesFromKnowledge };

export type QueueItemKind = "homework" | "repair" | "stretch";

export interface QueueItem {
  id: string;
  kind: QueueItemKind;
  title: string;
  description: string;
  subject: string;
  dueAt?: string | null;
  minutes: number;
  completed: boolean;
  classId?: string;
  sourceId: string;
  taskIndex?: number;
  homeworkType?: "guided_practice" | "assessment_practice" | null;
  topic?: string | null;
  draftQuestions?: DraftQuestion[];
}

export interface DraftQuestion {
  id?: string;
  question: string;
  options?: string[] | null;
  difficulty?: string | null;
  topic?: string | null;
}

export type HomeworkType = "guided_practice" | "assessment_practice";
export type AssignAudience = "whole_class" | "gap_group" | "selected";

export interface CurriculumSelection {
  topicId: string;
  subtopicId?: string | null;
  chapter: string;
  topic: string;
  subtopic?: string | null;
}

export interface CurriculumTopicOption {
  topicId: string;
  chapterId: string;
  chapter: string;
  topic: string;
  subtopics: Array<{ id: string; name: string }>;
}

export interface GuidedContext {
  item: QueueItem;
  studentId: string;
}

export interface ChatMessage {
  role: "student" | "coach";
  content: string;
  format?: "text" | "openui";
  fallbackContent?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export async function trackLearningEvent(
  eventName: string,
  userId: string | undefined,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("analytics_events").insert({
    event_name: eventName,
    user_id: userId || null,
    path: window.location.pathname,
    metadata,
  });
}

const videoRecommendationCache = new Map<string, VideoRecommendation[]>();

export async function loadVideoRecommendations(
  query: string,
  componentId: string,
  forceRefresh = false,
): Promise<VideoRecommendation[]> {
  const cacheKey = query.trim().toLowerCase();
  if (!forceRefresh && videoRecommendationCache.has(cacheKey)) {
    return videoRecommendationCache.get(cacheKey) || [];
  }

  const { data, error } = await supabase.functions.invoke("recommend-videos", {
    body: {
      query_text: query,
      component_id: componentId,
      limit: 3,
    },
  });
  if (error) {
    throw new Error(
      error.message || "Video recommendations could not be loaded.",
    );
  }
  const recommendations = normalizeVideoRecommendations(data?.recommendations);
  videoRecommendationCache.set(cacheKey, recommendations);
  return recommendations;
}

export async function loadStudentQueue(userId: string): Promise<QueueItem[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("class_members")
    .select("class_id")
    .or(`user_id.eq.${userId},student_id.eq.${userId}`);
  if (membershipError) throw membershipError;

  const classIds = (memberships || [])
    .map((row: any) => row.class_id)
    .filter(Boolean);
  const [assignmentsResult, submissionsResult, prescriptionResult] =
    await Promise.all([
      classIds.length
        ? supabase
            .from("assignments")
            .select(
              "id, class_id, title, description, due_date, assignee_ids, homework_type, topic, draft_questions, classes(name, subject)",
            )
            .in("class_id", classIds)
            .order("due_date", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("assignment_submissions")
        .select("assignment_id, submitted_at")
        .eq("student_id", userId),
      supabase
        .from("daily_prescriptions")
        .select("id, tasks, total_estimated_minutes")
        .eq("user_id", userId)
        .eq("prescription_date", today())
        .maybeSingle(),
    ]);

  if (assignmentsResult.error) throw assignmentsResult.error;
  if (submissionsResult.error) throw submissionsResult.error;
  if (prescriptionResult.error) throw prescriptionResult.error;

  const submitted = new Set(
    (submissionsResult.data || []).map((row: any) => row.assignment_id),
  );
  const homework: QueueItem[] = (assignmentsResult.data || [])
    .filter(
      (row: any) =>
        !submitted.has(row.id) &&
        (!Array.isArray(row.assignee_ids) ||
          row.assignee_ids.length === 0 ||
          row.assignee_ids.includes(userId)),
    )
    .map((row: any) => {
      const draftQuestions = sanitizeDraftQuestions(
        Array.isArray(row.draft_questions) ? row.draft_questions : [],
        row.topic,
      );
      const numbered =
        draftQuestions.length > 0
          ? draftQuestions
              .map(
                (question: DraftQuestion, index: number) =>
                  `${index + 1}. ${question.question}`,
              )
              .join("\n")
          : "";
      return {
        id: `assignment:${row.id}`,
        kind: "homework" as const,
        title: row.title,
        description:
          numbered ||
          row.description ||
          "Complete the work assigned by your teacher.",
        subject: row.classes?.subject || row.classes?.name || "Classwork",
        dueAt: row.due_date,
        minutes: Math.max(15, draftQuestions.length * 5 || 20),
        completed: false,
        classId: row.class_id,
        sourceId: row.id,
        homeworkType: row.homework_type || null,
        topic: row.topic || null,
        draftQuestions,
      };
    });

  const prescription = prescriptionResult.data as any;
  const tasks = Array.isArray(prescription?.tasks) ? prescription.tasks : [];
  const prescribed: QueueItem[] = tasks.map((task: any, index: number) => ({
    id: `prescription:${prescription.id}:${index}`,
    kind: task.type === "stretch" ? "stretch" : "repair",
    title: task.title || task.topic || "Targeted practice",
    description:
      task.description ||
      task.instructions ||
      "A short repair task selected from your learning signals.",
    subject: task.subject || "Personalised practice",
    minutes: Number(
      task.estimated_minutes ||
        Math.max(
          10,
          Math.round(
            (prescription.total_estimated_minutes || 20) /
              Math.max(tasks.length, 1),
          ),
        ),
    ),
    completed: Boolean(task.completed),
    sourceId: prescription.id,
    taskIndex: index,
  }));

  return [...homework, ...prescribed].sort((a, b) => {
    const priority = { homework: 0, repair: 1, stretch: 2 };
    if (priority[a.kind] !== priority[b.kind])
      return priority[a.kind] - priority[b.kind];
    return (
      new Date(a.dueAt || "2999-01-01").getTime() -
      new Date(b.dueAt || "2999-01-01").getTime()
    );
  });
}

export async function completeQueueItem(
  item: QueueItem,
  userId: string,
  response: string,
  attachmentUrl?: string,
  options: {
    durationSeconds?: number;
    workMode?: "type" | "draw" | "notebook";
  } = {},
) {
  if (item.kind === "homework") {
    const { data: existing, error: existingError } = await supabase
      .from("assignment_submissions")
      .select("graded_at")
      .eq("assignment_id", item.sourceId)
      .eq("student_id", userId)
      .maybeSingle();
    if (existingError) throw existingError;

    // An assessed submission is immutable. Skip the write so a retry can ask
    // the assessor for its already-computed result instead of failing first.
    if (!existing?.graded_at) {
      const { error } = await supabase.from("assignment_submissions").upsert(
        {
          assignment_id: item.sourceId,
          student_id: userId,
          submission_text: response || null,
          attachment_url: attachmentUrl || null,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "assignment_id,student_id" },
      );
      if (error) throw error;
    }
    const { data: assessmentData, error: assessmentError } =
      await supabase.functions.invoke("assess-assignment-submission", {
        body: {
          assignment_id: item.sourceId,
          response_text: response,
          attachment_url: attachmentUrl || null,
          duration_seconds: options.durationSeconds || 1,
          work_mode: options.workMode || "type",
        },
      });
    if (assessmentError) {
      return { assessment: null, assessmentPending: true };
    }
    return {
      assessment: assessmentData?.assessment || null,
      assessmentPending: false,
    };
  }

  const { data, error } = await supabase
    .from("daily_prescriptions")
    .select("tasks")
    .eq("id", item.sourceId)
    .single();
  if (error) throw error;
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
  const sourceKey = `prescription:${item.sourceId}:${item.taskIndex ?? 0}`;
  const outputType = attachmentUrl ? "image" : "text";

  const { data: priorEvidence } = await supabase
    .from("user_knowledge")
    .select("confidence")
    .eq("user_id", userId)
    .eq("subject", item.subject)
    .eq("topic", item.title)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const masteryBefore =
    priorEvidence?.confidence == null ? null : Number(priorEvidence.confidence);

  const { data: output, error: outputError } = await supabase
    .from("task_outputs")
    .upsert(
      {
        user_id: userId,
        prescription_id: item.sourceId,
        task_order: item.taskIndex || 0,
        output_type: outputType,
        text_content: response || null,
        file_url: attachmentUrl || null,
        source_key: sourceKey,
      },
      { onConflict: "user_id,source_key" },
    )
    .select("id")
    .single();
  if (outputError) throw outputError;

  const { data: analysisData, error: analysisError } =
    await supabase.functions.invoke("analyse-task-output", {
      body: {
        output_id: output.id,
        task_title: item.title,
        subject: item.subject,
        output_type: outputType,
        text_content: response || null,
      },
    });
  const analysis = analysisData?.analysis;
  const masteryAfter = analysis
    ? Math.max(0, Math.min(1, Number(analysis.accuracy_score || 0) / 10))
    : null;
  const masteryDelta =
    masteryBefore == null || masteryAfter == null
      ? null
      : masteryAfter - masteryBefore;
  const evidenceQuality = attachmentUrl && !response ? 0.65 : 0.8;

  const { error: metricError } = await supabase
    .from("learning_session_metrics")
    .upsert(
      {
        user_id: userId,
        subject: item.subject,
        concept: item.title,
        duration_seconds: Math.max(1, options.durationSeconds || 1),
        mastery_before: masteryBefore,
        mastery_after: masteryAfter,
        mastery_delta: masteryDelta,
        evidence_quality: analysis ? evidenceQuality : 0.2,
        source_key: sourceKey,
        work_mode: options.workMode || "type",
        completed: true,
      },
      { onConflict: "user_id,source_key" },
    );
  if (metricError) throw metricError;

  const updatedTasks = tasks.map((task: any, index: number) =>
    index === item.taskIndex
      ? {
          ...task,
          completed: true,
          completed_at: new Date().toISOString(),
          student_response: response,
          attachment_url: attachmentUrl || null,
          task_output_id: output.id,
        }
      : task,
  );
  const { error: updateError } = await supabase
    .from("daily_prescriptions")
    .update({
      tasks: updatedTasks,
      status: updatedTasks.every((task: any) => task.completed)
        ? "completed"
        : "active",
    })
    .eq("id", item.sourceId);
  if (updateError) throw updateError;
  return {
    assessment: analysis
      ? {
          score: Number(analysis.accuracy_score || 0) / 10,
          feedback: analysis.feedback,
          concept: item.title,
          evidence_quality: evidenceQuality,
          mastery_before: masteryBefore,
          mastery_after: masteryAfter,
          mastery_delta: masteryDelta,
        }
      : null,
    assessmentPending: Boolean(analysisError),
  };
}

export async function uploadStudentWork(
  userId: string,
  itemId: string,
  file: File,
) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${userId}/${itemId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage
    .from("submissions")
    .upload(path, file);
  if (error) throw error;
  return `storage://submissions/${path}`;
}

export async function askSocraticCoach(
  item: QueueItem,
  messages: ChatMessage[],
  studentMessage: string,
  sessionId: string,
) {
  const { data, error } = await supabase.functions.invoke(
    "multi-agent-orchestrator",
    {
      body: {
        message: studentMessage,
        session_id: sessionId,
        conversation_history: messages.map((message) => ({
          role: message.role === "student" ? "user" : "assistant",
          content: message.content,
        })),
        study_context: {
          mode: "assigned_work",
          socratic_contract: true,
          assignment_id: item.kind === "homework" ? item.sourceId : null,
          prescription_id: item.kind === "homework" ? null : item.sourceId,
          prescription_task_index: item.taskIndex ?? null,
          title: item.title,
          subject: item.subject,
          topic: item.topic || null,
          homework_type: item.homeworkType || null,
          instructions: item.description,
          draft_questions: (item.draftQuestions || []).map(
            (question) => question.question,
          ),
        },
        use_full_orchestration: true,
        prefer_openui: true,
      },
    },
  );
  if (error) throw error;
  return {
    role: "coach" as const,
    content: String(
      data?.response || "What is the first fact or rule you can use here?",
    ),
    format:
      data?.response_kind === "openui"
        ? ("openui" as const)
        : ("text" as const),
    fallbackContent:
      typeof data?.fallback_response === "string"
        ? data.fallback_response
        : undefined,
  };
}

export async function createNotebookSession(input: {
  teacherId: string;
  studentId: string;
  classId?: string;
  title: string;
}) {
  const { data, error } = await supabase
    .from("grading_sessions")
    .insert({
      teacher_id: input.teacherId,
      student_user_id: input.studentId,
      class_id: input.classId || null,
      device_id: "student-mobile",
      test_name: input.title,
      question_paper: [],
      status: "capturing",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function loadTeacherClasses(teacherId: string) {
  // Ensure principal-assigned teaching responsibilities appear as classrooms.
  const sync = await supabase.rpc("sync_teacher_classes_from_assignments", {
    p_teacher_id: teacherId,
  });
  if (sync.error && sync.error.code !== "PGRST202") {
    console.warn("sync_teacher_classes_from_assignments:", sync.error.message);
  }

  const { data, error } = await supabase
    .from("classes")
    .select("id, name, subject, class_code, course_id, syllabus_id")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Client-side safety: if any class still lacks a code, ask sync again after migration.
  const missingCodes = (data || []).some((row: any) => !row.class_code);
  if (missingCodes) {
    await supabase.rpc("sync_teacher_classes_from_assignments", {
      p_teacher_id: teacherId,
    });
    const refreshed = await supabase
      .from("classes")
      .select("id, name, subject, class_code, course_id, syllabus_id")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    if (!refreshed.error) return refreshed.data || [];
  }

  return data || [];
}

function classGrade(className: string) {
  const match = className.match(/(?:grade|class)\s*(\d{1,2})/i);
  return match ? `Class ${match[1]}` : "";
}

function canonicalSubject(subject: string) {
  const normalized = subject.trim().toLowerCase();
  if (normalized.includes("math")) return "Mathematics";
  if (normalized === "science" || normalized.includes("general science"))
    return "Science";
  if (
    normalized.includes("social science") ||
    normalized.includes("social studies") ||
    normalized === "sst"
  )
    return "Social Science";
  if (normalized.includes("physics")) return "Physics";
  if (normalized.includes("chemistry")) return "Chemistry";
  if (normalized.includes("biology")) return "Biology";
  if (normalized.includes("english")) return "English";
  if (normalized.includes("hindi") || normalized.includes("हिंदी"))
    return "Hindi";
  if (normalized.includes("sanskrit") || normalized.includes("संस्कृत"))
    return "Sanskrit";
  return subject.trim();
}

export async function loadNcertCurriculum(input: {
  className: string;
  subject: string;
  courseId?: string | null;
  syllabusId?: string | null;
}) {
  let syllabusId = input.syllabusId || "";

  if (!syllabusId) {
    const grade = classGrade(input.className);
    const subject = canonicalSubject(input.subject);
    let courseQuery = supabase
      .from("courses")
      .select("id")
      .is("school_id", null)
      .eq("board", "NCERT")
      .ilike("name", subject);
    if (grade) courseQuery = courseQuery.eq("grade", grade);
    const { data: courses, error: courseError } = await courseQuery.limit(1);
    if (courseError) throw courseError;
    const courseId = input.courseId || courses?.[0]?.id;
    if (!courseId) return [];

    const { data: syllabi, error: syllabusError } = await supabase
      .from("syllabi")
      .select("id")
      .eq("course_id", courseId)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1);
    if (syllabusError) throw syllabusError;
    syllabusId = syllabi?.[0]?.id || "";
  }

  if (!syllabusId) return [];
  const { data: chapters, error: chapterError } = await supabase
    .from("chapters")
    .select("id, name, sequence_order")
    .eq("syllabus_id", syllabusId)
    .order("sequence_order");
  if (chapterError) throw chapterError;
  const chapterIds = (chapters || []).map((chapter: any) => chapter.id);
  if (!chapterIds.length) return [];

  const { data: topics, error: topicError } = await supabase
    .from("topics")
    .select("id, chapter_id, name, sequence_order")
    .in("chapter_id", chapterIds)
    .order("sequence_order");
  if (topicError) throw topicError;
  const topicIds = (topics || []).map((topic: any) => topic.id);
  const { data: subtopics, error: subtopicError } = topicIds.length
    ? await supabase
        .from("subtopics")
        .select("id, topic_id, name, sequence_order")
        .in("topic_id", topicIds)
        .order("sequence_order")
    : { data: [], error: null };
  if (subtopicError) throw subtopicError;

  const chapterMap = new Map(
    (chapters || []).map((chapter: any) => [chapter.id, chapter]),
  );
  return (topics || []).map(
    (topic: any): CurriculumTopicOption => ({
      topicId: topic.id,
      chapterId: topic.chapter_id,
      chapter: chapterMap.get(topic.chapter_id)?.name || "Chapter",
      topic: topic.name,
      subtopics: (subtopics || [])
        .filter((subtopic: any) => subtopic.topic_id === topic.id)
        .map((subtopic: any) => ({ id: subtopic.id, name: subtopic.name })),
    }),
  );
}

export async function loadClassCommandCenter(classId: string) {
  const [membersResult, assignmentsResult, interventionsResult] =
    await Promise.all([
      supabase
        .from("class_members")
        .select("user_id, student_id")
        .eq("class_id", classId),
      supabase
        .from("assignments")
        .select(
          "id, title, description, due_date, created_at, assignee_ids, homework_type, topic, draft_questions",
        )
        .eq("class_id", classId)
        .order("created_at", { ascending: false }),
      supabase
        .from("interventions")
        .select("*")
        .eq("class_id", classId)
        .eq("status", "active")
        .order("intervention_level", { ascending: false }),
    ]);
  if (membersResult.error) throw membersResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;

  const studentIds = (membersResult.data || [])
    .map((row: any) => row.user_id || row.student_id)
    .filter(Boolean);
  const assignmentIds = (assignmentsResult.data || []).map(
    (row: any) => row.id,
  );

  const [
    profilesResult,
    submissionsResult,
    knowledgeResult,
    prescriptionsResult,
  ] = await Promise.all([
    studentIds.length
      ? supabase
          .from("user_profiles")
          .select("id, full_name, email")
          .in("id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    assignmentIds.length
      ? supabase
          .from("assignment_submissions")
          .select("*")
          .in("assignment_id", assignmentIds)
          .order("submitted_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase
          .from("user_knowledge")
          .select("user_id, topic, subject, confidence, content, updated_at")
          .in("user_id", studentIds)
          .order("confidence", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase
          .from("daily_prescriptions")
          .select("user_id, tasks")
          .in("user_id", studentIds)
          .eq("prescription_date", today())
      : Promise.resolve({ data: [], error: null }),
  ]);

  return {
    students: profilesResult.data || [],
    assignments: assignmentsResult.data || [],
    submissions: submissionsResult.data || [],
    knowledge: knowledgeResult.data || [],
    prescriptions: prescriptionsResult.data || [],
    interventions: interventionsResult.data || [],
  };
}

export async function createAssignment(input: {
  classId: string;
  title: string;
  description: string;
  dueDate: string;
  assigneeIds?: string[];
  homeworkType?: HomeworkType | null;
  topic?: string | null;
  draftQuestions?: DraftQuestion[];
  curriculumItems?: CurriculumSelection[];
}) {
  const sanitizedQuestions = sanitizeDraftQuestions(
    (input.draftQuestions || []) as Array<Record<string, unknown>>,
    input.topic,
  );

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      class_id: input.classId,
      title: input.title,
      description: input.description,
      due_date: input.dueDate || null,
      assignee_ids: input.assigneeIds || [],
      homework_type: input.homeworkType || null,
      topic: input.topic || null,
      draft_questions: sanitizedQuestions,
      curriculum_items: input.curriculumItems || [],
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function draftHomeworkQuestions(input: {
  subject: string;
  topic: string;
  topics?: string[];
  count?: number;
  homeworkType?: HomeworkType;
  studentUserId?: string | null;
  className?: string;
}) {
  const count = Math.max(3, Math.min(6, input.count || 4));
  const { data, error } = await supabase.functions.invoke(
    "adaptive-difficulty",
    {
      body: {
        subject: input.subject,
        topic: input.topic,
        topics: input.topics?.length ? input.topics : undefined,
        count,
        source: "teacher_homework_draft",
        student_user_id: input.studentUserId || undefined,
        class_name: input.className || undefined,
        homework_type: input.homeworkType || "guided_practice",
      },
    },
  );
  if (error) throw error;
  const questions = Array.isArray(data?.questions) ? data.questions : [];
  const drafted = sanitizeDraftQuestions(questions, input.topic).map(
    (question) => ({
      ...question,
      difficulty:
        question.difficulty ||
        (input.homeworkType === "assessment_practice" ? "check" : "guided"),
    }),
  );

  if (drafted.length !== count) {
    throw new Error(
      `AI generated ${drafted.length} of ${count} questions. Please try again.`,
    );
  }
  return drafted.slice(0, count);
}

export async function createHomeworkAssignment(input: {
  classId: string;
  title: string;
  description?: string;
  dueDate: string;
  subject: string;
  topic: string;
  topics?: string[];
  homeworkType: HomeworkType;
  draftQuestions: DraftQuestion[];
  assigneeIds?: string[];
  curriculumItems?: CurriculumSelection[];
}) {
  const questions = input.draftQuestions.filter((question) =>
    question.question.trim(),
  );
  const numbered = questions
    .map((question, index) => `${index + 1}. ${question.question.trim()}`)
    .join("\n");
  const typeLabel =
    input.homeworkType === "assessment_practice"
      ? "Assessment practice"
      : "Guided practice";
  const description =
    input.description?.trim() ||
    `${typeLabel} on ${(input.topics?.length ? input.topics : [input.topic]).join(", ")}.\n\nWork through each question with your reasoning. The coach will guide you — it will not give away the answer.\n\n${numbered}`;

  return createAssignment({
    classId: input.classId,
    title: input.title.trim() || `${typeLabel}: ${input.topic}`,
    description,
    dueDate: input.dueDate,
    assigneeIds: input.assigneeIds || [],
    homeworkType: input.homeworkType,
    topic: input.topic,
    draftQuestions: questions,
    curriculumItems: input.curriculumItems,
  });
}

export async function assignTargetedRepair(input: {
  classId: string;
  studentId: string;
  studentName: string;
  subject: string;
  concept: string;
  interventionId?: string;
}) {
  const { data, error } = await supabase.functions.invoke(
    "adaptive-difficulty",
    {
      body: {
        student_user_id: input.studentId,
        subject: input.subject,
        topic: input.concept,
        count: 3,
        source: "teacher_intervention",
      },
    },
  );
  if (error) throw error;
  const questions = Array.isArray(data?.questions)
    ? data.questions.slice(0, 3)
    : [];
  const draftQuestions: DraftQuestion[] = questions.length
    ? questions.map((question: any, index: number) => ({
        id: String(question.id || `repair-${index + 1}`),
        question: String(
          question.question_text ||
            question.question ||
            question.prompt ||
            "Targeted practice question",
        ),
        options: Array.isArray(question.options) ? question.options : null,
        difficulty:
          typeof question.difficulty === "string" ? question.difficulty : null,
        topic: input.concept,
      }))
    : [
        {
          id: "repair-1",
          question: `Explain ${input.concept} in your own words, then solve one example and identify where an error is most likely.`,
          topic: input.concept,
        },
      ];

  const assignment = await createAssignment({
    classId: input.classId,
    title: `Targeted repair: ${input.concept}`,
    description: `${input.studentName}, this short repair is selected from your latest evidence. Work through each question with your reasoning.`,
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    assigneeIds: [input.studentId],
    homeworkType: "guided_practice",
    topic: input.concept,
    draftQuestions,
  });
  if (input.interventionId) {
    const { error: approvalError } = await supabase.rpc(
      "approve_intervention_repair",
      {
        p_intervention_id: input.interventionId,
        p_assignment_id: assignment.id,
      },
    );
    if (approvalError) throw approvalError;
  }
}

export async function resolveIntervention(id: string, outcome: string) {
  const { error } = await supabase
    .from("interventions")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      outcome,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function loadParentDigest(parentId: string) {
  const { data: links, error } = await supabase
    .from("parent_student_links")
    .select("student_user_id")
    .eq("parent_user_id", parentId)
    .eq("status", "active");
  if (error) throw error;
  const ids = (links || [])
    .map((link: any) => link.student_user_id)
    .filter(Boolean);
  if (!ids.length) return [];

  const [profiles, prescriptions, tests, interventions, knowledge] =
    await Promise.all([
      supabase.from("user_profiles").select("id, full_name").in("id", ids),
      supabase
        .from("daily_prescriptions")
        .select("user_id, tasks")
        .in("user_id", ids)
        .eq("prescription_date", today()),
      supabase
        .from("test_results")
        .select("user_id, test_name, score_obtained, score_total, weak_topics")
        .in("user_id", ids)
        .order("created_at", { ascending: false }),
      supabase
        .from("interventions")
        .select("*")
        .in("student_user_id", ids)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("user_knowledge")
        .select("user_id, topic, subject, confidence")
        .in("user_id", ids)
        .order("updated_at", { ascending: false }),
    ]);

  return ids.map((id: string) => {
    const profile = (profiles.data || []).find((row: any) => row.id === id);
    const taskRows =
      (prescriptions.data || []).find((row: any) => row.user_id === id)
        ?.tasks || [];
    const completed = taskRows.filter((task: any) => task.completed);
    const latestTest = (tests.data || []).find(
      (row: any) => row.user_id === id,
    );
    const support = (interventions.data || []).find(
      (row: any) => row.student_user_id === id,
    );
    const recentKnowledge = (knowledge.data || []).filter(
      (row: any) => row.user_id === id,
    );
    const strongest = [...recentKnowledge].sort(
      (a: any, b: any) => Number(b.confidence || 0) - Number(a.confidence || 0),
    )[0];
    const weakest = [...recentKnowledge].sort(
      (a: any, b: any) => Number(a.confidence || 0) - Number(b.confidence || 0),
    )[0];
    return {
      id,
      profile,
      taskRows,
      completed,
      latestTest,
      support,
      strongest,
      weakest,
    };
  });
}

export async function loadPrincipalOutcomes(schoolId: string) {
  const { data: members, error } = await supabase
    .from("memberships")
    .select("user_id, role")
    .eq("school_id", schoolId)
    .eq("status", "active");
  if (error) throw error;
  const membershipStudentIds = (members || [])
    .filter((row: any) => row.role === "student")
    .map((row: any) => row.user_id);
  const membershipTeacherIds = (members || [])
    .filter((row: any) => row.role === "teacher")
    .map((row: any) => row.user_id);
  const sections = await supabase
    .from("grade_sections")
    .select("*")
    .eq("school_id", schoolId);
  if (sections.error) throw sections.error;
  const sectionIds = (sections.data || []).map((row: any) => row.id);
  const assignmentResult = sectionIds.length
    ? await supabase
        .from("teaching_assignments")
        .select("id, teacher_id")
        .in("section_id", sectionIds)
    : { data: [], error: null };
  if (assignmentResult.error) throw assignmentResult.error;
  const campusAssignmentIds = (assignmentResult.data || []).map(
    (row: any) => row.id,
  );
  const teacherIds = Array.from(
    new Set(
      [
        ...membershipTeacherIds,
        ...(assignmentResult.data || []).map((row: any) => row.teacher_id),
      ].filter(Boolean),
    ),
  );
  const classes = campusAssignmentIds.length
    ? await supabase
        .from("classes")
        .select("id, name, subject, teacher_id")
        .in("teaching_assignment_id", campusAssignmentIds)
    : { data: [], error: null };
  if (classes.error) throw classes.error;
  const campusClassIds = (classes.data || []).map((row: any) => row.id);
  const rosterResult = campusClassIds.length
    ? await supabase
        .from("class_members")
        .select("user_id, student_id")
        .in("class_id", campusClassIds)
    : { data: [], error: null };
  if (rosterResult.error) throw rosterResult.error;
  const studentIds = Array.from(
    new Set(
      [
        ...membershipStudentIds,
        ...(rosterResult.data || []).map(
          (row: any) => row.user_id || row.student_id,
        ),
      ].filter(Boolean),
    ),
  );
  const [knowledge, interventions, prescriptions, learningSessions] =
    await Promise.all([
      studentIds.length
        ? supabase
            .from("user_knowledge")
            .select("user_id, subject, topic, confidence")
            .in("user_id", studentIds)
        : Promise.resolve({ data: [] }),
      studentIds.length
        ? supabase
            .from("interventions")
            .select("student_user_id, class_id, severity, status")
            .in("student_user_id", studentIds)
        : Promise.resolve({ data: [] }),
      studentIds.length
        ? supabase
            .from("daily_prescriptions")
            .select("user_id, tasks")
            .in("user_id", studentIds)
            .eq("prescription_date", today())
        : Promise.resolve({ data: [] }),
      studentIds.length
        ? supabase
            .from("learning_session_metrics")
            .select(
              "user_id, class_id, subject, concept, duration_seconds, mastery_before, mastery_after, mastery_delta, evidence_quality, created_at",
            )
            .in("user_id", studentIds)
            .gte(
              "created_at",
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            )
        : Promise.resolve({ data: [] }),
    ]);
  return {
    students: studentIds.length,
    teachers: teacherIds.length,
    sections: sections.data || [],
    classes: classes.data || [],
    knowledge: knowledge.data || [],
    interventions: interventions.data || [],
    prescriptions: prescriptions.data || [],
    learningSessions: learningSessions.data || [],
  };
}

export async function loadSchoolSetup(schoolId: string) {
  const [
    school,
    years,
    sections,
    subjects,
    assignments,
    teacherRoster,
    pendingInvites,
  ] = await Promise.all([
    supabase
      .from("schools")
      .select("id, name, code")
      .eq("id", schoolId)
      .single(),
    supabase
      .from("academic_years")
      .select("*")
      .eq("school_id", schoolId)
      .order("start_date", { ascending: false }),
    supabase
      .from("grade_sections")
      .select("*")
      .eq("school_id", schoolId)
      .order("grade"),
    supabase
      .from("subjects")
      .select("*")
      .eq("school_id", schoolId)
      .order("name"),
    supabase
      .from("teaching_assignments")
      .select(
        "*, grade_sections!inner(grade, section, school_id), subjects(name)",
      )
      .eq("grade_sections.school_id", schoolId),
    supabase.rpc("list_school_teacher_roster", { p_school_id: schoolId }),
    supabase
      .from("school_invitations")
      .select("id, email, role, created_at")
      .eq("school_id", schoolId)
      .eq("role", "teacher")
      .order("created_at", { ascending: false }),
  ]);

  let teachers = (teacherRoster.data || []).map((row: any) => ({
    id: row.user_id,
    full_name: row.full_name,
    email: row.email,
  }));

  // Fallback if RPC not migrated yet
  if (teacherRoster.error) {
    const membershipRes = await supabase
      .from("memberships")
      .select("user_id")
      .eq("school_id", schoolId)
      .eq("role", "teacher")
      .eq("status", "active");
    const teacherIds = (membershipRes.data || []).map(
      (row: any) => row.user_id,
    );
    const { data } = teacherIds.length
      ? await supabase
          .from("user_profiles")
          .select("id, full_name, email")
          .in("id", teacherIds)
      : { data: [] as any[] };
    teachers = data || [];
  }

  return {
    school: school.data,
    years: years.data || [],
    sections: sections.data || [],
    subjects: subjects.data || [],
    teachingAssignments: (assignments.data || []).map((assignment: any) => ({
      ...assignment,
      user_profiles: teachers.find(
        (teacher: any) => teacher.id === assignment.teacher_id,
      ),
    })),
    teachers,
    pendingTeacherInvites: pendingInvites.data || [],
  };
}

export async function linkTeacherToSchool(schoolId: string, email: string) {
  const { data, error } = await supabase.rpc("link_teacher_to_school", {
    p_school_id: schoolId,
    p_email: email,
  });
  if (error) throw error;
  return data as {
    success: boolean;
    status: "linked" | "invited";
    email: string;
  };
}

export async function joinSchoolAsTeacher(schoolCode: string) {
  const { data, error } = await supabase.rpc("join_school_as_teacher", {
    p_code: schoolCode,
  });
  if (error) throw error;
  return data as { success: boolean; school_id: string; school_name: string };
}

export async function lookupSchoolByCode(schoolCode: string) {
  const { data, error } = await supabase.rpc("lookup_school_by_code", {
    p_code: schoolCode,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { id: string; name: string; code?: string } | undefined;
}

export async function importSchoolInvitations(
  schoolId: string,
  csvText: string,
) {
  const rows = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [emailValue, roleValue = "student"] = line
        .split(",")
        .map((value) => value.trim());
      const role =
        roleValue.toLowerCase() === "teacher" ? "teacher" : "student";
      return { school_id: schoolId, email: emailValue.toLowerCase(), role };
    })
    .filter((row) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email));
  if (!rows.length)
    throw new Error("Add at least one valid line in the format email,role.");
  const { error } = await supabase
    .from("school_invitations")
    .upsert(rows, { onConflict: "school_id,email" });
  if (error) throw error;
  return rows.length;
}

export async function createTeachingAssignment(input: {
  teacherId: string;
  sectionId: string;
  subjectId: string;
  academicYearId: string;
}) {
  const { error } = await supabase.from("teaching_assignments").upsert(
    {
      teacher_id: input.teacherId,
      section_id: input.sectionId,
      subject_id: input.subjectId,
      academic_year_id: input.academicYearId,
    },
    { onConflict: "teacher_id,section_id,subject_id,academic_year_id" },
  );
  if (error) throw error;

  const { error: syncError } = await supabase.rpc(
    "sync_teacher_classes_from_assignments",
    {
      p_teacher_id: input.teacherId,
    },
  );
  if (syncError) throw syncError;
}

export async function createAcademicYear(input: {
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}) {
  if (input.isActive) {
    const { error: deactivateError } = await supabase
      .from("academic_years")
      .update({ is_active: false })
      .eq("school_id", input.schoolId)
      .eq("is_active", true);
    if (deactivateError) throw deactivateError;
  }
  const { error } = await supabase.from("academic_years").insert({
    school_id: input.schoolId,
    name: input.name.trim(),
    start_date: input.startDate,
    end_date: input.endDate,
    is_active: Boolean(input.isActive),
  });
  if (error) throw error;
}

export async function createGradeSection(input: {
  schoolId: string;
  grade: string;
  section: string;
}) {
  const { error } = await supabase.from("grade_sections").insert({
    school_id: input.schoolId,
    grade: input.grade.trim(),
    section: input.section.trim().toUpperCase(),
  });
  if (error) throw error;
}

export async function createSubject(input: { schoolId: string; name: string }) {
  const { error } = await supabase.from("subjects").insert({
    school_id: input.schoolId,
    name: input.name.trim(),
  });
  if (error) throw error;
}

export async function loadChainOverview(
  chainIds: string[],
  options?: { allChains?: boolean },
) {
  const loadAll = Boolean(options?.allChains);
  if (!chainIds.length && !loadAll)
    return { chains: [], campuses: [] as any[] };

  const chainsQuery = loadAll
    ? supabase
        .from("school_chains")
        .select("id, name, code, created_at")
        .order("name")
    : supabase
        .from("school_chains")
        .select("id, name, code, created_at")
        .in("id", chainIds)
        .order("name");
  const schoolsQuery = loadAll
    ? supabase
        .from("schools")
        .select("id, name, code, domain, chain_id")
        .not("chain_id", "is", null)
        .order("name")
    : supabase
        .from("schools")
        .select("id, name, code, domain, chain_id")
        .in("chain_id", chainIds)
        .order("name");

  const [
    { data: chains, error: chainError },
    { data: schools, error: schoolError },
  ] = await Promise.all([chainsQuery, schoolsQuery]);
  if (chainError) throw chainError;
  if (schoolError) throw schoolError;

  const campuses = await Promise.all(
    (schools || []).map(async (school) => {
      try {
        const outcomes = await loadPrincipalOutcomes(school.id);
        const { data: entitlement } = await supabase
          .from("school_entitlements")
          .select("plan, seat_count, expires_at")
          .eq("school_id", school.id)
          .maybeSingle();
        return { ...school, outcomes, entitlement };
      } catch {
        return { ...school, outcomes: null, entitlement: null };
      }
    }),
  );

  return { chains: chains || [], campuses };
}

export async function adminCreateSchoolChain(name: string, code: string) {
  const { data, error } = await supabase.rpc("admin_create_school_chain", {
    p_name: name,
    p_code: code,
  });
  if (error) throw error;
  return data;
}

export async function adminCreateSchool(input: {
  name: string;
  code: string;
  domain: string;
  chainId: string | null;
  plan: string;
  seatCount: number;
}) {
  const { data, error } = await supabase.rpc("admin_create_school", {
    p_name: input.name,
    p_code: input.code,
    p_domain: input.domain,
    p_chain_id: input.chainId,
    p_plan: input.plan,
    p_seat_count: input.seatCount,
  });
  if (error) throw error;
  return data;
}

export async function adminInviteChainAdmin(chainId: string, email: string) {
  const { data, error } = await supabase.functions.invoke(
    "provision-school-leader",
    {
      body: {
        role: "chain_head",
        chain_id: chainId,
        email,
      },
    },
  );
  if (error) throw error;
  return data;
}

export async function adminInviteSchoolAdmin(schoolId: string, email: string) {
  const { data, error } = await supabase.functions.invoke(
    "provision-school-leader",
    {
      body: {
        role: "principal",
        school_id: schoolId,
        email,
      },
    },
  );
  if (error) throw error;
  return data;
}

export async function loadPlatformTenancy() {
  const [
    { data: chains, error: chainError },
    { data: schools, error: schoolError },
  ] = await Promise.all([
    supabase
      .from("school_chains")
      .select("id, name, code, created_at")
      .order("name"),
    supabase
      .from("schools")
      .select("id, name, code, domain, chain_id, created_at")
      .order("name"),
  ]);
  if (chainError) throw chainError;
  if (schoolError) throw schoolError;
  const schoolIds = (schools || []).map((row) => row.id);
  const { data: entitlements } = schoolIds.length
    ? await supabase
        .from("school_entitlements")
        .select("school_id, plan, seat_count, expires_at")
        .in("school_id", schoolIds)
    : { data: [] as any[] };
  return {
    chains: chains || [],
    schools: (schools || []).map((school) => ({
      ...school,
      entitlement:
        (entitlements || []).find((row: any) => row.school_id === school.id) ||
        null,
    })),
  };
}
