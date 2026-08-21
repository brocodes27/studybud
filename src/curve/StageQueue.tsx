import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Grid3x3, Loader2, Shuffle } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { labelFor } from '../lib/perirO';
import type { DayPlan, PlannedAction } from '../lib/studyPlanner';
import { trackPrescribed } from '../lib/stageTelemetry';
import { fetchStageSnapshot, localToday } from './stageData';
import { CurveButton, Eyebrow, Panel } from './ui';

/**
 * Today's queue (PRD v2 §7.1).
 *
 * At most three actions plus one interleaved set, drawn from every subject the
 * student is carrying. The cap is the feature: a student with six courses and
 * thirty live topics does not need a list, they need to know the next three
 * things and why those three.
 *
 * Every card names its stage and says why now. A prescription without a reason
 * is just a chore, and a chore is what gets skipped.
 */
export function StageQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetchStageSnapshot(user.id, localToday())
      .then((snapshot) => {
        if (cancelled) return;
        setPlan(snapshot.plan);
        trackPrescribed(snapshot.plan.actions, snapshot.plan.interleave !== null);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (loading) {
    return (
      <Panel className="mt-4 flex items-center gap-2 text-sm text-curve-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Working out what today needs
      </Panel>
    );
  }

  if (!plan) return null;

  const nothingToDo = plan.actions.length === 0 && plan.interleave === null;

  return (
    <Panel className="mt-4">
      <div className="flex items-center justify-between gap-4">
        <Eyebrow>Today</Eyebrow>
        {plan.totalMinutes > 0 ? (
          <span className="text-xs text-curve-faint">about {plan.totalMinutes} minutes</span>
        ) : null}
      </div>

      {nothingToDo ? (
        <div className="mt-3">
          <p className="text-sm text-curve-muted">
            Nothing is due and nothing is waiting on a stage. That is the system working, not a gap
            to fill — rest counts.
          </p>
          <CurveButton ghost className="mt-4 !px-4 !py-2 !text-sm" onClick={() => navigate('/map')}>
            <Grid3x3 className="h-4 w-4" strokeWidth={2.2} />
            See where everything stands
          </CurveButton>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {plan.actions.map((action) => (
            <li key={`${action.topicId}-${action.action}`}>
              <ActionCard
                action={action}
                onStart={() =>
                  navigate(
                    `/stage/${action.enrollmentId}/${action.topicId}?action=${action.action}`,
                  )
                }
              />
            </li>
          ))}

          {plan.interleave ? (
            <li>
              <InterleaveCard
                subjects={plan.interleave.subjects}
                why={plan.interleave.why}
                minutes={plan.interleave.minutes}
              />
            </li>
          ) : null}
        </ul>
      )}
    </Panel>
  );
}

function ActionCard({ action, onStart }: { action: PlannedAction; onStart: () => void }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="group flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 px-4 py-3 text-left transition hover:border-white/25 hover:bg-white/[0.03]"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-curve-violet-soft">
          {labelFor(action.action)} · {action.subject}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-white">{action.title}</p>
        <p className="mt-0.5 text-xs text-curve-muted">{action.why}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-xs text-curve-faint">{action.minutes} min</span>
        <ArrowRight
          className="h-4 w-4 text-curve-faint transition group-hover:text-white"
          strokeWidth={2.2}
        />
      </div>
    </button>
  );
}

/**
 * The interleaved set is deliberately not startable yet — item selection lands
 * with P2.5. Showing it now, greyed and explained, is honest about what the
 * plan wants; a button that does nothing would not be.
 */
function InterleaveCard({
  subjects,
  why,
  minutes,
}: {
  subjects: string[];
  why: string;
  minutes: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-white/10 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <Shuffle className="mt-0.5 h-4 w-4 shrink-0 text-curve-mint" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-curve-mint">
            Interleave · {subjects.join(' + ')}
          </p>
          <p className="mt-0.5 text-sm text-curve-muted">{why}</p>
          <p className="mt-0.5 text-xs text-curve-faint">Mixed sets arrive in the next release.</p>
        </div>
      </div>
      <span className="shrink-0 text-xs text-curve-faint">{minutes} min</span>
    </div>
  );
}

export default StageQueue;
