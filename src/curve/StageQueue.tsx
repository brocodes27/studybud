import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Clock3,
  Grid3x3,
  Loader2,
  Plus,
  RotateCcw,
  Shuffle,
  Sparkles,
} from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import type { StageAction } from "../lib/perirO";
import type { DayPlan, PlannedAction } from "../lib/studyPlanner";
import { trackPrescribed } from "../lib/stageTelemetry";
import { fetchStageSnapshot, localToday } from "./stageData";
import "./stage-flow.css";

export const STUDENT_STAGE_LABEL: Record<StageAction, string> = {
  prime: "Get ready",
  encode: "Make sense of it",
  reference: "Save the essentials",
  retrieve: "Recall without notes",
  interleave: "Mix it up",
  overlearn: "Build exam fluency",
};

/** A bounded daily plan, backed by topic evidence rather than dashboard activity. */
export function StageQueue({
  hideWhenEmpty = false,
}: {
  hideWhenEmpty?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [hasTopics, setHasTopics] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    if (!user?.id) {
      setLoading(false);
      return;
    }
    fetchStageSnapshot(user.id, localToday())
      .then((snapshot) => {
        if (cancelled) return;
        if ("error" in snapshot && snapshot.error)
          throw new Error(String(snapshot.error));
        setPlan(snapshot.plan);
        setHasTopics(snapshot.topics.length > 0);
        trackPrescribed(
          snapshot.plan.actions,
          snapshot.plan.interleave !== null,
        );
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "Your study plan could not load.",
          );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user?.id, attempt]);

  const nothingDue = plan?.actions.length === 0;
  const availableMinutes =
    plan?.actions.reduce((sum, action) => sum + action.minutes, 0) ?? 0;

  if (hideWhenEmpty && !loading && !error && !hasTopics) return null;

  return (
    <section className="stage-queue" aria-labelledby="daily-plan-heading">
      <div className="stage-queue-heading">
        <div>
          <p className="stage-kicker">
            <Sparkles size={14} aria-hidden="true" /> A little focus, every day
          </p>
          <h2 id="daily-plan-heading">Your next steps</h2>
        </div>
        {!loading && !error && hasTopics ? (
          <button
            type="button"
            className="stage-text-button"
            onClick={() => navigate("/map")}
          >
            Topic map <Grid3x3 size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {loading ? (
        <p className="stage-queue-message" role="status">
          <Loader2 size={17} className="animate-spin" /> Finding the right place
          to start…
        </p>
      ) : error ? (
        <div className="stage-empty" role="alert">
          <h3>Let’s try that again</h3>
          <p>{error}</p>
          <button
            type="button"
            className="stage-secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RotateCcw size={15} /> Retry study plan
          </button>
        </div>
      ) : !hasTopics ? (
        <div className="stage-empty">
          <span className="stage-empty-icon">
            <Plus size={22} aria-hidden="true" />
          </span>
          <h3>Your materials. A clearer way forward.</h3>
          <p>
            Add a course and syllabus. Review your topics, then we’ll help you
            choose what to study first.
          </p>
          <button
            type="button"
            className="stage-primary"
            onClick={() => navigate("/add-course")}
          >
            Add your first course <ArrowRight size={16} />
          </button>
        </div>
      ) : nothingDue ? (
        <div className="stage-empty">
          <h3>You have room to breathe.</h3>
          <p>
            No individual topic sessions are due right now. Explore your map to
            see what you’ve covered and what comes next.
          </p>
          <button
            type="button"
            className="stage-secondary"
            onClick={() => navigate("/map")}
          >
            Explore your topics <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <>
          <p className="stage-plan-caption">
            <Clock3 size={14} aria-hidden="true" /> About {availableMinutes}{" "}
            minutes · A small plan across your courses
          </p>
          <ol className="stage-action-list">
            {plan?.actions.map((action, index) => (
              <li key={`${action.topicId}-${action.action}`}>
                <ActionCard
                  action={action}
                  index={index}
                  onStart={() =>
                    navigate(
                      `/stage/${action.enrollmentId}/${action.topicId}?action=${action.action}`,
                    )
                  }
                />
              </li>
            ))}
          </ol>
        </>
      )}
      {!loading && !error && plan?.interleave ? (
        <div className="stage-coming-next">
          <Shuffle size={17} aria-hidden="true" />
          <div>
            <strong>Mix it up · {plan.interleave.subjects.join(" + ")}</strong>
            <p>{plan.interleave.why}</p>
            <span>
              Mixed practice is coming soon · planned for{" "}
              {plan.interleave.minutes} min
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ActionCard({
  action,
  index,
  onStart,
}: {
  action: PlannedAction;
  index: number;
  onStart: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onStart}
      className={`stage-action-card ${index === 0 ? "stage-action-first" : ""}`}
    >
      <span className="stage-action-index" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="stage-action-copy">
        <span className="stage-action-meta">
          {action.subject} <span>·</span> {STUDENT_STAGE_LABEL[action.action]}
        </span>
        <strong>{action.title}</strong>
        <span className="stage-action-reason">{action.why}</span>
        <span className="stage-action-mobile-time">{action.minutes} min</span>
      </span>
      <span className="stage-action-go">
        <span>{action.minutes} min</span>
        <span className="stage-action-arrow">
          <ArrowRight size={18} aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

export default StageQueue;
