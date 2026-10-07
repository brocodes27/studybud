import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  daysToExam,
  independentAccuracy,
  recommendedMaterials,
  weeklyActivity,
  type Material,
  type StudySession,
} from "../model";
import { StudyDoodle } from "../StudyDoodle";
import "./dashboard.css";

export function HomeView({
  materials,
  sessions,
  firstName,
  loading = false,
  error = "",
  busy = false,
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
  onRetry: () => void;
  onOpenMaterial: (material: Material) => void;
  onOpenSession: (sessionId: string) => void;
  onUploadClick: () => void;
  onPromptClick: (prompt: string) => void;
}) {
  const [query, setQuery] = useState("");
  const pending = sessions.find(
    (session) => !session.completed_at && session.questions?.length,
  );
  const recommended = recommendedMaterials(materials, sessions)[0];
  const completed = sessions.filter((session) => session.completed_at);
  const accuracy = independentAccuracy(completed);
  const activity = weeklyActivity(sessions);
  const weeklyTotal = activity.reduce(
    (sum, day) => sum + day.practice + day.checkpoint,
    0,
  );
  const activeDays = activity.filter(
    (day) => day.practice + day.checkpoint > 0,
  ).length;
  const maxActivity = Math.max(
    3,
    ...activity.map((day) => day.practice + day.checkpoint),
  );
  const visible = materials.filter((material) =>
    `${material.title} ${material.metadata.course || ""} ${(material.metadata.topics || []).join(" ")}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const ready = materials.some(
    (material) =>
      material.metadata.confirmed && material.metadata.topics?.length,
  );

  return (
    <div className="curve-dashboard" aria-busy={loading}>
      <header className="dash-heading">
        <div>
          <p className="dash-eyebrow">YOUR LEARNING SPACE</p>
          <h1>A little progress, {firstName}.</h1>
          <p>Your notes, your next step, your own pace.</p>
        </div>
        <span className="dash-date">
          <CalendarDays size={15} />
          {new Date().toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            weekday: "short",
          })}
        </span>
      </header>

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
          <div className="dash-overview">
            <section className="dash-focus" aria-labelledby="dash-focus-title">
              <div className="dash-focus-copy">
                <span className="dash-focus-label">
                  <span />
                  {pending
                    ? "READY TO PICK BACK UP"
                    : recommended
                      ? "A GOOD NEXT STEP"
                      : "LET’S START SOMETHING GOOD"}
                </span>
                <h2 id="dash-focus-title">
                  {pending
                    ? pending.topic
                    : recommended
                      ? recommended.title
                      : "Big ideas. Small beginnings."}
                </h2>
                <p>
                  {pending
                    ? "Your session is right where you left it. Make a little more room for understanding."
                    : recommended
                      ? `${recommended.metadata.course || "Your notes"} · Open your material, revisit a topic, and put it into practice.`
                      : "Bring your notes. We’ll help turn them into a clear path from “not quite” to “got it”."}
                </p>
                <button
                  className="learn-button dark"
                  disabled={busy}
                  onClick={() =>
                    pending
                      ? onOpenSession(pending.id)
                      : recommended
                        ? onOpenMaterial(recommended)
                        : onUploadClick()
                  }
                >
                  {pending
                    ? "Continue session"
                    : recommended
                      ? "Open your notes"
                      : "Add your first material"}
                  <ArrowRight size={16} />
                </button>
                <span className="dash-focus-note">
                  <BookOpen size={13} />
                  {pending
                    ? pending.mode === "checkpoint"
                      ? "Independent check"
                      : "Guided practice"
                    : "Built around what you’re learning"}
                </span>
              </div>
              <StudyDoodle kind="notebook" className="dash-focus-doodle" />
            </section>
            <section className="dash-week" aria-labelledby="dash-week-title">
              <div className="dash-section-title">
                <h2 id="dash-week-title">Your week, so far</h2>
                <span className="dash-mini-icon">
                  <CalendarDays size={17} />
                </span>
              </div>
              <div className="dash-week-total">
                <strong>{weeklyTotal}</strong>
                <span>
                  session{weeklyTotal === 1 ? "" : "s"} completed
                  <small>Over the last 7 days</small>
                </span>
              </div>
              <div
                className="dash-chart"
                role="img"
                aria-label={`Last seven days: ${activity.map((day) => `${day.label}: ${day.practice} practice, ${day.checkpoint} checks`).join("; ")}`}
              >
                {activity.map((day, index) => (
                  <div
                    className={`dash-chart-day ${index === 6 ? "today" : ""}`}
                    key={index}
                    aria-hidden="true"
                  >
                    <div className="dash-bar-track">
                      <div
                        className="dash-bar-stack"
                        style={{
                          height: `${((day.practice + day.checkpoint) / maxActivity) * 100}%`,
                        }}
                      >
                        <span
                          className="dash-bar-check"
                          style={{ flex: day.checkpoint }}
                        />
                        <span
                          className="dash-bar-practice"
                          style={{ flex: day.practice }}
                        />
                      </div>
                    </div>
                    <span>{day.label.slice(0, 1)}</span>
                  </div>
                ))}
              </div>
              <div className="dash-chart-legend">
                <span>
                  <i />
                  Practice
                </span>
                <span>
                  <i />
                  Independent checks
                </span>
              </div>
              <p className="dash-week-note">
                {activeDays
                  ? `${activeDays} learning day${activeDays === 1 ? "" : "s"}. Every bit counts.`
                  : "Your first session starts the story."}
              </p>
            </section>
          </div>

          <dl className="dash-stats" aria-label="Learning overview">
            <div>
              <span className="dash-stat-icon lavender">
                <FileText size={18} />
              </span>
              <div>
                <dt>In your library</dt>
                <dd>
                  {materials.length}
                  <span>material{materials.length === 1 ? "" : "s"}</span>
                </dd>
              </div>
            </div>
            <div>
              <span className="dash-stat-icon mint">
                <CheckCircle2 size={18} />
              </span>
              <div>
                <dt>Sessions completed</dt>
                <dd>
                  {completed.length}
                  <span>all time</span>
                </dd>
              </div>
            </div>
            <div>
              <span className="dash-stat-icon peach">
                <Sparkles size={18} />
              </span>
              <div>
                <dt>Independent accuracy</dt>
                <dd>
                  {accuracy === null ? "—" : `${accuracy}%`}
                  <span>
                    {accuracy === null
                      ? "Try your first check"
                      : "without hints"}
                  </span>
                </dd>
              </div>
            </div>
          </dl>

          <section
            className="dash-library"
            aria-labelledby="dash-library-title"
          >
            <div className="dash-section-title">
              <div>
                <h2 id="dash-library-title">On your bookshelf</h2>
                <p>A familiar place to pick things up.</p>
              </div>
              <Link className="text-button" to="/library">
                View library <ArrowUpRight size={15} />
              </Link>
            </div>
            {materials.length > 0 && (
              <div className="dash-search">
                <Search size={16} />
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
                    <X size={15} />
                  </button>
                )}
                <span>
                  {visible.length} material{visible.length === 1 ? "" : "s"}
                </span>
              </div>
            )}
            {materials.length === 0 ? (
              <div className="dash-empty">
                <StudyDoodle kind="sprout" />
                <div>
                  <h3>A fresh shelf for fresh ideas.</h3>
                  <p>Add a PDF, Markdown file, or paste your lecture notes.</p>
                </div>
                <button className="learn-button subtle" onClick={onUploadClick}>
                  <Plus size={16} />
                  Add material
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="dash-no-results" role="status">
                <p>No materials match “{query}”.</p>
                <button className="text-button" onClick={() => setQuery("")}>
                  Clear search <X size={14} />
                </button>
              </div>
            ) : (
              <div className="dash-materials">
                {visible.slice(0, 4).map((material, index) => {
                  const days = daysToExam(material.metadata.exam_on);
                  return (
                    <button
                      className={`dash-material dash-tone-${index % 4}`}
                      key={material.id}
                      onClick={() => onOpenMaterial(material)}
                    >
                      <div className="dash-material-top">
                        <span className="dash-book-icon">
                          <BookOpen size={20} />
                        </span>
                        <ArrowUpRight size={17} />
                      </div>
                      <span className="dash-course-label">
                        {material.metadata.course || "Course notes"}
                      </span>
                      <h3>{material.title}</h3>
                      <p>
                        {material.metadata.topics?.slice(0, 2).join(" · ") ||
                          "Your next ideas are in here."}
                      </p>
                      <div className="dash-material-meta">
                        <span>
                          {material.metadata.confirmed
                            ? `${material.metadata.topics?.length || 0} topics`
                            : "Review topics"}
                        </span>
                        <span>
                          {days !== null && days >= 0
                            ? days === 0
                              ? "Exam today"
                              : `Exam in ${days}d`
                            : `${material.metadata.page_count || material.metadata.pages?.length || 1} pages`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section
            className="dash-shortcuts"
            aria-labelledby="dash-shortcut-title"
          >
            <div>
              <span className="dash-mini-icon">
                <Sparkles size={18} />
              </span>
              <h2 id="dash-shortcut-title">A little help from Curve</h2>
              <p>
                {ready
                  ? "Find your focus. We’ll take it from there."
                  : "Add your notes to unlock a plan and practice."}
              </p>
            </div>
            <button
              disabled={busy || !ready}
              onClick={() =>
                onPromptClick(
                  "Create a 30-minute focused study plan from my course notes.",
                )
              }
            >
              <Clock size={17} />
              <span>
                Make a study plan<small>A focused 30-minute session</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
            <button
              disabled={busy || !ready}
              onClick={() =>
                onPromptClick("Start an independent check on my notes.")
              }
            >
              <CheckCircle2 size={17} />
              <span>
                See what’s sticking<small>Try an independent check</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          </section>
          <footer className="dash-footer">
            <StudyDoodle kind="sprout" />
            <span>Room to grow. One page at a time.</span>
            <Link to="/progress">
              See your progress <ArrowRight size={14} />
            </Link>
          </footer>
        </>
      )}
    </div>
  );
}
