import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  FileText,
  Flag,
  FolderOpen,
  Home,
  Lightbulb,
  Loader2,
  LogOut,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  TrendingUp,
  UploadCloud,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchCourseSnapshots, type CourseSnapshot } from "../curve/data";
import {
  fetchLibrary,
  fetchMaterial,
  learningAction,
  readMaterialFile,
  saveMaterial,
} from "./api";
import {
  daysToExam,
  independentAccuracy,
  normalizeTopics,
  recommendedMaterials,
  weeklyActivity,
  type Material,
  type SourcePage,
  type StudySession,
} from "./model";
import { CurveMark, ProductPreview } from "./Preview";
import { useStudyPreferences } from "./Onboarding";
import "./learning.css";

const navigation = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/library", label: "Library", icon: FolderOpen },
  { path: "/courses", label: "Courses", icon: BookOpen },
  { path: "/progress", label: "Progress", icon: TrendingUp },
];
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { user, fullName, signOut } = useAuth();
  const { pathname } = useLocation();
  return (
    <div className="learn workspace">
      <header className="workspace-top">
        <Link className="learn-brand" to="/">
          <CurveMark />
          curve
        </Link>
        <nav aria-label="Workspace">
          {navigation.map((n) => (
            <Link
              key={n.path}
              className={pathname === n.path ? "active" : ""}
              to={n.path}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="workspace-user">
          <Link
            to="/library"
            className="icon-button"
            aria-label="Search your library"
          >
            <Search size={18} />
          </Link>
          <span className="user-avatar" title={fullName ?? user?.email}>
            {(fullName || user?.email || "S")[0].toUpperCase()}
          </span>
        </div>
      </header>
      <aside className="workspace-rail" aria-label="Quick navigation">
        {navigation.map((n) => (
          <Link
            title={n.label}
            aria-label={n.label}
            key={n.path}
            className={pathname === n.path ? "active" : ""}
            to={n.path}
          >
            <n.icon size={19} />
          </Link>
        ))}
        <span />
        <Link
          title="Account settings"
          aria-label="Account settings"
          to="/settings"
        >
          <Settings2 size={19} />
        </Link>
        <button
          title="Sign out"
          aria-label="Sign out"
          onClick={() => void signOut()}
        >
          <LogOut size={19} />
        </button>
      </aside>
      <main className="workspace-main">{children}</main>
    </div>
  );
}

function ErrorNotice({ error }: { error: string }) {
  return (
    <div role="alert" className="learn-error">
      {error}
    </div>
  );
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="learn-empty">
      <FolderOpen size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function LearningWorkspace() {
  const preferences = useStudyPreferences();
  const { user, fullName } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [courses, setCourses] = useState<CourseSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [upload, setUpload] = useState(false);
  const [edit, setEdit] = useState<Material | null>(null);
  const [busy, setBusy] = useState("");
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const library = await fetchLibrary(user.id);
      setMaterials(library.materials);
      setSessions(library.sessions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workspace.");
    } finally {
      setLoading(false);
    }
    try {
      setCourses(await fetchCourseSnapshots(user.id));
    } catch {
      /* Materials work independently of legacy course records. */
    }
  }, [user]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const filtered = materials.filter((m) =>
    `${m.title} ${m.metadata.course} ${m.metadata.topics?.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const recommendations = recommendedMaterials(materials, sessions);
  const completed = sessions.filter((s) => s.completed_at);
  const pending = sessions.find((s) => !s.completed_at && s.questions.length);
  const accuracy = independentAccuracy(sessions);
  const activity = weeklyActivity(sessions);
  const isLibrary = pathname === "/library";
  const isCourses = pathname === "/courses";
  const isProgress = pathname === "/progress";
  const firstName = fullName?.split(" ")[0] || "there";
  async function openMaterial(material: Material) {
    setBusy(material.id);
    setError("");
    try {
      setEdit(await fetchMaterial(material.id, user!.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open material.");
    } finally {
      setBusy("");
    }
  }
  async function start(
    material: Material,
    mode: "practice" | "checkpoint" = "practice",
  ) {
    if (!material.metadata.confirmed) {
      await openMaterial(material);
      return;
    }
    setBusy(material.id);
    setError("");
    try {
      const topic = nextTopic(material, sessions);
      const session = await learningAction<StudySession>({
        action: "generate",
        material_id: material.id,
        session_id: crypto.randomUUID(),
        mode,
        topic,
      });
      navigate(`/learn/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start session.");
    } finally {
      setBusy("");
    }
  }
  function materialCard(m: Material, i: number) {
    const days = daysToExam(m.metadata.exam_on);
    return (
      <article className={`library-card tone-${i % 4}`} key={m.id}>
        <div className="course-card-top">
          <span className="tiny-label">
            {m.metadata.course || "YOUR COURSE"}
          </span>
          <button
            className="icon-button"
            aria-label={`Edit ${m.title}`}
            disabled={Boolean(busy)}
            onClick={() => void openMaterial(m)}
          >
            <ArrowUpRight size={19} />
          </button>
        </div>
        <h3>{m.title}</h3>
        <p>
          {m.metadata.topics?.slice(0, 2).join(" · ") ||
            "Review topics to start learning"}
        </p>
        <div className="course-card-meta">
          <span>
            <FileText size={14} />
            {m.metadata.page_count || m.metadata.pages?.length || 1} pages
          </span>
          <span>
            {days !== null
              ? days < 0
                ? "Exam passed"
                : days === 0
                  ? "Exam today"
                  : `Exam in ${days}d`
              : "Your own pace"}
          </span>
        </div>
        <button
          className="course-start"
          disabled={Boolean(busy)}
          onClick={() => void start(m)}
        >
          {busy === m.id ? (
            <>
              <Loader2 className="spin" size={15} />
              Preparing…
            </>
          ) : (
            <>
              {m.metadata.confirmed ? "Start practice" : "Review topics"}
              <ArrowRight size={15} />
            </>
          )}
        </button>
        {m.metadata.confirmed && (
          <button
            className="text-button"
            disabled={Boolean(busy)}
            onClick={() => void start(m, "checkpoint")}
          >
            Try an independent check <ArrowUpRight size={14} />
          </button>
        )}
      </article>
    );
  }
  return (
    <WorkspaceShell>
      <div className="workspace-heading">
        <div>
          <p className="workspace-greeting">
            {isLibrary
              ? "Everything you’re learning, in one place."
              : isProgress
                ? "A clearer picture of your effort."
                : isCourses
                  ? "Make space for your whole semester."
                  : `Good to see you, ${firstName}.`}
          </p>
          <h1>
            {isLibrary
              ? "Your library"
              : isCourses
                ? "Your courses"
                : isProgress
                  ? "Your progress"
                  : "Let’s make a little progress."}
          </h1>
        </div>
        <button className="learn-button dark" onClick={() => setUpload(true)}>
          <Plus size={17} /> Add material
        </button>
      </div>
      {preferences && !isProgress && (
        <div className="workspace-study-target">
          <BookOpen size={19} />
          <div>
            <strong>
              Your study plan · {preferences.daily_minutes} minutes a day
            </strong>
            <p>
              {preferences.courses.join(" · ")}
              {preferences.exam_date
                ? ` · Next exam: ${preferences.exam_date}`
                : ""}
            </p>
          </div>
          <Link to="/onboarding">Edit</Link>
        </div>
      )}
      {error && (
        <>
          <ErrorNotice error={error} />
          <button className="text-button" onClick={() => void refresh()}>
            Retry loading workspace
          </button>
        </>
      )}
      {loading ? (
        <div className="loading-state">
          <Loader2 className="spin" />
          Getting your workspace ready…
        </div>
      ) : (
        <>
          {isLibrary || isCourses ? (
            <>
              <div className="library-toolbar">
                <div className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search materials"
                    placeholder="Search courses, topics, or notes…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <span>{filtered.length} materials</span>
                {isCourses && (
                  <Link className="learn-button subtle" to="/add-course">
                    Add a syllabus <ArrowUpRight size={15} />
                  </Link>
                )}
              </div>
              {filtered.length ? (
                <div className="material-grid">
                  {filtered.map(materialCard)}
                </div>
              ) : (
                <Empty
                  title={
                    query
                      ? "No matching materials"
                      : "A fresh page for your next course."
                  }
                  text={
                    query
                      ? "Try a different course name or topic."
                      : "Add lecture notes, a chapter, or a practice paper. Your material sets the curriculum."
                  }
                  action={
                    <button
                      className="learn-button dark"
                      onClick={() => setUpload(true)}
                    >
                      Add your first material <Plus size={15} />
                    </button>
                  }
                />
              )}
              {isCourses && courses.length > 0 && (
                <section className="learn-panel existing-courses">
                  <SectionTitle
                    title="Syllabus & grade tracking"
                    subtitle="Your existing courses are right here."
                  />
                  {courses.map((c) => (
                    <Link
                      key={c.enrollmentId}
                      to={`/course/${c.enrollmentId}`}
                      className="course-link"
                    >
                      <BookOpen size={19} />
                      <span>
                        {c.course.title}
                        <small>{c.course.courseCode}</small>
                      </span>
                      <ArrowUpRight size={17} />
                    </Link>
                  ))}
                </section>
              )}
            </>
          ) : isProgress ? (
            <>
              <div className="stats-grid">
                <Stat
                  label="Completed sessions"
                  value={completed.length.toString()}
                  note="Each one is a step forward"
                />
                <Stat
                  label="Independent accuracy"
                  value={accuracy === null ? "—" : `${accuracy}%`}
                  note="Completed checks only, without hints"
                />
                <Stat
                  label="Learning days this week"
                  value={activity
                    .filter((d) => d.practice + d.checkpoint > 0)
                    .length.toString()}
                  note="Consistency, at your own pace"
                />
              </div>
              <div className="learn-panel">
                <ActivityChart activity={activity} />
              </div>
              <div className="learn-panel history-panel">
                <SectionTitle
                  title="Your learning history"
                  subtitle="Practice and independent checks stay separate. Showing your latest 500 sessions."
                />
                {completed.length ? (
                  completed.map((s) => (
                    <Link
                      className="history-row"
                      key={s.id}
                      to={`/learn/${s.id}`}
                    >
                      <span className="history-icon">
                        <CheckCircle2 size={19} />
                      </span>
                      <span>
                        {s.topic}
                        <small>
                          {s.mode === "checkpoint"
                            ? "Independent check"
                            : "Guided practice"}{" "}
                          · {new Date(s.completed_at!).toLocaleDateString()}
                        </small>
                      </span>
                      <strong>
                        {s.results?.filter((r) => r.correct).length}/
                        {s.results?.length}
                      </strong>
                      <ArrowUpRight size={16} />
                    </Link>
                  ))
                ) : (
                  <Empty
                    title="Your story starts with a session."
                    text="Finish a practice session, then try an independent check to see what stuck."
                  />
                )}
              </div>
            </>
          ) : (
            <div className="dashboard-grid">
              <section className="learn-panel dashboard-courses">
                <SectionTitle
                  title="Pick up where you are"
                  subtitle="Your courses, your own pace."
                  action={
                    <Link
                      className="icon-button"
                      aria-label="View all materials"
                      to="/library"
                    >
                      <ArrowUpRight size={18} />
                    </Link>
                  }
                />
                <div className="search-field compact-search">
                  <Search size={15} />
                  <input
                    aria-label="Find a course"
                    placeholder="Find a course"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                {filtered.length ? (
                  filtered.slice(0, 4).map(materialCard)
                ) : (
                  <Empty
                    title="Make yourself at home."
                    text="Add your first set of notes to get started."
                    action={
                      <button
                        className="learn-button subtle"
                        onClick={() => setUpload(true)}
                      >
                        <Plus size={15} />
                        Add notes
                      </button>
                    }
                  />
                )}
              </section>
              <div className="dashboard-right">
                <section className="learn-panel">
                  <ActivityChart activity={activity} />
                </section>
                <div className="dashboard-bottom">
                  <section className="learn-panel next-step">
                    <SectionTitle
                      title="A good next step"
                      action={<Sparkles size={19} />}
                    />
                    {pending ? (
                      <>
                        <span className="pill lavender">
                          READY WHEN YOU ARE
                        </span>
                        <h3>Finish what you started.</h3>
                        <p>{pending.topic}</p>
                        <Link
                          className="learn-button dark"
                          to={`/learn/${pending.id}`}
                        >
                          Continue session <ArrowRight size={16} />
                        </Link>
                      </>
                    ) : recommendations[0] ? (
                      <>
                        <span className="pill lavender">
                          {recommendations[0].metadata.course}
                        </span>
                        <h3>{nextTopic(recommendations[0], sessions)}</h3>
                        <p>
                          Selected from your course material, recent practice,
                          and exam timing.
                        </p>
                        <button
                          className="learn-button dark"
                          disabled={Boolean(busy)}
                          onClick={() => void start(recommendations[0])}
                        >
                          {busy ? (
                            <Loader2 size={16} className="spin" />
                          ) : (
                            <>
                              Let’s do this <ArrowRight size={16} />
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="pill lavender">A FRESH START</span>
                        <h3>
                          Big ideas start
                          <br />
                          with one small step.
                        </h3>
                        <p>
                          Add your notes. We’ll help you find a useful place to
                          begin.
                        </p>
                        <button
                          className="learn-button dark"
                          onClick={() => setUpload(true)}
                        >
                          Add your first material <ArrowRight size={16} />
                        </button>
                      </>
                    )}
                  </section>
                  <section className="learn-panel progress-overview">
                    <SectionTitle
                      title="Making it stick"
                      subtitle="Understanding takes practice."
                    />
                    <div
                      className="progress-ring"
                      style={
                        {
                          "--progress": `${accuracy ?? 0}%`,
                        } as React.CSSProperties
                      }
                    >
                      <span>
                        {accuracy === null ? "—" : `${accuracy}%`}
                        <small>independent accuracy</small>
                      </span>
                    </div>
                    <div className="progress-detail">
                      <span>Sessions completed</span>
                      <strong>{completed.length}</strong>
                    </div>
                    <div className="progress-detail">
                      <span>Courses in your library</span>
                      <strong>
                        {new Set(materials.map((m) => m.metadata.course)).size}
                      </strong>
                    </div>
                    <Link className="text-button" to="/progress">
                      See your progress <ArrowRight size={14} />
                    </Link>
                  </section>
                </div>
                <section className="workspace-tip">
                  <span className="tip-icon">
                    <Lightbulb size={21} />
                  </span>
                  <div>
                    <strong>A little space to think.</strong>
                    <p>
                      Try recalling an idea before looking at your notes. Then
                      check the source.
                    </p>
                  </div>
                  <span className="tiny-label">YOUR DAILY NUDGE</span>
                </section>
              </div>
            </div>
          )}
        </>
      )}
      {upload && (
        <MaterialUpload
          onClose={() => setUpload(false)}
          onSaved={(m) => {
            setUpload(false);
            setEdit(m);
            void refresh();
          }}
        />
      )}
      {edit && (
        <MaterialEditor
          material={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            void refresh();
          }}
          onStart={(s) => navigate(`/learn/${s.id}`)}
        />
      )}
    </WorkspaceShell>
  );
}

function nextTopic(material: Material, sessions: StudySession[]): string {
  const topics = material.metadata.topics ?? [];
  return (
    [...topics].sort((a, b) => {
      const score = (t: string) => {
        const history = sessions.filter(
          (s) =>
            s.material_id === material.id && s.topic === t && s.completed_at,
        );
        return history.length * 10 + (independentAccuracy(history) ?? 0) / 10;
      };
      return score(a) - score(b);
    })[0] ?? "Your notes"
  );
}
function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="learn-panel stat">
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function ActivityChart({
  activity,
}: {
  activity: ReturnType<typeof weeklyActivity>;
}) {
  const max = Math.max(3, ...activity.map((d) => d.practice + d.checkpoint));
  const hasData = activity.some((d) => d.practice + d.checkpoint);
  return (
    <>
      <SectionTitle
        title="Small steps. Real progress."
        subtitle="Completed sessions over the last seven days."
        action={<span className="chart-range">This week</span>}
      />
      <div className="chart-legend">
        <span>Practice</span>
        <span>Independent checks</span>
      </div>
      <div className="activity-chart">
        {activity.map((d, i) => (
          <div key={i} className="activity-day">
            <div className="activity-bar-space">
              <span
                className="activity-bar practice"
                title={`${d.practice} practice sessions`}
                style={{ height: `${(100 * d.practice) / max}%` }}
              />
              <span
                className="activity-bar checkpoint"
                title={`${d.checkpoint} independent checks`}
                style={{ height: `${(100 * d.checkpoint) / max}%` }}
              />
            </div>
            <small>{d.label}</small>
          </div>
        ))}
        {!hasData && (
          <div className="chart-empty-label">
            Your first session starts the story.
          </div>
        )}
      </div>
    </>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  useEffect(() => {
    previous.current = document.activeElement as HTMLElement;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = before;
      previous.current?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="learn-modal"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const nodes = ref.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input,select,textarea,a[href]",
            );
            if (!nodes?.length) return;
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === ref.current)
            ) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function MaterialUpload({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (m: Material) => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [exam, setExam] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      let pages: SourcePage[];
      if (file) pages = await readMaterialFile(file);
      else {
        if (text.trim().length < 100 || text.length > 300000)
          throw new Error("Paste at least 100 characters, up to 300,000.");
        pages = [{ page: 1, text: text.trim() }];
      }
      onSaved(
        await saveMaterial(user.id, title.trim(), course.trim(), exam, pages),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read material.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Make room for something new."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="modal-description">
        Your material sets the curriculum. Bring any course.
      </p>
      <form onSubmit={(e) => void submit(e)}>
        <label>
          Course name
          <input
            required
            maxLength={120}
            placeholder="e.g. Introduction to psychology"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
          />
        </label>
        <label>
          Material title
          <input
            required
            maxLength={160}
            placeholder="e.g. Week 4 · Memory and learning"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Next exam <span className="optional">optional</span>
          <input
            type="date"
            value={exam}
            onChange={(e) => setExam(e.target.value)}
          />
        </label>
        <input
          className="sr-only"
          type="file"
          accept=".pdf,.txt,.md"
          ref={fileRef}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
          }}
        />
        <button
          type="button"
          className="upload-zone"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) {
              setFile(f);
              if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
            }
          }}
        >
          <UploadCloud size={30} />
          <strong>
            {file ? file.name : "Drop your material here, or browse"}
          </strong>
          <span>Searchable PDF, TXT, Markdown · up to 20 MB</span>
        </button>
        {file ? (
          <button
            type="button"
            className="text-button"
            onClick={() => setFile(null)}
          >
            Remove file
          </button>
        ) : (
          <label>
            Or paste your notes
            <textarea
              rows={5}
              placeholder="Definitions, explanations, worked examples…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        )}
        <p className="field-note">
          Saved privately to your account. AI uses excerpts to suggest topics
          and practice.
        </p>
        {error && <ErrorNotice error={error} />}
        <button
          className="learn-button dark full-width"
          disabled={busy || !course.trim() || !title.trim()}
        >
          {busy ? (
            <>
              <Loader2 className="spin" size={17} />
              Reading your material…
            </>
          ) : (
            <>
              Add to my library <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </Modal>
  );
}

function MaterialEditor({
  material,
  onClose,
  onSaved,
  onStart,
}: {
  material: Material;
  onClose: () => void;
  onSaved: () => void;
  onStart: (s: StudySession) => void;
}) {
  const { user } = useAuth();
  const [topics, setTopics] = useState(
    material.metadata.topics?.join("\n") ?? "",
  );
  const [summary, setSummary] = useState(material.metadata.summary ?? "");
  const [exam, setExam] = useState(material.metadata.exam_on ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [mode, setMode] = useState<"practice" | "checkpoint">("practice");
  const [selectedTopic, setSelectedTopic] = useState(
    material.metadata.topics?.[0] ?? "",
  );
  async function analyze() {
    setBusy(true);
    setError("");
    try {
      const result = await learningAction<{
        topics: string[];
        summary: string;
      }>({ action: "analyze", material_id: material.id });
      setTopics(result.topics.join("\n"));
      setSummary(result.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not suggest topics.");
    } finally {
      setBusy(false);
    }
  }
  async function save(start = false) {
    setBusy(true);
    setError("");
    try {
      const list = normalizeTopics(topics);
      if (!list.length) throw new Error("Add at least one topic.");
      const { error } = await supabase
        .from("materials")
        .update({
          metadata: {
            ...material.metadata,
            exam_on: exam || null,
            summary,
            topics: list,
            confirmed: true,
          },
        })
        .eq("id", material.id)
        .eq("owner_user_id", user!.id);
      if (error) throw error;
      if (start) {
        const s = await learningAction<StudySession>({
          action: "generate",
          material_id: material.id,
          session_id: crypto.randomUUID(),
          mode,
          topic: list.includes(selectedTopic) ? selectedTopic : list[0],
        });
        onStart(s);
      } else onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save topics.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    const { error } = await supabase
      .from("materials")
      .delete()
      .eq("id", material.id)
      .eq("owner_user_id", user!.id);
    if (error) {
      setError("Could not delete material.");
      setBusy(false);
    } else onSaved();
  }
  return (
    <Modal
      title={material.title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className="modal-description">
        {material.metadata.course} · {material.metadata.pages?.length ?? 1}{" "}
        pages
      </p>
      {summary && <p className="material-summary">{summary}</p>}
      <button
        className="learn-button subtle"
        disabled={busy}
        onClick={() => void analyze()}
      >
        <Sparkles size={16} />
        {busy ? "Working…" : "Suggest topics from my material"}
      </button>
      <label>
        What’s on your exam?
        <span className="field-note">
          Review, edit, or add up to 30 topics. One per line.
        </span>
        <textarea
          rows={7}
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
          placeholder="Add your topics here, or use the suggestion above."
        />
      </label>
      <label>
        Next exam <span className="optional">optional</span>
        <input
          type="date"
          value={exam}
          onChange={(e) => setExam(e.target.value)}
        />
      </label>
      <label>
        Focus topic
        <select
          value={selectedTopic}
          onChange={(e) => setSelectedTopic(e.target.value)}
        >
          {normalizeTopics(topics).map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Session type
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "practice" | "checkpoint")}
        >
          <option value="practice">Guided practice · hints available</option>
          <option value="checkpoint">Independent check · no hints</option>
        </select>
      </label>
      <p className="field-note">
        Questions cover selected excerpts, not every page. Each new set avoids
        exact repeats.
      </p>
      {error && <ErrorNotice error={error} />}
      <div className="modal-actions">
        <button
          className="learn-button subtle"
          disabled={busy}
          onClick={() => void save()}
        >
          Save topics
        </button>
        <button
          className="learn-button dark"
          disabled={busy}
          onClick={() => void save(true)}
        >
          {busy ? (
            <Loader2 className="spin" size={16} />
          ) : (
            <>
              Confirm & start <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
      <details className="source-details">
        <summary>
          <FileText size={15} />
          Read source material
        </summary>
        {material.metadata.pages?.map((p) => (
          <section key={p.page}>
            <strong>Page {p.page}</strong>
            <p>{p.text}</p>
          </section>
        ))}
      </details>
      <div className="delete-material">
        {deleting ? (
          <>
            <p>
              Delete this material and its study sessions? This cannot be
              undone.
            </p>
            <button
              disabled={busy}
              className="learn-button danger"
              onClick={() => void remove()}
            >
              Delete permanently
            </button>
            <button className="text-button" onClick={() => setDeleting(false)}>
              Keep material
            </button>
          </>
        ) : (
          <button
            className="text-button danger-text"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={14} />
            Delete material
          </button>
        )}
      </div>
    </Modal>
  );
}

export function MaterialStudy() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const [session, setSession] = useState<StudySession | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState("");
  const [reported, setReported] = useState(false);
  const [reportError, setReportError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSession(null);
    setError("");
    setIndex(0);
    setHint("");
    void supabase
      .from("curve_material_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user!.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data)
          setError(
            "Session unavailable. Return to your library and start again.",
          );
        else {
          setSession(data as StudySession);
          let draft = data.answers ?? {};
          try {
            const saved = JSON.parse(
              sessionStorage.getItem(`curve-draft:${user!.id}:${sessionId}`) ||
                "null",
            );
            if (saved && !data.completed_at) draft = { ...draft, ...saved };
          } catch {
            /* Storage may be unavailable. */
          }
          setAnswers(draft);
          const unanswered = data.questions.findIndex(
            (q: { id: string }) => draft[q.id] === undefined,
          );
          setIndex(Math.max(0, unanswered));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, user]);
  async function next() {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      await learningAction({ action: "save", session_id: session.id, answers });
      setIndex((i) => i + 1);
      setHint("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save answer.");
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      setSession(
        await learningAction<StudySession>({
          action: "submit",
          session_id: session.id,
          answers,
        }),
      );
      try {
        sessionStorage.removeItem(`curve-draft:${user!.id}:${session.id}`);
      } catch {
        /* Storage may be unavailable. */
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not submit. Your answers are still here.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function showHint() {
    if (!session) return;
    setBusy(true);
    try {
      const h = await learningAction<{ hint: string }>({
        action: "hint",
        session_id: session.id,
        question_id: session.questions[index].id,
      });
      setHint(h.hint);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hint unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function reportIssue(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setReportError("");
    const { error } = await supabase.from("curve_material_reports").insert({
      user_id: user!.id,
      session_id: session.id,
      question_id: "session",
      reason: report.trim(),
    });
    if (error) setReportError("Could not send report. Please retry.");
    else setReported(true);
  }
  const question = session?.questions[index];
  return (
    <WorkspaceShell>
      <Link className="back-link" to="/library">
        <ArrowLeft size={16} />
        Back to your library
      </Link>
      {loading ? (
        <div className="loading-state">
          <Loader2 className="spin" />
          Opening your session…
        </div>
      ) : !session ? (
        <ErrorNotice error={error || "Session not found."} />
      ) : (
        <div className="study-layout">
          <div className="study-main">
            <span className="pill lavender">
              {session.mode === "checkpoint"
                ? "INDEPENDENT CHECK"
                : "GUIDED PRACTICE"}
            </span>
            <h1>{session.topic}</h1>
            <p className="study-subtitle">
              {session.mode === "checkpoint"
                ? "A little space to think. No hints in this check."
                : "Take your time. Understanding comes one attempt at a time."}
            </p>
            {error && <ErrorNotice error={error} />}
            {session.results ? (
              <>
                <div className="learn-panel session-finish">
                  <CheckCircle2 size={38} />
                  <h2>You showed up. That counts.</h2>
                  <strong>
                    {session.results.filter((r) => r.correct).length} /{" "}
                    {session.results.length}
                  </strong>
                  <p>
                    {session.mode === "checkpoint"
                      ? "Your independent check is saved."
                      : "Your practice is saved. Try an independent check when you’re ready."}{" "}
                    This reflects this set, not your exam grade.
                  </p>
                  <Link className="learn-button dark" to="/progress">
                    See your progress <ArrowRight size={16} />
                  </Link>
                </div>
                {session.results.map((r, i) => (
                  <article
                    className="learn-panel result-card"
                    key={r.question_id}
                  >
                    <span className={`pill ${r.correct ? "mint" : "peach"}`}>
                      {r.correct ? "Correct" : "Worth another look"}
                    </span>
                    <h3>{session.questions[i]?.question}</h3>
                    <p>
                      <strong>Answer: </strong>
                      {r.expected}
                    </p>
                    <p>{r.explanation}</p>
                    <blockquote>
                      <span>YOUR MATERIAL · PAGE {r.page}</span>
                      {r.quote}
                    </blockquote>
                  </article>
                ))}
                <form
                  className="learn-panel report-form"
                  onSubmit={(e) => void reportIssue(e)}
                >
                  <h3>
                    <Flag size={16} />
                    Something doesn’t look right?
                  </h3>
                  {reported ? (
                    <p role="status">
                      Report saved. Thank you for helping improve this material.
                    </p>
                  ) : (
                    <>
                      <label>
                        Describe the question and issue
                        <textarea
                          required
                          minLength={5}
                          maxLength={2000}
                          value={report}
                          onChange={(e) => setReport(e.target.value)}
                        />
                      </label>
                      {reportError && <ErrorNotice error={reportError} />}
                      <button className="learn-button subtle">
                        Send report
                      </button>
                    </>
                  )}
                </form>
              </>
            ) : question ? (
              <section className="learn-panel question-panel">
                <div className="question-count">
                  <span>
                    Question {index + 1} of {session.questions.length}
                  </span>
                  <span>Source · page {question.page}</span>
                </div>
                <div className="question-progress">
                  <span
                    style={{
                      width: `${(100 * (index + 1)) / session.questions.length}%`,
                    }}
                  />
                </div>
                <h2>{question.question}</h2>
                <div
                  className="answer-options"
                  role="radiogroup"
                  aria-label="Answer choices"
                >
                  {question.options.map((option, i) => (
                    <button
                      key={i}
                      role="radio"
                      aria-checked={answers[question.id] === i}
                      disabled={busy}
                      className={answers[question.id] === i ? "selected" : ""}
                      onClick={() => {
                        const draft = { ...answers, [question.id]: i };
                        setAnswers(draft);
                        try {
                          sessionStorage.setItem(
                            `curve-draft:${user!.id}:${session.id}`,
                            JSON.stringify(draft),
                          );
                        } catch {
                          /* Save & continue persists remotely. */
                        }
                      }}
                    >
                      <span>{String.fromCharCode(65 + i)}</span>
                      {option}
                      {answers[question.id] === i && <Check size={17} />}
                    </button>
                  ))}
                </div>
                {hint && (
                  <div className="hint-box">
                    <Lightbulb size={18} />
                    <p>{hint}</p>
                  </div>
                )}
                <div className="question-actions">
                  {index > 0 ? (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        setIndex((i) => i - 1);
                        setHint("");
                      }}
                    >
                      Previous
                    </button>
                  ) : (
                    <span />
                  )}
                  {session.mode === "practice" && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void showHint()}
                    >
                      <Lightbulb size={15} />A little nudge
                    </button>
                  )}
                  <button
                    className="learn-button dark"
                    disabled={busy || answers[question.id] === undefined}
                    onClick={() =>
                      void (index === session.questions.length - 1
                        ? submit()
                        : next())
                    }
                  >
                    {busy ? (
                      <Loader2 className="spin" size={17} />
                    ) : (
                      <>
                        {index === session.questions.length - 1
                          ? "Check my answers"
                          : "Save & continue"}
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </section>
            ) : (
              <Empty
                title="Still preparing this set."
                text="Return to your library to try again."
              />
            )}
          </div>
          <aside className="study-sidebar learn-panel">
            <Sparkles size={24} />
            <h3>Your effort is the important part.</h3>
            <p>
              {session.mode === "checkpoint"
                ? "Recall each answer on your own. Review the source after submitting."
                : "Try an answer before looking for a hint. Mistakes help identify what to revisit."}
            </p>
            <hr />
            <FileText size={20} />
            <h4>Grounded in your notes</h4>
            <p>Source excerpts appear with explanations after submission.</p>
            <small>
              AI-generated practice can contain errors. Check the source and
              report anything that seems wrong.
            </small>
          </aside>
        </div>
      )}
    </WorkspaceShell>
  );
}

export function DemoWorkspace() {
  return (
    <div className="learn demo-page">
      <header>
        <Link className="learn-brand" to="/">
          <CurveMark />
          curve
        </Link>
        <span className="pill lavender">INTERACTIVE SAMPLE</span>
        <Link className="learn-button dark" to="/auth?mode=signup">
          Make it yours <ArrowRight size={16} />
        </Link>
      </header>
      <h1>A little room to find your flow.</h1>
      <p>
        Explore the tabs and course cards. Sample data illustrates the
        workspace; your account starts fresh.
      </p>
      <ProductPreview />
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        Back to Curve
      </Link>
    </div>
  );
}

export function WorkspaceSettings() {
  const { user, fullName, signOut } = useAuth();
  return (
    <WorkspaceShell>
      <div className="workspace-heading">
        <h1>Your space, your account.</h1>
      </div>
      <section className="learn-panel settings-panel">
        <h2>{fullName || "Your account"}</h2>
        <p>{user?.email}</p>
        <p>
          Your uploaded material is private. Delete any item and its sessions
          from the material’s edit dialog.
        </p>
        <div className="modal-actions">
          <Link className="learn-button subtle" to="/onboarding">
            Study preferences
          </Link>
          <Link className="learn-button subtle" to="/subscription">
            Your plan
          </Link>
          <Link className="learn-button subtle" to="/privacy">
            Privacy
          </Link>
          <Link className="learn-button subtle" to="/terms">
            Terms
          </Link>
          <button className="learn-button dark" onClick={() => void signOut()}>
            Sign out <LogOut size={16} />
          </button>
        </div>
      </section>
    </WorkspaceShell>
  );
}
