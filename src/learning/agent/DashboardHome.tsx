import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  independentAccuracy,
  weeklyActivity,
  type Material,
  type StudySession,
} from "../model";
import type { EnlistedExam, SemesterPlan, StudyPlan, StudyPlanStep } from "./contracts";
import { buildSemesterSchedule } from './semesterPlanner';
import { SemesterIntake } from "./SemesterIntake";
import { SemesterRoadmapView } from "./SemesterRoadmapView";
import "./dashboard.css";
import "./focus.css";

export function HomeView({
  materials,
  sessions,
  firstName,
  loading = false,
  error = "",
  busy = false,
  semesterPlan = null,
  initialCourses = [],
  onSaveSemesterPlan,
  onStartPlanStep,
  onReviewExam,
  onRetry,
  onOpenMaterial,
  onOpenSession,
  onUploadClick,
  onPromptClick,
}: {
  materials: Material[];
  sessions: StudySession[];
  firstName: string;
  loading?: boolean;
  error?: string;
  busy?: boolean;
  semesterPlan?: SemesterPlan | null;
  initialCourses?: string[];
  onSaveSemesterPlan?: (plan: SemesterPlan, studyPlan: StudyPlan) => Promise<void> | void;
  onStartPlanStep?: (step: StudyPlanStep) => void;
  onReviewExam?: (exam: EnlistedExam) => void;
  onRetry: () => void;
  onOpenMaterial: (material: Material) => void;
  onOpenSession: (sessionId: string) => void;
  onUploadClick: () => void;
  onPromptClick: (prompt: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [isEditingSemester, setIsEditingSemester] = useState(false);

  const pending = sessions.find(
    (session) => !session.completed_at && session.questions?.length,
  );
  const completed = sessions.filter((session) => session.completed_at);
  const accuracy = independentAccuracy(completed);
  const activity = weeklyActivity(sessions);
  const weeklyTotal = activity.reduce(
    (sum, day) => sum + day.practice + day.checkpoint,
    0,
  );
  const ready = materials.some(
    (material) =>
      material.metadata.confirmed && material.metadata.topics?.length,
  );
  const visible = materials.filter((material) =>
    `${material.title} ${material.metadata.course || ""} ${(material.metadata.topics || []).join(" ")}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  const derivedInitialCourses = initialCourses.length
    ? initialCourses
    : (Array.from(new Set(materials.map((m) => m.metadata.course).filter(Boolean))) as string[]);

  return (
    <div className="curve-dashboard" aria-busy={loading}>
      <h1 className="sr-only">{firstName}'s learning dashboard</h1>
      {error ? (
        <div className="dash-error" role="alert">
          <p>{error}</p>
          <button className="learn-button subtle" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="dash-skeleton" role="status">
          <span className="sr-only">Loading your dashboard…</span>
          <div />
          <div />
          <div />
        </div>
      ) : (
        <>
          {/* Primary Semester & Exam Hub */}
          {semesterPlan && !isEditingSemester ? (
            <SemesterRoadmapView
              plan={semesterPlan}
              materials={materials}
              sessions={sessions}
              onOpenSession={onOpenSession}
              onEditPlan={() => setIsEditingSemester(true)}
              onStartStep={(step) => {
                if (onStartPlanStep) {
                  onStartPlanStep(step);
                } else {
                  onPromptClick(`Let's study ${step.topic}`);
                }
              }}
              onFinishExam={onSaveSemesterPlan ? async (examId) => {
                const updated = buildSemesterSchedule({ ...semesterPlan, exams: semesterPlan.exams.map(exam => exam.id === examId ? { ...exam, isRecent: true } : exam) }, semesterPlan.dailyMinutes || 30);
                await onSaveSemesterPlan(updated.semesterPlan, updated.studyPlan);
              } : undefined}
              onReviewExam={(examId) => {
                const exam = semesterPlan.exams.find(exam => exam.id === examId)!;
                if (onReviewExam) onReviewExam(exam);
                else onPromptClick(`Help me review ${exam.title} (${exam.course}) and identify gaps. Do not assume I completed my revision or mastered its topics.`);
              }}
              busy={busy}
            />
          ) : (
            <SemesterIntake
              materials={materials}
              initialCourses={derivedInitialCourses}
              initialPlan={semesterPlan}
              onSavePlan={async (newPlan, studyPlan) => {
                if (onSaveSemesterPlan) {
                  await onSaveSemesterPlan(newPlan, studyPlan);
                }
                setIsEditingSemester(false);
              }}
              onCancel={semesterPlan ? () => setIsEditingSemester(false) : undefined}
              onUploadSyllabusClick={onUploadClick}
              busy={busy}
            />
          )}

          <details className="daily-supporting-details">
            <summary>Your materials & progress</summary>
          {/* Active Pending Session Alert if exists */}
          {pending && (
            <div className="pending-session-banner">
              <div className="pending-info">
                <span className="pending-dot" />
                <span>Saved session: <strong>{pending.topic}</strong>.</span>
              </div>
              <button
                type="button"
                className="learn-button subtle compact-btn"
                onClick={() => onOpenSession(pending.id)}
                disabled={busy}
              >
                <span>Resume</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* Library Section */}
          <section
            className="study-agent-card"
            aria-labelledby="library-agent-title"
          >
            <header className="study-agent-header">
              <div>
                <h2 id="library-agent-title">Your library</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Add material"
                onClick={onUploadClick}
              >
                <Plus size={18} />
              </button>
            </header>
            {materials.length > 0 ? (
              <>
                <div className="study-library-search">
                  <Search size={15} />
                  <input
                    aria-label="Search your bookshelf"
                    placeholder="Find a course, topic, or note…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => setQuery("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="study-library-list">
                  {visible.slice(0, 3).map((material) => (
                    <button
                      key={material.id}
                      onClick={() => onOpenMaterial(material)}
                    >
                      <span>
                        <strong>{material.title}</strong>
                        <small>
                          {material.metadata.course || "Course notes"} ·{" "}
                          {material.metadata.confirmed
                            ? `${material.metadata.topics?.length || 0} topics`
                            : "Review topics"}
                        </small>
                      </span>
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                  {visible.length === 0 && (
                    <p role="status">No materials match “{query}”.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="study-card-note">
                Add your notes or slides to study from your course material.
              </p>
            )}
            <Link className="study-card-link" to="/library">
              View library
              <ArrowUpRight size={14} />
            </Link>
          </section>

          {/* Learning Progress Section */}
          <section
            className="study-agent-card"
            aria-labelledby="progress-agent-title"
          >
            <header className="study-agent-header">
              <div>
                <h2 id="progress-agent-title">Progress</h2>
              </div>
              <Link
                className="icon-button"
                to="/progress"
                aria-label="View your progress"
              >
                <ArrowUpRight size={18} />
              </Link>
            </header>
            <p className="study-card-note">
              {weeklyTotal} session{weeklyTotal === 1 ? "" : "s"} completed this
              week
            </p>
            <div className="study-progress-metric">
              <div>
                <p>Independent accuracy</p>
                <strong>{accuracy === null ? "—" : `${accuracy}%`}</strong>
                <span>
                  {accuracy === null
                    ? "Take a check to see your progress"
                    : "Without hints"}
                </span>
              </div>
              <div
                className="study-week-chart"
                role="img"
                aria-label={activity
                  .map(
                    (day) =>
                      `${day.label}: ${day.practice + day.checkpoint} sessions`,
                  )
                  .join("; ")}
              >
                {activity.map((day, index) => (
                  <div key={index} aria-hidden="true">
                    <span
                      style={{
                        height: `${Math.max(4, ((day.practice + day.checkpoint) / Math.max(1, ...activity.map((item) => item.practice + item.checkpoint))) * 48)}px`,
                      }}
                    />
                    <small>{day.label.slice(0, 1)}</small>
                  </div>
                ))}
              </div>
            </div>
            <button
              className="study-card-link"
              disabled={busy || !ready}
              onClick={() =>
                onPromptClick("Start an independent check on my notes.")
              }
            >
              Check your understanding
              <ArrowRight size={14} />
            </button>
          </section>
          </details>
        </>
      )}
    </div>
  );
}
