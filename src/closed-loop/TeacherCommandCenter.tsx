/* Supabase class analytics include JSONB evidence with schema-dependent fields. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  FileCheck2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  AssignAudience,
  assignTargetedRepair,
  createHomeworkAssignment,
  CurriculumSelection,
  CurriculumTopicOption,
  DraftQuestion,
  draftHomeworkQuestions,
  gapAssigneesFromKnowledge,
  HomeworkType,
  loadClassCommandCenter,
  loadNcertCurriculum,
  loadTeacherClasses,
  resolveIntervention,
  trackLearningEvent,
} from './data';
import { PageHeader } from './ClosedLoopShell';
import {
  calculateAssignmentProgress,
  calculateExpectedSubmissions,
  submissionNeedsHumanReview,
} from './metrics';

type AssignPrefill = {
  topic?: string;
  audience?: AssignAudience;
  homeworkType?: HomeworkType;
};

interface CommandData {
  students: any[];
  assignments: any[];
  submissions: any[];
  knowledge: any[];
  prescriptions: any[];
  interventions: any[];
}

const emptyData: CommandData = {
  students: [],
  assignments: [],
  submissions: [],
  knowledge: [],
  prescriptions: [],
  interventions: [],
};

export default function TeacherCommandCenter() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [data, setData] = useState<CommandData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [actioning, setActioning] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignTopic, setAssignTopic] = useState('');
  const [conceptSearch, setConceptSearch] = useState('');
  const [curriculumOptions, setCurriculumOptions] = useState<CurriculumTopicOption[]>([]);
  const [selectedCurriculum, setSelectedCurriculum] = useState<CurriculumSelection[]>([]);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [assignType, setAssignType] = useState<HomeworkType>('guided_practice');
  const [questionCount, setQuestionCount] = useState(4);
  const [draftQuestions, setDraftQuestions] = useState<DraftQuestion[]>([]);
  const [audience, setAudience] = useState<AssignAudience>('whole_class');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [manualInstructions, setManualInstructions] = useState('');
  const [draftError, setDraftError] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [submissionAttachmentUrl, setSubmissionAttachmentUrl] = useState('');
  const [loadingAttachment, setLoadingAttachment] = useState(false);
  const [submissionView, setSubmissionView] = useState<'review' | 'recent'>('review');

  const loadClasses = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const nextClasses = await loadTeacherClasses(user.id);
      setClasses(nextClasses);
      setClassId((current) => current || nextClasses[0]?.id || '');
    } catch (nextError: any) {
      setError(nextError?.message || 'Classes could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const loadDashboard = useCallback(
    async (quiet = false) => {
      if (!classId) return;
      if (!quiet) setRefreshing(true);
      setError('');
      try {
        setData(await loadClassCommandCenter(classId));
      } catch (nextError: any) {
        setError(nextError?.message || 'Class signals could not be loaded.');
      } finally {
        setRefreshing(false);
      }
    },
    [classId],
  );

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    setData(emptyData);
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!classId) return;
    const channel = supabaseChannel(classId, () => void loadDashboard(true));
    return () => {
      channel.unsubscribe();
    };
  }, [classId, loadDashboard]);

  const metrics = useMemo(() => {
    const assignmentIds = new Set(data.assignments.map((assignment) => assignment.id));
    const expected = calculateExpectedSubmissions(data.assignments, data.students.length);
    const submitted = data.submissions.filter((submission) => assignmentIds.has(submission.assignment_id)).length;
    const completion = expected ? Math.round((submitted / expected) * 100) : 0;
    const weakSignals = data.knowledge.filter((row) => Number(row.confidence ?? 0.5) < 0.65);
    const reviewExceptions = data.submissions.filter(submissionNeedsHumanReview).length;
    const reviewed = Math.max(0, data.submissions.length - reviewExceptions);
    return {
      completion,
      weakSignals,
      reviewed,
      reviewExceptions,
      minutesSaved: Math.round(reviewed * 4.5),
    };
  }, [data]);

  const studentMap = useMemo(
    () => new Map(data.students.map((student) => [student.id, student])),
    [data.students],
  );

  const assignmentMap = useMemo(
    () => new Map(data.assignments.map((assignment) => [assignment.id, assignment])),
    [data.assignments],
  );

  const uncoveredWeakSignals = useMemo(() => {
    const studentsWithOpenInterventions = new Set(
      data.interventions.map((intervention) => intervention.student_user_id),
    );
    return metrics.weakSignals.filter(
      (signal) => !studentsWithOpenInterventions.has(signal.user_id),
    );
  }, [data.interventions, metrics.weakSignals]);

  const actionCount = data.interventions.length + uncoveredWeakSignals.length;

  const visibleSubmissions = useMemo(() => {
    const reviewQueue = data.submissions.filter(
      submissionNeedsHumanReview,
    );
    return submissionView === 'review' ? reviewQueue : data.submissions.slice(0, 8);
  }, [data.submissions, submissionView]);

  const assignmentProgress = useMemo(
    () => calculateAssignmentProgress(data.assignments, data.submissions, data.students.length),
    [data.assignments, data.students.length, data.submissions],
  );

  const selectedSubmissionAssignment = selectedSubmission
    ? assignmentMap.get(selectedSubmission.assignment_id)
    : null;
  const selectedSubmissionStudent = selectedSubmission
    ? studentMap.get(selectedSubmission.student_id)
    : null;

  const selectedClass = useMemo(
    () => classes.find((row) => row.id === classId) || null,
    [classes, classId],
  );

  const selectedTopicNames = useMemo(
    () => Array.from(new Set(selectedCurriculum.map((item) => item.subtopic || item.topic))),
    [selectedCurriculum],
  );

  const assignmentTopics = useMemo(
    () => selectedTopicNames.length ? selectedTopicNames : assignTopic.trim() ? [assignTopic.trim()] : [],
    [assignTopic, selectedTopicNames],
  );

  const gapAssigneeIds = useMemo(
    () => gapAssigneesFromKnowledge(data.knowledge, assignmentTopics),
    [assignmentTopics, data.knowledge],
  );

  const curriculumChoices = useMemo(() => {
    const query = conceptSearch.trim().toLowerCase();
    return curriculumOptions
      .flatMap((option) => [
        {
          key: option.topicId,
          item: {
            topicId: option.topicId,
            chapter: option.chapter,
            topic: option.topic,
            subtopic: null,
          } satisfies CurriculumSelection,
        },
        ...option.subtopics.map((subtopic) => ({
          key: `${option.topicId}:${subtopic.id}`,
          item: {
            topicId: option.topicId,
            subtopicId: subtopic.id,
            chapter: option.chapter,
            topic: option.topic,
            subtopic: subtopic.name,
          } satisfies CurriculumSelection,
        })),
      ])
      .filter(({ item }) =>
        !query ||
        `${item.chapter} ${item.topic} ${item.subtopic || ''}`.toLowerCase().includes(query),
      )
      .slice(0, 40);
  }, [conceptSearch, curriculumOptions]);

  useEffect(() => {
    if (!showAssign || !selectedClass) return;
    let active = true;
    setCurriculumOptions([]);
    setLoadingCurriculum(true);
    void loadNcertCurriculum({
      className: selectedClass.name || '',
      subject: selectedClass.subject || '',
      courseId: selectedClass.course_id,
      syllabusId: selectedClass.syllabus_id,
    })
      .then((options) => {
        if (active) setCurriculumOptions(options);
      })
      .catch((nextError: any) => {
        if (active) setDraftError(nextError?.message || 'The NCERT concept list could not be loaded.');
      })
      .finally(() => {
        if (active) setLoadingCurriculum(false);
      });
    return () => {
      active = false;
    };
  }, [selectedClass, showAssign]);

  const defaultDueLocal = () => {
    const due = new Date();
    due.setDate(due.getDate() + 1);
    due.setHours(18, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}`;
  };

  const openAssign = (prefill?: AssignPrefill) => {
    setAssignTopic(prefill?.topic || '');
    setConceptSearch(prefill?.topic || '');
    setSelectedCurriculum([]);
    setAssignType(prefill?.homeworkType || 'guided_practice');
    setAudience(prefill?.audience || 'whole_class');
    setQuestionCount(4);
    setDraftQuestions([]);
    setSelectedStudentIds([]);
    setManualInstructions('');
    setDraftError('');
    setDueDate(defaultDueLocal());
    const topic = prefill?.topic || '';
    const typeLabel = (prefill?.homeworkType || 'guided_practice') === 'assessment_practice'
      ? 'Assessment practice'
      : 'Guided practice';
    setAssignTitle(topic ? `${typeLabel}: ${topic}` : '');
    setShowAssign(true);
  };

  const closeAssign = () => {
    setShowAssign(false);
    setDraftError('');
  };

  const generateDraft = async () => {
    if (!assignmentTopics.length) {
      setDraftError('Choose at least one NCERT concept or add a custom concept.');
      return;
    }
    setDrafting(true);
    setDraftError('');
    try {
      const intendedStudents =
        audience === 'gap_group'
          ? gapAssigneeIds
          : audience === 'selected'
            ? selectedStudentIds
            : [];
      const representative = intendedStudents.length === 1 ? intendedStudents[0] : null;
      const questions = await draftHomeworkQuestions({
        subject: selectedClass?.subject || 'General',
        topic: assignmentTopics.join(', '),
        topics: assignmentTopics,
        count: questionCount,
        homeworkType: assignType,
        studentUserId: representative,
        className: selectedClass?.name || '',
      });
      setDraftQuestions(questions);
      if (!assignTitle.trim()) {
        const typeLabel = assignType === 'assessment_practice' ? 'Assessment practice' : 'Guided practice';
        setAssignTitle(`${typeLabel}: ${assignmentTopics.slice(0, 2).join(' + ')}${assignmentTopics.length > 2 ? ` +${assignmentTopics.length - 2}` : ''}`);
      }
    } catch (nextError: any) {
      setDraftError(nextError?.message || 'Could not generate questions. Write instructions manually below.');
    } finally {
      setDrafting(false);
    }
  };

  const regenerateOne = async (index: number) => {
    if (!assignmentTopics.length) return;
    setDrafting(true);
    setDraftError('');
    try {
      const intendedStudents =
        audience === 'gap_group'
          ? gapAssigneeIds
          : audience === 'selected'
            ? selectedStudentIds
            : [];
      const representative = intendedStudents.length === 1 ? intendedStudents[0] : null;
      const [replacement] = await draftHomeworkQuestions({
        subject: selectedClass?.subject || 'General',
        topic: assignmentTopics.join(', '),
        topics: assignmentTopics,
        count: 3,
        homeworkType: assignType,
        studentUserId: representative,
        className: selectedClass?.name || '',
      });
      if (!replacement) return;
      setDraftQuestions((current) => current.map((question, i) => (i === index ? replacement : question)));
    } catch (nextError: any) {
      setDraftError(nextError?.message || 'Could not regenerate that question.');
    } finally {
      setDrafting(false);
    }
  };

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!classId) return;
    if (!dueDate) {
      setDraftError('Choose a due date.');
      return;
    }
    const cleanedQuestions = draftQuestions.filter((question) => question.question.trim());
    if (!cleanedQuestions.length && !manualInstructions.trim()) {
      setDraftError('Generate questions or write student instructions.');
      return;
    }

    let assigneeIds: string[] = [];
    if (audience === 'gap_group') {
      assigneeIds = gapAssigneeIds;
      if (!assigneeIds.length) {
        setDraftError('No students are below 65% confidence on this topic yet. Pick students or assign to the whole class.');
        return;
      }
    } else if (audience === 'selected') {
      assigneeIds = selectedStudentIds;
      if (!assigneeIds.length) {
        setDraftError('Select at least one student.');
        return;
      }
    }

    setSaving(true);
    setError('');
    setDraftError('');
    try {
      await createHomeworkAssignment({
        classId,
        title:
          assignTitle.trim() ||
          `${assignType === 'assessment_practice' ? 'Assessment' : 'Guided'} practice: ${assignmentTopics.slice(0, 2).join(' + ') || 'Classwork'}`,
        description: cleanedQuestions.length ? undefined : manualInstructions.trim(),
        dueDate,
        subject: selectedClass?.subject || 'General',
        topic: assignmentTopics.join(', ') || 'Classwork',
        topics: assignmentTopics,
        homeworkType: assignType,
        draftQuestions: cleanedQuestions,
        assigneeIds,
        curriculumItems: selectedCurriculum,
      });
      await trackLearningEvent('teacher_assignment_created', user?.id, {
        class_id: classId,
        homework_type: assignType,
        audience,
        question_count: cleanedQuestions.length,
        topic_count: assignmentTopics.length,
        assignee_count: assigneeIds.length,
      });
      closeAssign();
      await loadDashboard();
    } catch (nextError: any) {
      setError(nextError?.message || 'The assignment could not be created.');
      setDraftError(nextError?.message || 'The assignment could not be created.');
    } finally {
      setSaving(false);
    }
  };

  const closeIntervention = async (id: string, outcome: string) => {
    setActioning(id);
    try {
      await resolveIntervention(id, outcome);
      await trackLearningEvent('teacher_intervention_resolved', user?.id, {
        class_id: classId,
        intervention_id: id,
        outcome,
      });
      await loadDashboard(true);
    } catch (nextError: any) {
      setError(nextError?.message || 'The action could not be saved.');
    } finally {
      setActioning('');
    }
  };

  const targetIntervention = async (intervention: any) => {
    const student = studentMap.get(intervention.student_user_id);
    const classroom = classes.find((row) => row.id === classId);
    const concept =
      intervention.action_payload?.concept ||
      String(intervention.trigger_type || 'core concept').replaceAll('_', ' ');
    setActioning(intervention.id);
    setError('');
    try {
      await assignTargetedRepair({
        classId,
        studentId: intervention.student_user_id,
        studentName: student?.full_name || 'Student',
        subject: classroom?.subject || 'General',
        concept,
        interventionId: intervention.id,
      });
      await trackLearningEvent('teacher_targeted_repair_assigned', user?.id, {
        class_id: classId,
        intervention_id: intervention.id,
        student_id: intervention.student_user_id,
        concept,
      });
      await loadDashboard(true);
    } catch (nextError: any) {
      setError(nextError?.message || 'Targeted repair could not be assigned.');
    } finally {
      setActioning('');
    }
  };

  const copyClassCode = async () => {
    const code = selectedClass?.class_code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1600);
    } catch {
      setError('Could not copy class code.');
    }
  };

  const openSubmission = async (submission: any) => {
    setSelectedSubmission(submission);
    setSubmissionAttachmentUrl('');
    const attachment = String(submission.attachment_url || '');
    if (!attachment) return;
    if (!attachment.startsWith('storage://submissions/')) {
      setSubmissionAttachmentUrl(attachment);
      return;
    }
    setLoadingAttachment(true);
    try {
      const path = attachment.replace('storage://submissions/', '');
      const { data: signed, error: signedError } = await supabase.storage
        .from('submissions')
        .createSignedUrl(path, 60 * 60);
      if (signedError) throw signedError;
      setSubmissionAttachmentUrl(signed.signedUrl);
    } catch (nextError: any) {
      setError(nextError?.message || 'The submitted image could not be opened.');
    } finally {
      setLoadingAttachment(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--neo-accent)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        eyebrow="Teacher command center"
        title="See the class. Choose the next action."
        description="Assignments, live completion, knowledge gaps, and targeted interventions in one operating view."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadDashboard()}
              className="rounded-xl border border-stone-200 bg-white p-3"
              aria-label="Refresh class"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              disabled={!classId}
              onClick={() => openAssign()}
              className="flex items-center gap-2 rounded-xl bg-[var(--neo-ink)] px-4 py-3 text-xs font-black text-white disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Assign work
            </button>
          </div>
        }
      />

      <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-2">
        {classes.map((classroom) => (
          <button
            key={classroom.id}
            type="button"
            onClick={() => setClassId(classroom.id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black ${
              classId === classroom.id
                ? 'bg-[var(--neo-ink)] text-white'
                : 'border border-stone-200 bg-white text-stone-500'
            }`}
          >
            {classroom.name} · {classroom.subject || 'General'}
          </button>
        ))}
      </div>

      {selectedClass && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--neo-muted)]">Class code</p>
            <p className="mt-1 font-mono text-lg font-black tracking-[0.18em] text-[var(--neo-ink)]">
              {selectedClass.class_code || 'Generating…'}
            </p>
          </div>
          <button
            type="button"
            onClick={copyClassCode}
            disabled={!selectedClass.class_code}
            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-black text-stone-600 disabled:opacity-40"
          >
            {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedCode ? 'Copied' : 'Copy for students'}
          </button>
          <p className="w-full text-xs text-[var(--neo-muted)] sm:w-auto">
            Students join with this code at signup / onboarding.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {!classes.length ? (
        <div className="mt-8 rounded-[32px] border-2 border-dashed border-stone-200 bg-white p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-stone-300" />
          <h2 className="mt-4 text-2xl font-semibold">No classes assigned yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--neo-muted)]">
            Ask your school administrator to add a teaching assignment. The command center will populate automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
            <section className="overflow-hidden rounded-[30px] bg-[var(--neo-ink)] p-6 text-white shadow-xl shadow-stone-900/10 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Today’s class brief</p>
                  <h2 className="mt-2 max-w-2xl text-2xl font-semibold leading-tight text-white sm:text-3xl">
                    {actionCount || metrics.reviewExceptions
                      ? `${actionCount} learning action${actionCount === 1 ? '' : 's'} and ${metrics.reviewExceptions} review${metrics.reviewExceptions === 1 ? '' : 's'} need you.`
                      : 'Nothing urgent is waiting. Keep the class moving.'}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
                    Start with unresolved support, review only uncertain work, then monitor the rest without opening every submission.
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/70">
                  {data.students.length} students
                </span>
              </div>
              <div className="mt-7 grid gap-2 sm:grid-cols-3">
                <a href="#action-queue" className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:bg-white/10">
                  <Target className="h-4 w-4 text-amber-300" />
                  <p className="mt-3 text-2xl font-semibold text-white">{actionCount}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-white/45">Act now</p>
                </a>
                <a href="#review-queue" className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:bg-white/10">
                  <FileCheck2 className="h-4 w-4 text-violet-300" />
                  <p className="mt-3 text-2xl font-semibold text-white">{metrics.reviewExceptions}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-white/45">Review</p>
                </a>
                <a href="#assignment-monitor" className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition hover:bg-white/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <p className="mt-3 text-2xl font-semibold text-white">{metrics.completion}%</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-white/45">Monitor</p>
                </a>
              </div>
            </section>

            <section className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--neo-accent)]">Teacher-time ROI</p>
              <div className="mt-5 flex items-end gap-2">
                <p className="text-5xl font-semibold tracking-tight">{metrics.minutesSaved}m</p>
                <p className="pb-1 text-xs font-bold text-[var(--neo-muted)]">planning estimate</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-stone-600">
                {metrics.reviewed} submissions already have evidence checks, leaving {metrics.reviewExceptions} for a human look.
              </p>
              <div className="mt-5 rounded-2xl bg-[var(--neo-surface)] p-4 text-xs leading-5 text-[var(--neo-muted)]">
                Estimate uses 4.5 minutes per checked submission. Keep it separate from verified teacher-time studies.
              </div>
            </section>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <section id="action-queue" className="scroll-mt-24 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--neo-accent)]">Act</p>
                  <h2 className="mt-1 text-2xl font-semibold">Ranked support queue</h2>
                </div>
                <Target className="h-6 w-6 text-stone-300" />
              </div>
              <div className="mt-5 space-y-3">
                {actionCount === 0 ? (
                  <div className="rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900">
                    No urgent gap signals. Keep the current learning sequence.
                  </div>
                ) : (
                  <>
                    {data.interventions.map((intervention) => {
                      const student = studentMap.get(intervention.student_user_id);
                      return (
                        <div key={intervention.id} className="rounded-2xl border border-stone-200 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-black">{student?.full_name || student?.email || 'Student'}</p>
                                <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${
                                  ['high', 'critical'].includes(intervention.severity)
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {intervention.severity}
                                </span>
                              </div>
                              <p className="mt-1 text-sm capitalize text-[var(--neo-muted)]">
                                {String(intervention.trigger_type || 'learning gap').replaceAll('_', ' ')}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={actioning === intervention.id}
                                onClick={() => targetIntervention(intervention)}
                                className="flex items-center gap-2 rounded-xl bg-[var(--neo-ink)] px-3 py-2 text-[11px] font-black text-white disabled:opacity-50"
                              >
                                {actioning === intervention.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                Assign repair
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  openAssign({
                                    topic:
                                      intervention.action_payload?.concept ||
                                      String(intervention.trigger_type || '').replaceAll('_', ' ') ||
                                      undefined,
                                    audience: 'gap_group',
                                    homeworkType: 'guided_practice',
                                  })
                                }
                                className="rounded-xl border border-stone-200 px-3 py-2 text-[11px] font-black text-stone-600"
                              >
                                Gap group practice
                              </button>
                              <button
                                type="button"
                                disabled={actioning === intervention.id}
                                onClick={() => closeIntervention(intervention.id, 'Teacher reviewed; no additional assignment needed.')}
                                className="rounded-xl border border-stone-200 px-3 py-2 text-[11px] font-black text-stone-500 disabled:opacity-50"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                          <p className="mt-3 rounded-xl bg-[var(--neo-surface)] p-3 text-xs leading-5 text-stone-600">
                            {intervention.action_payload?.message ||
                              `Recommended: ${String(intervention.action_type || 'teacher review').replaceAll('_', ' ')}.`}
                          </p>
                        </div>
                      );
                    })}
                    {uncoveredWeakSignals.slice(0, 5).map((signal, index) => (
                      <div key={`${signal.user_id}-${signal.topic}-${index}`} className="rounded-2xl border border-stone-200 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-black">{studentMap.get(signal.user_id)?.full_name || 'Student'}</p>
                            <p className="mt-1 text-sm text-[var(--neo-muted)]">
                              {signal.subject || 'Concept'} · {signal.topic || signal.content?.slice(0, 60) || 'Needs review'}
                            </p>
                          </div>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-800">
                            {Math.round(Number(signal.confidence || 0) * 100)}%
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            openAssign({
                              topic: String(signal.topic || '').trim() || undefined,
                              audience: 'gap_group',
                              homeworkType: 'guided_practice',
                            })
                          }
                          className="mt-3 rounded-xl border border-stone-200 px-3 py-2 text-[11px] font-black text-stone-600"
                        >
                          Assign guided practice to gap group
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </section>

            <section id="review-queue" className="scroll-mt-24 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--neo-accent)]">Review</p>
                  <h2 className="mt-1 text-2xl font-semibold">Only the exceptions</h2>
                  <p className="mt-1 text-xs text-[var(--neo-muted)]">
                    {metrics.reviewExceptions} need attention · {metrics.reviewed} already checked
                  </p>
                </div>
                <div className="flex rounded-xl bg-[var(--neo-surface)] p-1">
                  {([
                    ['review', 'Needs review'],
                    ['recent', 'Recent'],
                  ] as const).map(([view, label]) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => setSubmissionView(view)}
                      className={`rounded-lg px-3 py-2 text-[10px] font-black ${
                        submissionView === view ? 'bg-white text-[var(--neo-ink)] shadow-sm' : 'text-stone-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {data.assignments[0] && (
                <div className="mt-4 rounded-2xl border border-dashed border-stone-200 bg-[var(--neo-surface)] p-3 text-xs text-stone-600">
                  <span className="font-black text-[var(--neo-ink)]">Latest assign:</span>{' '}
                  {data.assignments[0].title}
                  {Array.isArray(data.assignments[0].assignee_ids) && data.assignments[0].assignee_ids.length > 0
                    ? ` · ${data.assignments[0].assignee_ids.length} students`
                    : ' · whole class'}
                  {Array.isArray(data.assignments[0].draft_questions) && data.assignments[0].draft_questions.length > 0
                    ? ` · ${data.assignments[0].draft_questions.length} questions`
                    : ''}
                </div>
              )}
              <div className="mt-5 space-y-3">
                {visibleSubmissions.length === 0 ? (
                  <p className="rounded-2xl bg-[var(--neo-surface)] p-5 text-sm text-[var(--neo-muted)]">
                    {submissionView === 'review'
                      ? 'No submissions need a human look right now.'
                      : 'No submissions yet. This stream updates when students hand in work.'}
                  </p>
                ) : (
                  visibleSubmissions.map((submission) => (
                    <div key={submission.id} className="flex items-start gap-3 rounded-2xl border border-stone-100 p-3">
                      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                        submission.graded_at || submission.feedback
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {submission.graded_at || submission.feedback ? <CheckCircle2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">
                              {studentMap.get(submission.student_id)?.full_name || 'Student'}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-[var(--neo-muted)]">
                              {assignmentMap.get(submission.assignment_id)?.title || 'Assignment'}
                            </p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                            submission.grade
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {submission.grade || 'Checking'}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-[10px] text-stone-400">
                            Submitted {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'recently'}
                          </p>
                          <button
                            type="button"
                            onClick={() => void openSubmission(submission)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-black text-[var(--neo-accent)] hover:bg-violet-50"
                          >
                            <Eye className="h-3.5 w-3.5" /> View work
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <section id="assignment-monitor" className="mt-6 scroll-mt-24 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--neo-accent)]">Monitor</p>
                <h2 className="mt-1 text-2xl font-semibold">Assignment movement</h2>
                <p className="mt-1 text-xs text-[var(--neo-muted)]">Progress without opening every student record.</p>
              </div>
              <span className="rounded-full bg-[var(--neo-surface)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-stone-500">
                {data.assignments.length} visible assignments
              </span>
            </div>
            {assignmentProgress.length ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {assignmentProgress.map((assignment) => (
                  <article key={assignment.id} className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{assignment.title}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-stone-400">
                          {assignment.submitted}/{assignment.expected} submitted
                        </p>
                      </div>
                      <span className="rounded-full bg-[var(--neo-surface)] px-2.5 py-1 text-xs font-black">
                        {assignment.percent}%
                      </span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${assignment.percent}%` }}
                      />
                    </div>
                    <p className="mt-3 text-[10px] text-[var(--neo-muted)]">
                      {assignment.due_date
                        ? `Due ${new Date(assignment.due_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
                        : 'No due date set'}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-[var(--neo-surface)] p-5 text-sm text-[var(--neo-muted)]">
                No assignments yet. Create the first focused practice from the action above.
              </p>
            )}
          </section>
        </>
      )}

      {showAssign && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/55 p-3 backdrop-blur-md sm:p-6">
          <form
            onSubmit={create}
            className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-white/50 bg-[#F7F4EE] shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-200 bg-white px-5 py-5 sm:px-8">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.17em] text-[var(--neo-accent)]">
                  <BookOpen className="h-4 w-4" /> New assignment
                </div>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--neo-ink)] sm:text-3xl">
                  Turn today’s lesson into practice
                </h2>
                <p className="mt-1.5 text-sm text-[var(--neo-muted)]">
                  Choose NCERT concepts, review the AI draft, then send it.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAssign}
                className="rounded-full border border-stone-200 bg-white p-2.5 text-stone-500 transition hover:bg-stone-100"
                aria-label="Close assignment"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:p-8">
                <div className="space-y-5">
                  <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--neo-accent)]">
                          1 · What did you teach?
                        </p>
                        <h3 className="mt-1 text-lg font-semibold">Choose one or more concepts</h3>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                        NCERT · {selectedClass?.name?.match(/Grade\s+\d+/i)?.[0] || 'class'}
                      </span>
                    </div>

                    {selectedCurriculum.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedCurriculum.map((item) => {
                          const key = `${item.topicId}:${item.subtopicId || ''}`;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() =>
                                setSelectedCurriculum((current) =>
                                  current.filter(
                                    (selected) =>
                                      `${selected.topicId}:${selected.subtopicId || ''}` !== key,
                                  ),
                                )
                              }
                              className="flex items-center gap-1.5 rounded-full bg-[var(--neo-ink)] px-3 py-1.5 text-[11px] font-bold text-white"
                            >
                              {item.subtopic || item.topic} <X className="h-3 w-3" />
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="relative mt-4">
                      <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-stone-400" />
                      <input
                        value={conceptSearch}
                        onChange={(event) => setConceptSearch(event.target.value)}
                        className="w-full rounded-2xl border border-stone-200 bg-[#FAF9F6] py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[var(--neo-accent)] focus:ring-4 focus:ring-[var(--neo-accent)]/10"
                        placeholder="Search topic or subtopic…"
                      />
                    </div>

                    <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-stone-100 p-1">
                      {loadingCurriculum ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading NCERT syllabus…
                        </div>
                      ) : curriculumChoices.length ? (
                        curriculumChoices.map(({ key, item }) => {
                          const selectedKey = `${item.topicId}:${item.subtopicId || ''}`;
                          const selected = selectedCurriculum.some(
                            (value) => `${value.topicId}:${value.subtopicId || ''}` === selectedKey,
                          );
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() =>
                                setSelectedCurriculum((current) =>
                                  selected
                                    ? current.filter(
                                        (value) =>
                                          `${value.topicId}:${value.subtopicId || ''}` !== selectedKey,
                                      )
                                    : [...current, item],
                                )
                              }
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                                selected ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-stone-50'
                              }`}
                            >
                              <span
                                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                                  selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300'
                                }`}
                              >
                                {selected && <Check className="h-3 w-3" />}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-bold">{item.subtopic || item.topic}</span>
                                <span className="block truncate text-[10px] text-stone-400">
                                  {item.chapter}{item.subtopic ? ` · ${item.topic}` : ' · Topic'}
                                </span>
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-4 py-8 text-center text-sm text-stone-500">
                          No matching NCERT concept. Use a custom concept below.
                        </div>
                      )}
                    </div>

                    <label className="mt-4 block">
                      <span className="text-[11px] font-black text-stone-500">Custom concept (optional)</span>
                      <input
                        value={assignTopic}
                        onChange={(event) => setAssignTopic(event.target.value)}
                        className="neo-input mt-1.5 w-full"
                        placeholder="Type a concept not listed above"
                      />
                    </label>
                  </section>

                  <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--neo-accent)]">
                      2 · Shape the practice
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label>
                        <span className="text-[11px] font-black text-stone-500">Practice mode</span>
                        <select
                          value={assignType}
                          onChange={(event) => setAssignType(event.target.value as HomeworkType)}
                          className="neo-input mt-1.5 w-full"
                        >
                          <option value="guided_practice">Guided practice</option>
                          <option value="assessment_practice">Assessment practice</option>
                        </select>
                      </label>
                      <label>
                        <span className="text-[11px] font-black text-stone-500">Length</span>
                        <select
                          value={questionCount}
                          onChange={(event) => setQuestionCount(Number(event.target.value))}
                          className="neo-input mt-1.5 w-full"
                        >
                          {[3, 4, 5, 6].map((count) => (
                            <option key={count} value={count}>{count} questions</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={generateDraft}
                      disabled={drafting || !assignmentTopics.length}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-violet-600/15 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
                    >
                      {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {draftQuestions.length ? 'Generate a fresh draft' : 'Generate questions with AI'}
                    </button>
                  </section>
                </div>

                <div className="space-y-5">
                  <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--neo-accent)]">
                          3 · Review
                        </p>
                        <h3 className="mt-1 text-lg font-semibold">Teacher-approved questions</h3>
                      </div>
                      {draftQuestions.length > 0 && (
                        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700">
                          {draftQuestions.length} questions
                        </span>
                      )}
                    </div>

                    {draftQuestions.length > 0 ? (
                      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
                        {draftQuestions.map((question, index) => (
                          <div key={`${question.id || 'q'}-${index}`} className="rounded-2xl border border-stone-200 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Question {index + 1}</span>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  disabled={drafting}
                                  onClick={() => regenerateOne(index)}
                                  className="rounded-lg px-2 py-1 text-[10px] font-black text-violet-600 hover:bg-violet-50 disabled:opacity-40"
                                >
                                  Redraft
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDraftQuestions((current) => current.filter((_, i) => i !== index))}
                                  className="rounded-lg p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                                  aria-label={`Remove question ${index + 1}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <textarea
                              value={question.question}
                              onChange={(event) =>
                                setDraftQuestions((current) =>
                                  current.map((row, i) => i === index ? { ...row, question: event.target.value } : row),
                                )
                              }
                              className="min-h-20 w-full resize-y bg-transparent text-sm leading-6 outline-none"
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setDraftQuestions((current) => [
                              ...current,
                              { question: '', topic: assignmentTopics[0] || null },
                            ])
                          }
                          className="w-full rounded-xl border border-dashed border-stone-300 py-2.5 text-xs font-black text-stone-500 hover:bg-stone-50"
                        >
                          + Add your own question
                        </button>
                      </div>
                    ) : (
                      <label className="mt-4 block">
                        <textarea
                          value={manualInstructions}
                          onChange={(event) => setManualInstructions(event.target.value)}
                          className="min-h-36 w-full rounded-2xl border border-dashed border-stone-300 bg-[#FAF9F6] p-4 text-sm leading-6 outline-none focus:border-[var(--neo-accent)]"
                          placeholder="Generate an AI draft, or write your own instructions here…"
                        />
                      </label>
                    )}
                  </section>

                  <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--neo-accent)]">
                      4 · Send
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {([
                        { id: 'whole_class' as const, label: 'Whole class', detail: `${data.students.length} students` },
                        { id: 'gap_group' as const, label: 'Gap group', detail: assignmentTopics.length ? `${gapAssigneeIds.length} need practice` : 'Choose concepts' },
                        { id: 'selected' as const, label: 'Choose', detail: `${selectedStudentIds.length} selected` },
                      ] as const).map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setAudience(option.id)}
                          className={`rounded-2xl border p-3 text-left transition ${
                            audience === option.id
                              ? 'border-[var(--neo-ink)] bg-[var(--neo-ink)] text-white shadow-md'
                              : 'border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          <p className="text-xs font-black">{option.label}</p>
                          <p className={`mt-1 text-[10px] ${audience === option.id ? 'text-white/65' : 'text-stone-400'}`}>{option.detail}</p>
                        </button>
                      ))}
                    </div>

                    {audience === 'selected' && (
                      <div className="mt-3 max-h-36 space-y-1 overflow-y-auto rounded-2xl border border-stone-200 p-2">
                        {data.students.map((student) => {
                          const checked = selectedStudentIds.includes(student.id);
                          return (
                            <label key={student.id} className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-stone-50">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setSelectedStudentIds((current) =>
                                    checked ? current.filter((id) => id !== student.id) : [...current, student.id],
                                  )
                                }
                              />
                              {student.full_name || student.email || 'Student'}
                            </label>
                          );
                        })}
                      </div>
                    )}

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label>
                        <span className="text-[11px] font-black text-stone-500">Assignment title</span>
                        <input
                          value={assignTitle}
                          onChange={(event) => setAssignTitle(event.target.value)}
                          className="neo-input mt-1.5 w-full"
                          placeholder="Practice after today’s lesson"
                        />
                      </label>
                      <label>
                        <span className="text-[11px] font-black text-stone-500">Due</span>
                        <input
                          type="datetime-local"
                          value={dueDate}
                          onChange={(event) => setDueDate(event.target.value)}
                          required
                          className="neo-input mt-1.5 w-full"
                        />
                      </label>
                    </div>
                  </section>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-stone-200 bg-white px-5 py-4 sm:px-8">
              {draftError && (
                <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {draftError}
                </div>
              )}
              <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-stone-500">
                  {assignmentTopics.length} concept{assignmentTopics.length === 1 ? '' : 's'} · {draftQuestions.length || 'Manual'} questions ·{' '}
                  {audience === 'whole_class' ? 'Whole class' : audience === 'gap_group' ? `${gapAssigneeIds.length} in gap group` : `${selectedStudentIds.length} selected`}
                </p>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex min-w-48 items-center justify-center gap-2 rounded-2xl bg-[var(--neo-ink)] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-stone-900/15 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Assign now
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {selectedSubmission && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-stone-950/55 p-3 backdrop-blur-md sm:p-6">
          <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-[30px] bg-[#F7F4EE] shadow-2xl">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white px-5 py-5 sm:px-8">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--neo-accent)]">
                  Submitted homework
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {selectedSubmissionStudent?.full_name || selectedSubmissionStudent?.email || 'Student'}
                </h2>
                <p className="mt-1 text-sm text-[var(--neo-muted)]">
                  {selectedSubmissionAssignment?.title || 'Assignment'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1.5 text-xs font-black ${
                  selectedSubmission.grade
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {selectedSubmission.grade || 'AI check pending'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubmission(null);
                    setSubmissionAttachmentUrl('');
                  }}
                  className="rounded-full border border-stone-200 p-2 text-stone-500 hover:bg-stone-100"
                  aria-label="Close submitted homework"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] lg:p-8">
              <div className="space-y-5">
                <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">Student response</h3>
                    <span className="text-[10px] font-bold text-stone-400">
                      {selectedSubmission.submitted_at
                        ? new Date(selectedSubmission.submitted_at).toLocaleString()
                        : 'Submitted'}
                    </span>
                  </div>
                  {selectedSubmission.submission_text ? (
                    <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-[var(--neo-surface)] p-4 text-sm leading-7 text-stone-700">
                      {selectedSubmission.submission_text}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">
                      This submission contains uploaded work.
                    </p>
                  )}
                </section>

                {selectedSubmission.attachment_url && (
                  <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                    <h3 className="font-semibold">Uploaded work</h3>
                    {loadingAttachment ? (
                      <div className="grid min-h-48 place-items-center">
                        <Loader2 className="h-6 w-6 animate-spin text-[var(--neo-accent)]" />
                      </div>
                    ) : submissionAttachmentUrl ? (
                      <a href={submissionAttachmentUrl} target="_blank" rel="noreferrer">
                        <img
                          src={submissionAttachmentUrl}
                          alt="Student submitted work"
                          className="mt-4 max-h-[520px] w-full rounded-2xl border border-stone-200 object-contain"
                        />
                      </a>
                    ) : (
                      <p className="mt-3 text-sm text-stone-500">The attachment could not be loaded.</p>
                    )}
                  </section>
                )}
              </div>

              <div className="space-y-5">
                <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--neo-accent)]">
                    AI result
                  </p>
                  <div className="mt-3 flex items-end gap-2">
                    <p className="text-4xl font-semibold">{selectedSubmission.grade || '—'}</p>
                    <p className="pb-1 text-xs text-stone-400">homework score</p>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-stone-600">
                    {selectedSubmission.assessment_details?.overall_feedback ||
                      selectedSubmission.feedback ||
                      'The automatic check is still pending.'}
                  </p>
                  {selectedSubmission.assessment_details?.misconception && (
                    <div className="mt-4 rounded-2xl bg-amber-50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Misconception</p>
                      <p className="mt-1 text-xs leading-5 text-amber-900">
                        {selectedSubmission.assessment_details.misconception}
                      </p>
                    </div>
                  )}
                </section>

                {Array.isArray(selectedSubmission.assessment_details?.question_results) &&
                  selectedSubmission.assessment_details.question_results.length > 0 && (
                    <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
                      <h3 className="font-semibold">Question-by-question</h3>
                      <div className="mt-4 space-y-2">
                        {selectedSubmission.assessment_details.question_results.map((result: any, index: number) => (
                          <div
                            key={`${result.question_number || index}-${result.status}`}
                            className={`rounded-2xl border p-3 ${
                              result.status === 'correct'
                                ? 'border-emerald-200 bg-emerald-50'
                                : result.status === 'partial'
                                  ? 'border-amber-200 bg-amber-50'
                                  : 'border-red-200 bg-red-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-black">Question {result.question_number || index + 1}</p>
                              <span className="text-[9px] font-black uppercase tracking-wider">{result.status}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-stone-600">{result.feedback}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function supabaseChannel(classId: string, refresh: () => void) {
  return supabase
    .channel(`closed-loop-class-${classId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'assignment_submissions' },
      async (payload: any) => {
        const assignmentId = payload.new?.assignment_id || payload.old?.assignment_id;
        if (!assignmentId) return;
        const { data } = await supabase
          .from('assignments')
          .select('id')
          .eq('id', assignmentId)
          .eq('class_id', classId)
          .maybeSingle();
        if (data) refresh();
      },
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'assignments', filter: `class_id=eq.${classId}` },
      refresh,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'interventions', filter: `class_id=eq.${classId}` },
      refresh,
    )
    .subscribe();
}
