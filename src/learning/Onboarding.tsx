import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { usePayment, type CurvePlan } from "../hooks/usePayment";
import { CurveMark } from "./Preview";
import "./learning.css";

export type StudyPreferences = {
  goal: string;
  courses: string[];
  exam_date: string;
  daily_minutes: number;
  completed: boolean;
};
const StudyPreferencesContext = createContext<StudyPreferences | null>(null);
export const useStudyPreferences = () => useContext(StudyPreferencesContext);

const empty: StudyPreferences = {
  goal: "exam",
  courses: [],
  exam_date: "",
  daily_minutes: 20,
  completed: false,
};
const goals = [
  {
    id: "exam",
    title: "Feel ready for my exams",
    detail: "Practice the topics that need more attention.",
    icon: Target,
  },
  {
    id: "understand",
    title: "Understand difficult concepts",
    detail: "Break ideas down, then check what sticks.",
    icon: Sparkles,
  },
  {
    id: "routine",
    title: "Build a study routine",
    detail: "Make steady progress between classes.",
    icon: Clock3,
  },
];
export function SetupFrame({
  children,
  step,
  demo = false,
}: {
  children: ReactNode;
  step: number;
  demo?: boolean;
}) {
  const { signOut } = useAuth();
  return (
    <div className="learn setup-page">
      <header className="setup-header">
        <Link className="learn-brand" to="/welcome">
          <CurveMark />
          curve
        </Link>
        <span>
          {demo
            ? "Interactive preview · nothing is saved"
            : "A little setup. A clearer direction."}
        </span>
        {demo ? (
          <Link to="/welcome">Exit preview</Link>
        ) : (
          <button onClick={() => void signOut()}>Sign out</button>
        )}
      </header>
      <main className="setup-layout">
        <aside className="setup-aside">
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h1>
            A study space.
            <br />
            Built around <em>you.</em>
          </h1>
          <p>
            Your courses, your goals, your pace. Let’s make room for the way you
            learn.
          </p>
          <ol className="setup-steps">
            {["Your focus", "Your courses", "Your rhythm", "Your plan"].map(
              (s, i) => (
                <li
                  key={s}
                  aria-current={step === i ? "step" : undefined}
                  className={i === step ? "current" : i < step ? "done" : ""}
                >
                  <span>{i < step ? <Check size={15} /> : `0${i + 1}`}</span>
                  <div>
                    {s}
                    <small>
                      {
                        [
                          "Start with what matters",
                          "Bring any subject",
                          "Keep it manageable",
                          "Unlock your workspace",
                        ][i]
                      }
                    </small>
                  </div>
                </li>
              ),
            )}
          </ol>
          <div className="setup-note">
            <BookOpen size={20} />
            <p>
              No fixed subject list.
              <br />
              <strong>Your materials set the curriculum.</strong>
            </p>
          </div>
        </aside>
        <section className="setup-content">{children}</section>
      </main>
      <footer className="setup-footer">
        <span>Small steps. Real understanding.</span>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
      </footer>
    </div>
  );
}

