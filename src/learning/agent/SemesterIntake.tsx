import './workspace.css';
import { buildSemesterSchedule, localDate } from './semesterPlanner';
import { getActualAndSuggestedTopics } from './semesterTopics';
import { useEffect, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Coffee,
  FileText,
  Flame,
  GraduationCap,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
  X,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { peekPendingParse } from '../../curve/onboardingHandoff';
import type { ParsedSyllabus } from '../../curve/ai';
import type { Material } from '../model';
import type {
  BreakPreferences,
  EnlistedExam,
  SemesterCourseInfo,
  SemesterPlan,
  StudyPlan,
} from './contracts';

interface SemesterIntakeProps {
  initialCourses?: string[];
  materials?: Material[];
  initialPlan?: SemesterPlan | null;
  onSavePlan: (semesterPlan: SemesterPlan, studyPlan: StudyPlan) => Promise<void> | void;
  onCancel?: () => void;
  onUploadSyllabusClick?: () => void;
  busy?: boolean;
  initialDailyMinutes?: number;
}

const SEMESTER_STAGES: Array<{
  id: 'early' | 'mid' | 'late' | 'finals';
  label: string;
  weeks: string;
  desc: string;
}> = [
  {
    id: 'early',
    label: 'Early Semester',
    weeks: 'Weeks 1–4',
    desc: 'Setting foundations, early lectures, and initial problem sets.',
  },
  {
    id: 'mid',
    label: 'Mid-Semester',
    weeks: 'Weeks 5–8',
    desc: 'Core coursework underway, midterms approaching or happening now.',
  },
  {
    id: 'late',
    label: 'Late Semester',
    weeks: 'Weeks 9–12',
    desc: 'Wrapping up final syllabus modules and starting intensive revisions.',
  },
  {
    id: 'finals',
    label: 'Finals Countdown',
    weeks: 'Weeks 13+',
    desc: 'Syllabus finished. Dedicated exam gap-closing and testing focus.',
  },
];

function addDaysToDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDate(d);
}

