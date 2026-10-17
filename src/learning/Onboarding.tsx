import { passPrice } from '../../supabase/functions/_shared/curve-billing';
import { LearningPageFrame } from './LearningPageFrame';
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Check, ShieldCheck } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { usePayment, type CurvePlan } from "../hooks/usePayment";
import "./learning.css";

import { StudyPreferencesContext, type StudyPreferences } from './StudyPreferences';
export { useStudyPreferences, type StudyPreferences } from './StudyPreferences';

const FreeStudyPreview = lazy(() => import('./agent/FreeStudyPreview').then(m => ({ default: m.FreeStudyPreview })));
const GuidedSemesterSetup = lazy(() => import('./agent/GuidedSemesterSetup').then(m => ({ default: m.GuidedSemesterSetup })));

const empty: StudyPreferences = {
  goal: "exam",
  courses: [],
  exam_date: "",
  daily_minutes: 20,
  completed: false,
};
export function SetupFrame({ children, step, demo = false }: {
  children: ReactNode;
  step: number;
  demo?: boolean;
  immersive?: boolean;
}) {
  return <LearningPageFrame label={step === 3 ? "Choose your access" : "Set up your semester"} demo={demo}>
    {children}
  </LearningPageFrame>;
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
  return (
    <Suspense fallback={<div className="learn loading-state" role="status">Loading study setup…</div>}>
      <GuidedSemesterSetup initial={initial} onSave={onSave} demo={demo} />
    </Suspense>
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
        <span className="eyebrow">CONTINUE YOUR STUDY PLAN</span>
        <h2>
          {paid
            ? "Your workspace is unlocked."
            : "Continue beyond Day 1."}
        </h2>
        <p className="setup-intro">
          {paid
            ? "Your paid access is confirmed. Your courses and study setup are ready."
            : "Your plan and Day 1 are free. Unlock Day 2 onward, dynamic assessments, and more uploads for all your subjects."}
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
                    price: passPrice.monthly / 100,
                    days: 30,
                    detail: "For your next exam or a focused month.",
                  },
                  {
                    id: "semester",
                    name: "Semester pass",
                    price: passPrice.semester / 100,
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
                  "Day 2 onward of your personal study plan",
                  "Dynamic assessments that adapt to your progress",
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
                Includes up to 250 AI requests per rolling 24 hours. Saved
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
              Your study plan and Day 1 are free. Unlock Day 2+ and dynamic assessments.
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
          navigate("/");
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
  if (!state.paid) return (
    <Suspense fallback={<div className="learn loading-state" role="status">Loading your study preview…</div>}>
      <FreeStudyPreview preferences={state.preferences} />
    </Suspense>
  );
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
