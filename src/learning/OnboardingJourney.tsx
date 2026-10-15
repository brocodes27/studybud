import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { SetupFrame, type StudyPreferences } from "./Onboarding";
import {
  cleanOnboardingAnswers,
  courseNames,
  onboardingInsight,
  onboardingQuestions,
  type OnboardingAnswers,
} from "../../supabase/functions/_shared/onboarding-profile";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import "./onboarding-glass.css";

gsap.registerPlugin(useGSAP);

function WrittenTitle({ text }: { text: string }) {
  return (
    <>
      {text.split(" ").map((word, index) => (
        <span className="written-word" key={index}>
          {Array.from(word).map((letter, i) => (
            <span className="written-letter" key={i}>
              {letter}
            </span>
          ))}{" "}
        </span>
      ))}
    </>
  );
}

export function OnboardingJourney({
  initial,
  onSave,
  demo = false,
}: {
  initial: StudyPreferences;
  onSave: (value: StudyPreferences) => Promise<void>;
  demo?: boolean;
}) {
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => ({
    ...(initial.completed
      ? {
          goal: initial.goal,
          courses: initial.courses.join(", "),
          daily_minutes: String(initial.daily_minutes),
        }
      : {}),
    ...cleanOnboardingAnswers(initial.onboarding_answers),
  }));
  const [step, setStep] = useState(0);
  const [welcome, setWelcome] = useState(!initial.completed);
  const [transitioning, setTransitioning] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const entering = useRef<gsap.core.Timeline>();
  const leaving = useRef(false);
  const [checkpoint, setCheckpoint] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const question = onboardingQuestions[step];
  const count = step + 1;
  const insight = checkpoint ? onboardingInsight(answers, count) : null;
  const heading = welcome ? "hello." : insight?.title || question.title;
  const { contextSafe } = useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const letters = container.current!.querySelectorAll(".written-letter");
        const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
        entering.current = timeline;
        timeline
          .fromTo(
            ".journey-eyebrow",
            { opacity: 0, y: 5 },
            { opacity: 1, y: 0, duration: 0.8 },
            0.1,
          )
          .fromTo(
            letters,
            {
              opacity: 0,
              filter: "blur(14px)",
              y: welcome ? 18 : 9,
              rotate: welcome ? 5 : 0,
            },
            {
              opacity: 1,
              filter: "blur(0px)",
              y: 0,
              rotate: 0,
              duration: welcome ? 1.15 : 0.75,
              stagger: welcome
                ? 0.17
                : { amount: Math.min(1.15, letters.length * 0.025) },
            },
            0.18,
          )
          .fromTo(
            ".journey-description",
            { autoAlpha: 0, y: 8, filter: "blur(5px)" },
            { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.75 },
            welcome ? 1.1 : 0.85,
          )
          .fromTo(
            ".journey-answer-stage",
            { autoAlpha: 0, y: 12, filter: "blur(8px)" },
            { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.8 },
            welcome ? 1.65 : 1.15,
          )
          .fromTo(
            ".journey-actions, .journey-footnote",
            { autoAlpha: 0, y: 6 },
            { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.08 },
            welcome ? 1.8 : 1.45,
          );
      });
      title.current?.focus({ preventScroll: true });
      return () => {
        mm.revert();
        entering.current = undefined;
      };
    },
    {
      scope: container,
      dependencies: [step, checkpoint, welcome],
      revertOnUpdate: true,
    },
  );
  const changeScene = contextSafe((change: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    setTransitioning(true);
    entering.current?.progress(1);
    const finish = () => {
      change();
      leaving.current = false;
      setTransitioning(false);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    gsap.to(".journey-form", {
      opacity: 0,
      filter: "blur(12px)",
      y: -8,
      duration: 0.28,
      ease: "power2.in",
      onComplete: () => {
        gsap.set(".journey-form", { clearProps: "opacity,filter,transform" });
        finish();
      },
    });
  });
  async function advance(event: FormEvent) {
    event.preventDefault();
    if (busy || leaving.current) return;
    if (welcome) {
      changeScene(() => setWelcome(false));
      return;
    }
    setError("");
    if (checkpoint) {
      if (count < onboardingQuestions.length) {
        changeScene(() => {
          setStep(step + 1);
          setCheckpoint(false);
        });
        return;
      }
      setBusy(true);
      try {
        await onSave({
          ...initial,
          goal: answers.goal,
          courses: courseNames(answers.courses),
          daily_minutes: Number(answers.daily_minutes),
          completed: true,
          onboarding_answers: cleanOnboardingAnswers(answers),
        });
      } catch {
        setError(
          "We couldn’t save your setup. Your answers are still here. Please try again.",
        );
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!answers[question.id]?.trim()) {
      setError(
        question.options
          ? "Choose the answer that feels closest to you."
          : "Add a few words to continue.",
      );
      return;
    }
    if (question.id === "courses") {
      const courses = courseNames(answers.courses);
      if (
        !courses.length ||
        courses.length > 12 ||
        courses.some((c) => c.length > 80)
      ) {
        setError(
          "Add 1–12 courses, each up to 80 characters, separated by commas.",
        );
        return;
      }
    }
    changeScene(() => {
      if (count % 3 === 0 || count === onboardingQuestions.length)
        setCheckpoint(true);
      else setStep(step + 1);
    });
  }
  function back() {
    setError("");
    changeScene(() => {
      if (checkpoint) setCheckpoint(false);
      else if (step > 0) setStep(step - 1);
      else setWelcome(true);
    });
  }
  return (
    <SetupFrame step={Math.min(2, Math.floor(step / 7))} demo={demo} immersive>
      <div
        ref={container}
        className={`glass-journey ${welcome ? "is-welcome" : ""}`}
      >
        <form
          onSubmit={advance}
          className={`journey-form ${checkpoint ? "is-insight" : ""}`}
          aria-busy={busy || transitioning}
        >
          <div
            key={`${step}-${checkpoint}-${welcome}`}
            className="journey-reveal"
          >
            <span className="journey-eyebrow">
              {welcome
                ? "A space to become yourself"
                : checkpoint
                  ? "A little more understood"
                  : `Your ${step < 3 ? "direction" : step < 6 ? "everyday rhythm" : step < 9 ? "attention" : step < 12 ? "way of understanding" : step < 15 ? "support system" : "next chapter"}`}
            </span>
            <h1
              ref={title}
              tabIndex={-1}
              aria-label={heading}
              className={welcome ? "journey-hello" : ""}
            >
              <span aria-hidden="true">
                <WrittenTitle text={heading} />
              </span>
            </h1>
            <p className="journey-description">
              {welcome
                ? "A quieter mind. A clearer direction. A study space that starts with you."
                : insight?.learned || question.detail}
            </p>
            <div className="journey-answer-stage">
              {welcome ? (
                <p className="journey-welcome-note">
                  20 little questions. One very personal beginning.
                </p>
              ) : insight ? (
                <section
                  className="journey-insight glass-surface"
                  aria-label="What Curve learned"
                >
                  <div className="insight-heading">
                    <Sparkles size={18} />
                    <span>Curve learned this about you</span>
                    <Check size={16} />
                  </div>
                  <div className="insight-number">{insight.metric}</div>
                  <p className="insight-label">{insight.label}</p>
                  <div className="insight-logic">
                    <span>Here’s how we’ll work with it</span>
                    <p>{insight.logic}</p>
                  </div>
                  <small>
                    A starting hypothesis from your answers. We’ll refine it
                    together.
                  </small>
                </section>
              ) : question.options ? (
                <fieldset className="journey-choices">
                  <legend className="sr-only">{question.title}</legend>
                  {question.options.map(([id, label], index) => (
                    <label
                      key={id}
                      className={`glass-surface journey-choice ${answers[question.id] === id ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={id}
                        checked={answers[question.id] === id}
                        onChange={() => {
                          setAnswers((a) => ({ ...a, [question.id]: id }));
                          setError("");
                        }}
                      />
                      <span className="choice-index">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{label}</span>
                      <span className="choice-check">
                        {answers[question.id] === id && <Check size={15} />}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <div className="journey-text-halo">
                  <label htmlFor="journey-answer" className="sr-only">
                    {question.title}
                  </label>
                  <textarea
                    id="journey-answer"
                    className="glass-surface"
                    value={answers[question.id] || ""}
                    maxLength={question.id === "courses" ? 970 : 600}
                    placeholder={question.placeholder}
                    rows={4}
                    onChange={(event) => {
                      setAnswers((a) => ({
                        ...a,
                        [question.id]: event.target.value,
                      }));
                      setError("");
                    }}
                    aria-describedby="journey-text-hint"
                  />
                  <span id="journey-text-hint">
                    {question.id === "courses"
                      ? "Separate courses with a comma"
                      : "Your words. Your starting point."}
                    <span>
                      {(answers[question.id] || "").length} /{" "}
                      {question.id === "courses" ? 970 : 600}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
          {error && (
            <p className="journey-error" role="alert">
              {error}
            </p>
          )}
          <div className="journey-actions">
            <button
              type="button"
              className="journey-back"
              onClick={back}
              disabled={busy || transitioning || welcome}
              aria-label="Previous question"
            >
              <ArrowLeft size={19} />
              <span>Back</span>
            </button>
            <button
              type="submit"
              className="journey-continue glass-surface"
              disabled={busy || transitioning}
            >
              {busy
                ? "Saving your starting profile…"
                : welcome
                  ? "Let’s begin"
                  : checkpoint
                    ? count === 20
                      ? "Save & build my study plan"
                      : "That sounds like me"
                    : "Continue"}
              <ArrowRight size={18} />
            </button>
          </div>
          <p className="journey-footnote">
            {welcome
              ? "Made for the way you think."
              : checkpoint
                ? count === 20
                  ? "Your answers are saved when you continue. Paid access unlocks your workspace."
                  : "You can go back and change any answer."
                : "No right answers. Just a better starting point."}
          </p>
        </form>
        {!welcome && (
          <div className="journey-position">
            <span>
              {checkpoint ? "A moment of clarity" : "Getting to know you"}
            </span>
            <div
              className="journey-progress"
              role="progressbar"
              aria-label="Onboarding progress"
              aria-valuemin={0}
              aria-valuemax={onboardingQuestions.length}
              aria-valuenow={checkpoint ? count : step}
            >
              {onboardingQuestions.map((q, i) => (
                <span
                  key={q.id}
                  className={
                    i < step || (checkpoint && i === step)
                      ? "complete"
                      : i === step
                        ? "active"
                        : ""
                  }
                />
              ))}
            </div>
            <span>
              {String(count).padStart(2, "0")}{" "}
              <span className="journey-divider">
                / {onboardingQuestions.length}
              </span>
            </span>
          </div>
        )}
      </div>
    </SetupFrame>
  );
}