export function OnboardingForm({
  initial = empty,
  onSave,
  demo = false,
}: {
  initial?: StudyPreferences;
  onSave: (value: StudyPreferences) => Promise<void>;
  demo?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [step, setStep] = useState(0);
  const [course, setCourse] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus();
  }, [step]);
  function addCourse() {
    const name = course.trim();
    if (!name) return;
    if (value.courses.some((c) => c.toLowerCase() === name.toLowerCase())) {
      setError("That course is already on your list.");
      return;
    }
    if (value.courses.length >= 12) {
      setError(
        "Start with up to 12 courses. You can upload other subjects in your library later.",
      );
      return;
    }
    setValue({ ...value, courses: [...value.courses, name] });
    setCourse("");
    setError("");
  }
  async function next(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (step === 1 && course.trim()) {
      addCourse();
      return;
    }
    if (step === 1 && !value.courses.length) {
      setError("Add at least one course to continue.");
      return;
    }
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      await onSave({ ...value, completed: true });
    } catch {
      setError(
        "We couldn’t save your setup. Your answers are still here. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <SetupFrame step={step} demo={demo}>
      <form onSubmit={next} className="setup-card">
        <span className="eyebrow">STEP {step + 1} OF 4 · ABOUT A MINUTE</span>
        <h2 ref={title} tabIndex={-1}>
          {
            [
              "What brings you to Curve?",
              "What are you learning?",
              "Find your everyday pace.",
            ][step]
          }
        </h2>
        <p className="setup-intro">
          {
            [
              "Choose your main focus. You can change it anytime.",
              "Name your courses in your own words. Add your materials once your workspace is unlocked.",
              "Choose a daily target you can come back to. This is a goal, not a notification schedule.",
            ][step]
          }
        </p>
        {step === 0 && (
          <fieldset className="setup-options">
            <legend className="sr-only">Main study goal</legend>
            {goals.map((g) => (
              <label
                key={g.id}
                className={value.goal === g.id ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="goal"
                  value={g.id}
                  checked={value.goal === g.id}
                  onChange={() => setValue({ ...value, goal: g.id })}
                />
                <g.icon size={23} />
                <span>
                  <strong>{g.title}</strong>
                  <small>{g.detail}</small>
                </span>
                <span className="setup-radio" />
              </label>
            ))}
          </fieldset>
        )}
        {step === 1 && (
          <div className="setup-fields">
            <label htmlFor="setup-course">Course name</label>
            <div className="setup-add">
              <input
                id="setup-course"
                maxLength={80}
                placeholder="e.g. Organic chemistry, History of art…"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCourse();
                  }
                }}
              />
              <button
                type="button"
                className="learn-button dark"
                onClick={addCourse}
              >
                Add
              </button>
            </div>
            <div className="setup-course-list">
              {value.courses.map((c, i) => (
                <span key={c} className={`setup-course tone-${i % 3}`}>
                  <BookOpen size={16} />
                  {c}
                  <button
                    type="button"
                    aria-label={`Remove ${c}`}
                    onClick={() =>
                      setValue({
                        ...value,
                        courses: value.courses.filter((x) => x !== c),
                      })
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <small>
              {value.courses.length
                ? `${value.courses.length} course${value.courses.length === 1 ? "" : "s"} in your study plan`
                : "Any subject belongs here. Start with one or add a few."}
            </small>
            <label htmlFor="setup-exam">
              Next exam <span>Optional</span>
            </label>
            <input
              id="setup-exam"
              type="date"
              value={value.exam_date}
              min={new Date().toLocaleDateString("en-CA")}
              onChange={(e) =>
                setValue({ ...value, exam_date: e.target.value })
              }
            />
            <small>
              A reminder of your next milestone. Set dates for individual
              materials in your library.
            </small>
          </div>
        )}
        {step === 2 && (
          <>
            <fieldset className="setup-rhythm">
              <legend className="sr-only">Daily study target</legend>
              {[10, 20, 30, 45].map((n) => (
                <label
                  key={n}
                  className={value.daily_minutes === n ? "selected" : ""}
                >
                  <input
                    type="radio"
                    name="minutes"
                    checked={value.daily_minutes === n}
                    onChange={() => setValue({ ...value, daily_minutes: n })}
                  />
                  <strong>
                    {n}
                    <small>min / day</small>
                  </strong>
                  <span>
                    {n === 10
                      ? "A small start"
                      : n === 20
                        ? "Steady progress"
                        : n === 30
                          ? "More focus"
                          : "A deeper dive"}
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="setup-summary">
              <span className="eyebrow">YOUR STARTING POINT</span>
              <h3>{goals.find((g) => g.id === value.goal)?.title}</h3>
              <p>{value.courses.join(" · ")}</p>
              <p>
                <Clock3 size={16} /> {value.daily_minutes} minutes a day
                {value.exam_date ? ` · Next exam: ${value.exam_date}` : ""}
              </p>
              <small>
                Next, choose a paid plan to unlock your private library and
                practice sessions.
              </small>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="setup-error">
            {error}
          </p>
        )}
        <div className="setup-actions">
          {step > 0 && (
            <button
              type="button"
              className="learn-button subtle"
              disabled={busy}
              onClick={() => {
                setError("");
                setStep(step - 1);
              }}
            >
              <ArrowLeft size={16} />
              Back
            </button>
          )}
          <button className="learn-button dark" disabled={busy}>
            {busy
              ? "Saving your setup…"
              : step === 2
                ? "Save & choose a plan"
                : "Continue"}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </SetupFrame>
  );
}

export function PlanSelection({
  preferences,
  paid = false,
  onCheck,
  checking = false,
  demo = false,
  onEdit,
}: {
  preferences?: StudyPreferences;
  onEdit?: () => void;
  paid?: boolean;
  onCheck?: () => Promise<void>;
  checking?: boolean;
  demo?: boolean;
}) {
  const [plan, setPlan] = useState<CurvePlan>("semester");
  const [error, setError] = useState("");
  const { createPayment, isLoadingPayment } = usePayment();
  const returned = new URLSearchParams(useLocation().search).has("checkout");
  const [waiting, setWaiting] = useState(returned);
  useEffect(() => {
    if (!returned || paid || !onCheck) return;
    let count = 0;
    const timer = window.setInterval(() => {
      if (++count >= 12) {
        clearInterval(timer);
        setWaiting(false);
      }
      void onCheck();
    }, 5000);
    return () => clearInterval(timer);
  }, [returned, paid, onCheck]);
  async function checkout() {
    setError("");
    if (demo) {
      setError(
        "Preview only. Create an account to choose a plan and continue to secure checkout.",
      );
      return;
    }
    try {
      window.location.assign(await createPayment(plan));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Checkout is unavailable. Please try again.",
      );
    }
  }
  return (
    <SetupFrame step={3} demo={demo}>
      <div className="setup-card plans-card">
        <span className="eyebrow">STEP 4 OF 4 · YOUR PLAN</span>
        <h2>
          {paid
            ? "Your workspace is unlocked."
            : "Give your learning a little room."}
        </h2>
        <p className="setup-intro">
          {paid
            ? "Your paid access is confirmed. Your courses and study setup are ready."
            : "One plan. All your subjects. Choose how long you want to study with Curve."}
        </p>
        {paid ? (
          <div className="setup-summary">
            <ShieldCheck size={32} />
            <h3>You’re ready to begin.</h3>
            <Link className="learn-button dark" to="/">
              Open my workspace <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <>
            <fieldset className="plan-options">
              <legend className="sr-only">Choose your access plan</legend>
              {(
                [
                  {
                    id: "monthly",
                    name: "Monthly pass",
                    price: "12.99",
                    days: 30,
                    detail: "For your next exam or a focused month.",
                  },
                  {
                    id: "semester",
                    name: "Semester pass",
                    price: "39",
                    days: 120,
                    detail: "Stay with it through the semester.",
                  },
                ] as const
              ).map((p) => (
                <label key={p.id} className={plan === p.id ? "selected" : ""}>
                  <input
                    type="radio"
                    name="plan"
                    checked={plan === p.id}
                    onChange={() => setPlan(p.id)}
                  />
                  <div className="plan-name">
                    <strong>{p.name}</strong>
                    {p.id === "semester" && <span>Best value</span>}
                  </div>
                  <div className="plan-price">
                    ${p.price}
                    <small>USD / {p.days} days</small>
                  </div>
                  <p>{p.detail}</p>
                  <small>One payment · no automatic renewal</small>
                  <span className="plan-selected">
                    <Check size={14} />{" "}
                    {plan === p.id ? "Selected" : "Select plan"}
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="plan-includes">
              <h3>Everything you need to get into it</h3>
              <ul>
                {[
                  "Your own courses and private material library",
                  "Practice questions grounded in your notes",
                  "Hints, feedback, and source excerpts",
                  "Independent checks and topic progress",
                ].map((f) => (
                  <li key={f}>
                    <Check size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <p>
                Includes up to 30 AI requests per rolling 24 hours. Saved
                sessions remain available during your pass.
              </p>
            </div>
            {preferences && (
              <div className="plan-personal">
                <BookOpen size={19} />
                <span>
                  {demo ? "Your sample setup" : "Your setup is saved"}
                  <strong>
                    {preferences.courses.length} course
                    {preferences.courses.length === 1 ? "" : "s"} ·{" "}
                    {preferences.daily_minutes} minutes a day
                  </strong>
                </span>
                {demo ? (
                  <button className="plan-check" onClick={onEdit}>
                    Edit
                  </button>
                ) : (
                  <Link to="/onboarding">Edit</Link>
                )}
              </div>
            )}
            {returned && (
              <div role="status" className="setup-summary">
                <strong>
                  {waiting
                    ? "Checking your payment…"
                    : "Payment is not confirmed yet."}
                </strong>
                <p>
                  Your workspace opens after payment confirmation. If you
                  completed checkout, check again in a moment. You don’t need to
                  pay twice.
                </p>
              </div>
            )}
            {error && (
              <p role="alert" className="setup-error">
                {error}
              </p>
            )}
            <button
              className="learn-button dark plan-checkout"
              disabled={isLoadingPayment || checking || waiting}
              onClick={() => void checkout()}
            >
              {isLoadingPayment
                ? "Opening secure checkout…"
                : `Continue with ${plan === "semester" ? "Semester" : "Monthly"} pass`}
              <ArrowRight size={17} />
            </button>
            <p className="plan-fine">
              <ShieldCheck size={15} />
              Secure payment with Dodo · applicable taxes shown at checkout
            </p>
            {onCheck && (
              <button
                className="plan-check"
                disabled={checking}
                onClick={() => void onCheck()}
              >
                {checking
                  ? "Checking access…"
                  : "Already paid? Check my access"}
              </button>
            )}
            <p className="plan-fine">
              Paid access is required to enter your workspace.
            </p>
          </>
        )}
      </div>
    </SetupFrame>
  );
}

export function LearningEntry({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<{
    preferences: StudyPreferences | null;
    paid: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const mounted = useRef(true);
  async function load() {
    setChecking(true);
    try {
      const [prefs, access] = await Promise.all([
        supabase
          .from("curve_study_preferences")
          .select("*")
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase.rpc("curve_has_paid_access"),
      ]);
      if (prefs.error || access.error)
        throw new Error("Unable to load your account");
      if (mounted.current) {
        setState({
          preferences: prefs.data
            ? { ...prefs.data, exam_date: prefs.data.exam_date || "" }
            : null,
          paid: access.data === true,
        });
        setError("");
      }
    } catch {
      if (mounted.current) {
        setState(null);
        setError("We couldn’t check your account. Please retry.");
      }
    } finally {
      if (mounted.current) setChecking(false);
    }
  }
  const loadRef = useRef(load);
  loadRef.current = load;
  // A stable callback keeps checkout polling bounded across account refreshes.
  const check = useRef(() => loadRef.current()).current;
  useEffect(() => {
    mounted.current = true;
    void check();
    const refresh = () => void check();
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      mounted.current = false;
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, [user?.id, check]);
  if (!state)
    return (
      <div className="learn loading-state" role="status">
        <p>{error || "Preparing your study space…"}</p>
        {error && (
          <>
            <button className="learn-button dark" onClick={() => void check()}>
              Try again
            </button>
            <button
              className="learn-button subtle"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </>
        )}
      </div>
    );
  if (pathname === "/onboarding")
    return (
      <OnboardingForm
        initial={state.preferences || empty}
        onSave={async (value) => {
          const { error } = await supabase
            .from("curve_study_preferences")
            .upsert({
              ...value,
              exam_date: value.exam_date || null,
              user_id: user!.id,
            });
          if (error) throw error;
          setState({ ...state, preferences: value });
          navigate("/subscription");
        }}
      />
    );
  if (!state.preferences?.completed)
    return <Navigate to="/onboarding" replace />;
  if (pathname === "/subscription" || pathname === "/pricing")
    return (
      <PlanSelection
        preferences={state.preferences}
        paid={state.paid}
        onCheck={check}
        checking={checking}
      />
    );
  if (!state.paid) return <Navigate to="/subscription" replace />;
  return (
    <StudyPreferencesContext.Provider value={state.preferences}>
      {children}
    </StudyPreferencesContext.Provider>
  );
}

export function OnboardingDemo() {
  const [preferences, setPreferences] = useState<StudyPreferences | null>(null);
  const [editing, setEditing] = useState(false);
  return preferences && !editing ? (
    <>
      <PlanSelection
        demo
        preferences={preferences}
        onEdit={() => setEditing(true)}
      />
      <button
        className="setup-demo-reset learn-button subtle"
        onClick={() => setPreferences(null)}
      >
        Restart preview
      </button>
    </>
  ) : (
    <OnboardingForm
      demo
      initial={preferences || empty}
      onSave={async (value) => {
        setPreferences(value);
        setEditing(false);
        window.scrollTo(0, 0);
      }}
    />
  );
}