export function SemesterIntake({
  initialCourses = [],
  materials = [],
  initialPlan,
  onSavePlan,
  onCancel,
  onUploadSyllabusClick,
  busy = false,
  initialDailyMinutes = 30,
}: SemesterIntakeProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);

  // Read any pending pre-auth syllabus parse
  const [pendingSyllabusCourses] = useState<ParsedSyllabus[]>(() => {
    try {
      const handoff = peekPendingParse();
      return handoff?.courses || [];
    } catch {
      return [];
    }
  });

  // Track enrolled course topics loaded from database
  const [enrolledCourseTopics, setEnrolledCourseTopics] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    supabase
      .from('curve_enrollments')
      .select(`
        id,
        course:curve_courses (
          title, course_code,
          topics:curve_course_topics ( topic )
        )
      `)
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const topicMap: Record<string, string[]> = {};
        for (const item of data as unknown as Array<{ course?: { title?: string; course_code?: string; topics?: Array<{ topic: string }> } }>) {
          const c = item?.course;
          if (!c) continue;
          const tops = (c.topics || []).map((t) => t.topic).filter(Boolean);
          for (const key of [c.title, c.course_code]) {
            if (key && tops.length) topicMap[key] = Array.from(new Set([...(topicMap[key] || []), ...tops]));
          }
        }
        setEnrolledCourseTopics(topicMap);
      }, () => {});

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Stage 1 State: Semester Position & Topics
  const [stage, setStage] = useState<'early' | 'mid' | 'late' | 'finals'>(
    initialPlan?.stage || 'mid'
  );

  const [courses, setCourses] = useState<SemesterCourseInfo[]>(() => {
    if (initialPlan?.courses?.length) return initialPlan.courses;

    // Derived course list
    const candidateCourses: string[] = [];
    if (initialCourses.length) {
      candidateCourses.push(...initialCourses);
    }
    // Also include courses found in materials or pending parse if not present
    for (const m of materials) {
      const c = m.metadata?.course;
      if (c && !candidateCourses.some((x) => x.toLowerCase() === c.toLowerCase())) {
        candidateCourses.push(c);
      }
    }
    for (const p of pendingSyllabusCourses) {
      const c = p.title || p.courseCode;
      if (c && !candidateCourses.some((x) => x.toLowerCase() === c.toLowerCase())) {
        candidateCourses.push(c);
      }
    }

    const baseList = candidateCourses;

    return baseList.map((c) => {
      return {
        course: c,
        // Syllabus coverage is not proof that a topic has been taught.
        taughtTopics: [],
      };
    });
  });

  const [newCourseName, setNewCourseName] = useState('');
  const [activeTopicInput, setActiveTopicInput] = useState<Record<string, string>>({});

  // Stage 2 State: Exam Enlistment & Break Pacing
  const [exams, setExams] = useState<EnlistedExam[]>(initialPlan?.exams || []);

  const [breaks, setBreaks] = useState<BreakPreferences>(() => {
    if (initialPlan?.breaks) return initialPlan.breaks;
    return {
      restDaysPerWeek: 1,
      preExamBufferHours: 48,
      preferredRestDays: ['Sunday'],
    };
  });

  const [dailyMinutes, setDailyMinutes] = useState<number>(initialPlan?.dailyMinutes || initialDailyMinutes);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  function continueToExams() {
    if (!courses.length || courses.some(course => !course.taughtTopics.length)) {
      setError('Add your subjects and at least one taught topic for each. I’ll use those to plan your next steps.');
      return;
    }
    setError('');
    setExams(current => current.map(exam => {
      const taught = courses.find(c => c.course === exam.course)?.taughtTopics || [];
      return { ...exam, topics: exam.topics.length ? exam.topics.filter(topic => taught.includes(topic)) : [...taught] };
    }));
    setStep(2);
  }

  // Uploads enrich quick-add without discarding answers already entered.
  useEffect(() => {
    setCourses(current => {
      const additions = materials.map(m => m.metadata.course || m.title).filter(name => name && !current.some(c => c.course.toLowerCase() === name.toLowerCase()));
      return [...current, ...Array.from(new Set(additions)).map(course => ({ course, taughtTopics: [] }))];
    });
  }, [materials]);

  // Handlers for Course & Topic Management
  const handleAddCourse = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newCourseName.trim();
    if (!trimmed || courses.some((c) => c.course.toLowerCase() === trimmed.toLowerCase())) return;
    if (trimmed.length > 80 || courses.length >= 12) { setError('Add up to 12 subjects, with names up to 80 characters.'); return; }
    setCourses((prev) => [...prev, { course: trimmed, taughtTopics: [] }]);
    setNewCourseName('');
  };

  const handleRemoveCourse = (courseIndex: number) => {
    if (courses.length <= 1) return;
    const removedCourse = courses[courseIndex].course;
    setCourses((prev) => prev.filter((_, i) => i !== courseIndex));
    setExams((prev) => prev.filter((ex) => ex.course !== removedCourse));
  };

  const handleAddTopic = (courseIndex: number, topicToAdd?: string) => {
    const course = courses[courseIndex];
    const raw = topicToAdd ?? activeTopicInput[course.course] ?? '';
    const trimmed = raw.trim();
    if (!trimmed || course.taughtTopics.includes(trimmed)) return;

    setCourses((prev) =>
      prev.map((c, i) =>
        i === courseIndex ? { ...c, taughtTopics: [...c.taughtTopics, trimmed] } : c
      )
    );
    setActiveTopicInput((prev) => ({ ...prev, [course.course]: '' }));
  };

  const handleAddMultipleTopics = (courseIndex: number, topicsToAdd: string[]) => {
    const course = courses[courseIndex];
    const newTopics = topicsToAdd.filter((t) => !course.taughtTopics.includes(t));
    if (!newTopics.length) return;
    setCourses((prev) =>
      prev.map((c, i) =>
        i === courseIndex ? { ...c, taughtTopics: [...c.taughtTopics, ...newTopics] } : c
      )
    );
  };

  const handleRemoveTopic = (courseIndex: number, topicIndex: number) => {
    setCourses((prev) =>
      prev.map((c, i) =>
        i === courseIndex
          ? { ...c, taughtTopics: c.taughtTopics.filter((_, tIdx) => tIdx !== topicIndex) }
          : c
      )
    );
  };

  // Handlers for Exam Enlistment
  const handleAddExam = () => {
    const primaryCourse = courses[0]?.course || 'Course';
    const newExam: EnlistedExam = {
      id: crypto.randomUUID(),
      title: `${primaryCourse} Midterm`,
      course: primaryCourse,
      date: addDaysToDate(10),
      isRecent: false,
      topics: courses[0]?.taughtTopics || [],
    };
    setExams((prev) => [...prev, newExam]);
  };

  const handleUpdateExam = (id: string, updates: Partial<EnlistedExam>) => {
    setExams((prev) =>
      prev.map((ex) => {
        if (ex.id !== id) return ex;
        const updated = { ...ex, ...updates };
        if (updates.course && updates.course !== ex.course) {
          const matching = courses.find((c) => c.course === updates.course);
          updated.topics = matching ? [...matching.taughtTopics] : [];
        }
        return updated;
      })
    );
  };

  const handleRemoveExam = (id: string) => {
    setExams((prev) => prev.filter((ex) => ex.id !== id));
  };

  const handleToggleExamTopic = (examId: string, topic: string) => {
    setExams((prev) =>
      prev.map((ex) => {
        if (ex.id !== examId) return ex;
        const exists = ex.topics.includes(topic);
        return {
          ...ex,
          topics: exists ? ex.topics.filter((t) => t !== topic) : [...ex.topics, topic],
        };
      })
    );
  };

  // Plan Synthesis
  const handleBuildPlan = async () => {
    setSubmitting(true);
    try {
      const stageObj = SEMESTER_STAGES.find((s) => s.id === stage) || SEMESTER_STAGES[1];

      if (!courses.length || courses.some(course => !course.taughtTopics.length)) {
        setError('Add at least one taught topic for each subject.');
        setStep(1);
        return;
      }
      const today = localDate();
      if (exams.some(exam => !exam.topics.length)) { setError('Choose at least one taught topic for each exam, or remove that exam.'); return; }
      if (exams.some(exam => !exam.title.trim() || !exam.date || (exam.isRecent ? exam.date > today : exam.date < today))) {
        setError('Give each exam a title and a valid date. Recent exams belong in the past; upcoming exams start today.');
        return;
      }
      const { semesterPlan, studyPlan } = buildSemesterSchedule({
        stage, stageLabel: stageObj.label, courses, exams, breaks, roadmap: [],
        createdAt: initialPlan?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
      }, dailyMinutes);

      await onSavePlan(semesterPlan, studyPlan);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your plan. Your answers are still here.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="semester-intake-card" role="region" aria-label="Semester and Exam Setup">
      {/* Header Banner */}
      <div className="intake-header">
        <div className="intake-badge">
          <CalendarDays size={18} className="intake-badge-icon" />
          <span>PROACTIVE STUDY SETUP</span>
        </div>
        <h2>Let’s build your study plan together.</h2>
        <p>
          First, tell me where you are in your semester and what has been taught. Next, we’ll add your exams and protect your breaks. I’ll turn your answers into a study plan.
        </p>

        {/* Progress Stepper */}
        <div className="intake-stepper" role="tablist">
          <button
            type="button"
            className={`intake-step-pill ${step === 1 ? 'is-active' : 'is-completed'}`}
            onClick={() => setStep(1)}
          >
            <span className="step-num">{step > 1 ? <Check size={14} /> : '1'}</span>
            <span>Where You Are in Your Semester</span>
          </button>
          <div className="step-divider" />
          <button
            type="button"
            className={`intake-step-pill ${step === 2 ? 'is-active' : ''}`}
            onClick={continueToExams}
          >
            <span className="step-num">2</span>
            <span>Exams & Break-Respectful Pacing</span>
          </button>
        </div>
      </div>

      {error && <p role="alert" className="dash-error">{error}</p>}

      {/* STEP 1: Semester Stage & Topics Taught */}
      {step === 1 && (
        <div className="intake-body step-1">
          <section className="intake-section">
            <div className="section-title-wrap">
              <GraduationCap size={18} className="section-icon" />
              <div>
                <h3>Where are you in your semester?</h3>
                <p>Pick the stage that best matches your current academic calendar.</p>
              </div>
            </div>

            <div className="stage-cards-grid">
              {SEMESTER_STAGES.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`stage-select-card ${stage === s.id ? 'is-selected' : ''}`}
                  onClick={() => setStage(s.id)}
                >
                  <div className="stage-card-top">
                    <span className="stage-weeks">{s.weeks}</span>
                    {stage === s.id && <CheckCircle2 size={16} className="selected-icon" />}
                  </div>
                  <h4>{s.label}</h4>
                  <p>{s.desc}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="intake-section">
            <div className="section-title-wrap">
              <FileText size={18} className="section-icon" />
              <div>
                <h3>What has been taught to you so far?</h3>
                <p>
                  List the core topics or chapters your professors have covered. Use quick-add to instantly import actual parsed topics from your syllabus.
                </p>
              </div>
            </div>

            {/* Courses and Topic Tagging */}
            <div className="courses-list">
              {courses.map((courseItem, cIdx) => {
                // Resolve actual parsed topics from materials, pending parse, and enrolled courses
                const { topics: candidateTopics, isActual } = getActualAndSuggestedTopics(
                  courseItem.course,
                  materials,
                  pendingSyllabusCourses,
                  enrolledCourseTopics
                );

                const unaddedTopics = candidateTopics.filter(
                  (s) => !courseItem.taughtTopics.includes(s)
                );

                return (
                  <div key={courseItem.course} className="course-topics-box">
                    <div className="course-box-header">
                      <div className="course-title-group">
                        <span className="course-tag">{courseItem.course}</span>
                        <span className="topics-count">
                          {courseItem.taughtTopics.length} topic
                          {courseItem.taughtTopics.length === 1 ? '' : 's'} taught
                        </span>
                      </div>
                      {courses.length > 1 && (
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={() => handleRemoveCourse(cIdx)}
                          title="Remove course"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Active Topics Chips */}
                    <div className="topics-chips-cloud">
                      {courseItem.taughtTopics.map((topic, tIdx) => (
                        <span key={tIdx} className="topic-chip">
                          <Tag size={12} />
                          <span>{topic}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTopic(cIdx, tIdx)}
                            aria-label={`Remove topic ${topic}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}

                      {courseItem.taughtTopics.length === 0 && (
                        <p className="no-topics-hint">
                          No topics added yet. Add taught chapters below or click the parsed topics.
                        </p>
                      )}
                    </div>

                    {/* Input to add new topic */}
                    <div className="add-topic-row">
                      <input
                        type="text"
                        className="topic-input"
                        aria-label={`Taught topic for ${courseItem.course}`}
                        placeholder="Add topic or chapter (e.g. Limits, Thermodynamics, Unit 3)..."
                        value={activeTopicInput[courseItem.course] || ''}
                        onChange={(e) =>
                          setActiveTopicInput({
                            ...activeTopicInput,
                            [courseItem.course]: e.target.value,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTopic(cIdx);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="add-topic-btn"
                        onClick={() => handleAddTopic(cIdx)}
                        disabled={!activeTopicInput[courseItem.course]?.trim()}
                      >
                        <Plus size={14} />
                        <span>Add</span>
                      </button>
                    </div>

                    {/* Quick suggestion & parsed topics row */}
                    {unaddedTopics.length > 0 && (
                      <div className="suggestions-row">
                        <span className="suggestions-label">
                          {isActual ? (
                            <span className="actual-parsed-label">
                              <Sparkles size={12} className="text-accent" />
                              <span>Parsed from your syllabus & notes:</span>
                            </span>
                          ) : (
                            'Quick add:'
                          )}
                        </span>

                        {isActual && unaddedTopics.length > 1 && (
                          <button
                            type="button"
                            className="add-all-parsed-btn"
                            onClick={() => handleAddMultipleTopics(cIdx, unaddedTopics)}
                            title="Add all parsed topics to taught topics"
                          >
                            <Check size={12} />
                            <span>Add all parsed ({unaddedTopics.length})</span>
                          </button>
                        )}

                        {unaddedTopics.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            className={`suggestion-chip ${isActual ? 'is-actual-parsed' : ''}`}
                            onClick={() => handleAddTopic(cIdx, sug)}
                            title={`Add "${sug}" to taught topics`}
                          >
                            + {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add another course or upload syllabus */}
            <div className="add-course-bar">
              <form onSubmit={handleAddCourse} className="add-course-form">
                <input
                  type="text"
                  aria-label="Subject name"
                  placeholder="What subject are you studying? e.g. Psychology"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="new-course-input"
                />
                <button type="submit" className="learn-button subtle" disabled={!newCourseName.trim()}>
                  <Plus size={15} /> Add Subject
                </button>
              </form>

              {onUploadSyllabusClick && (
                <button
                  type="button"
                  className="upload-syllabus-shortcut"
                  onClick={onUploadSyllabusClick}
                >
                  <UploadCloud size={15} />
                  <span>Drop syllabus or lecture notes to extract topics</span>
                </button>
              )}
            </div>
          </section>

          {/* Step 1 Actions */}
          <div className="intake-actions-footer">
            {onCancel && (
              <button type="button" className="learn-button subtle" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button
              type="button"
              className="learn-button dark primary-next"
              onClick={continueToExams}
            >
              <span>Next: Enlist Exams & Breaks</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Exam Enlistment & Break-Respectful Pacing */}
      {step === 2 && (
        <div className="intake-body step-2">
          <section className="intake-section">
            <div className="section-title-wrap">
              <Flame size={18} className="section-icon" />
              <div>
                <h3>Do you have an upcoming or recent exam?</h3>
                <p>
                  Had an exam recently, or have one coming up? Add each exam separately, choose its subject and topics, and I’ll plan around it. No exams yet? We’ll build a steady study routine.
                </p>
              </div>
            </div>

            {exams.length === 0 && <p>No exams added yet. You can continue with a study routine and add exams later.</p>}
            {/* Exam Cards */}
            <div className="exams-enlist-grid">
              {exams.map((exam, exIdx) => {
                const courseInfo = courses.find((c) => c.course === exam.course);
                const availableTopics = courseInfo?.taughtTopics || [];

                return (
                  <div key={exam.id} className="exam-card-edit">
                    <div className="exam-card-head">
                      <span className="exam-idx-tag">Exam #{exIdx + 1}</span>
                      {(
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={() => handleRemoveExam(exam.id)}
                          title="Remove exam"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <label className="recent-exam-toggle">
                      <input type="checkbox" checked={!!exam.isRecent} onChange={e => handleUpdateExam(exam.id, { isRecent: e.target.checked, date: addDaysToDate(e.target.checked ? -1 : 7) })} />
                      This exam happened recently
                    </label>
                    <div className="exam-fields-grid">
                      <div className="field-group">
                        <label htmlFor={`exam-title-${exam.id}`}>Exam Title</label>
                        <input
                          type="text"
                          id={`exam-title-${exam.id}`}
                          value={exam.title}
                          onChange={(e) => handleUpdateExam(exam.id, { title: e.target.value })}
                          placeholder="e.g. Midterm 1, Final Exam, Quiz 3"
                        />
                      </div>

                      <div className="field-group">
                        <label htmlFor={`exam-course-${exam.id}`}>Subject</label>
                        <select
                          id={`exam-course-${exam.id}`}
                          value={exam.course}
                          onChange={(e) => handleUpdateExam(exam.id, { course: e.target.value })}
                        >
                          {courses.map((c) => (
                            <option key={c.course} value={c.course}>
                              {c.course}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field-group">
                        <label htmlFor={`exam-date-${exam.id}`}>Exam Date</label>
                        <div className="date-input-wrap">
                          <input
                            type="date"
                            id={`exam-date-${exam.id}`}
                            value={exam.date}
                            min={exam.isRecent ? undefined : localDate()}
                            max={exam.isRecent ? localDate() : undefined}
                            onChange={(e) => handleUpdateExam(exam.id, { date: e.target.value })}
                          />
                        </div>
                        {/* Quick date presets */}
                        {!exam.isRecent && <div className="quick-date-pills">
                          <button
                            type="button"
                            onClick={() => handleUpdateExam(exam.id, { date: addDaysToDate(3) })}
                          >
                            In 3 days
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateExam(exam.id, { date: addDaysToDate(7) })}
                          >
                            In 1 week
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateExam(exam.id, { date: addDaysToDate(14) })}
                          >
                            In 2 weeks
                          </button>
                        </div>}
                      </div>
                    </div>

                    {/* Topics covered on this exam */}
                    <div className="exam-topics-picker">
                      <label className="picker-label">Topics included in this exam:</label>
                      <div className="exam-topics-checklist">
                        {availableTopics.length === 0 ? (
                          <p className="no-topics-alert">
                            No topics specified for {exam.course} yet. All class materials will be included.
                          </p>
                        ) : (
                          availableTopics.map((top) => {
                            const isChecked = exam.topics.includes(top);
                            return (
                              <label key={top} className={`topic-checkbox-label ${isChecked ? 'checked' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleExamTopic(exam.id, top)}
                                />
                                <span>{top}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="button" className="learn-button subtle add-exam-btn" onClick={handleAddExam}>
              <Plus size={15} />
              <span>{exams.length ? "Add another exam or subject" : "Add a recent or upcoming exam"}</span>
            </button>
          </section>

          {/* Section 2B: Break-Respectful Pacing */}
          <section className="intake-section break-pacing-section">
            <div className="section-title-wrap">
              <Coffee size={18} className="section-icon warm" />
              <div>
                <h3>Break-Respectful Pacing</h3>
                <p>
                  High mastery doesn't come from burning out. Curve intentionally embeds rest intervals and low-intensity buffers before exams.
                </p>
              </div>
            </div>

            <div className="break-controls-box">
              <div className="break-row">
                <div className="break-info">
                  <strong>Weekly Rest Days</strong>
                  <p>Designate intentional rest days to let learned concepts consolidate.</p>
                </div>
                <div className="rest-days-selector">
                  {[
                    { count: 1, label: '1 Day / Wk (Balanced)' },
                    { count: 2, label: '2 Days / Wk (Gentle)' },
                    { count: 0, label: 'Daily micro-habits' },
                  ].map((opt) => (
                    <button
                      key={opt.count}
                      type="button"
                      className={`break-pill-btn ${breaks.restDaysPerWeek === opt.count ? 'is-active' : ''}`}
                      onClick={() => setBreaks({ ...breaks, restDaysPerWeek: opt.count })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="break-row">
                <div className="break-info">
                  <strong>Pre-Exam Buffer Window</strong>
                  <p>Shift to light, spaced recall 48h before exam day instead of panic cramming.</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={breaks.preExamBufferHours >= 48}
                    onChange={(e) =>
                      setBreaks({
                        ...breaks,
                        preExamBufferHours: e.target.checked ? 48 : 24,
                      })
                    }
                  />
                  <span className="toggle-slider" />
                  <span className="toggle-text">
                    {breaks.preExamBufferHours >= 48 ? '48h Buffer Enabled' : '24h Buffer'}
                  </span>
                </label>
              </div>

              <div className="break-row">
                <div className="break-info">
                  <strong>Daily Study Rhythm</strong>
                  <p>Target focused minutes per study day.</p>
                </div>
                <div className="rhythm-pills">
                  {[10, 20, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={`break-pill-btn ${dailyMinutes === mins ? 'is-active' : ''}`}
                      onClick={() => setDailyMinutes(mins)}
                    >
                      {mins} mins
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Step 2 Actions */}
          <div className="intake-actions-footer">
            <button
              type="button"
              className="learn-button subtle"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <button
              type="button"
              className="learn-button dark primary-next"
              onClick={() => void handleBuildPlan()}
              disabled={submitting || busy}
            >
              <Sparkles size={16} />
              <span>{submitting ? 'Generating Your Plan…' : initialPlan ? 'Update my plan' : 'Create my plan & next steps'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
