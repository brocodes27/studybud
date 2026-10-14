import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileText,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  independentAccuracy,
  recommendedMaterials,
  weeklyActivity,
  type Material,
  type StudySession,
} from "../model";
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
  const ready = materials.some(
    (material) =>
      material.metadata.confirmed && material.metadata.topics?.length,
  );
  const visible = materials.filter((material) =>
    `${material.title} ${material.metadata.course || ""} ${(material.metadata.topics || []).join(" ")}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

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
          <section
            className="study-agent-card"
            aria-labelledby="study-agent-title"
          >
            <header className="study-agent-header">
              <span className="study-agent-icon peach">
                <CalendarDays size={21} />
              </span>
              <div>
                <h2 id="study-agent-title">Study planner</h2>
                <p>Your next step</p>
              </div>
              <span className="study-agent-status">
                <i />
                {pending
                  ? "Ready to resume"
                  : recommended
                    ? "Ready for you"
                    : "Getting started"}
              </span>
            </header>
            <div className="study-agent-intro">
              <h3>
                {pending
                  ? "Pick up where you left off."
                  : recommended
                    ? "Make room for your next idea."
                    : "A good place to begin."}
              </h3>
              <p>
                {pending
                  ? "Your practice is saved. Continue whenever you’re ready."
                  : recommended
                    ? "A focused session starts with the notes you already have."
                    : "Bring your notes. Curve will help you find a clear path through them."}
              </p>
            </div>
            <div className="study-next-step">
              <div className="study-next-title">
                <BookOpen size={19} />
                <h3>
                  {pending?.topic ||
                    recommended?.title ||
                    "Your first study session"}
                </h3>
                <span>{pending ? "In progress" : "Next up"}</span>
              </div>
              <p>
                {pending
                  ? pending.mode === "checkpoint"
                    ? "Independent check · Without hints"
                    : "Guided practice · At your pace"
                  : recommended?.metadata.course ||
                    "Upload a PDF, Markdown file, or lecture notes"}
              </p>
              <div className="study-next-meta">
                <span>
                  <FileText size={14} />
                  {materials.length} material{materials.length === 1 ? "" : "s"}
                </span>
                <span>
                  <CheckCircle2 size={14} />
                  {completed.length} completed
                </span>
              </div>
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
                    ? "Open material"
                    : "Add your first material"}
                <ArrowRight size={15} />
              </button>
            </div>
          </section>

          <section
            className="study-agent-card"
            aria-labelledby="library-agent-title"
          >
            <header className="study-agent-header">
              <span className="study-agent-icon lavender">
                <BookOpen size={21} />
              </span>
              <div>
                <h2 id="library-agent-title">Your library</h2>
                <p>Knowledge, collected</p>
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
                Your notes belong here. Add your first material to start
                learning with Curve.
              </p>
            )}
            <Link className="study-card-link" to="/library">
              View library
              <ArrowUpRight size={14} />
            </Link>
          </section>

          <section
            className="study-agent-card"
            aria-labelledby="progress-agent-title"
          >
            <header className="study-agent-header">
              <span className="study-agent-icon mint">
                <Sparkles size={21} />
              </span>
              <div>
                <h2 id="progress-agent-title">Learning progress</h2>
                <p>One session at a time</p>
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
        </>
      )}
    </div>
  );
}
