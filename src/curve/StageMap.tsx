import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import {
  STAGE_ORDER,
  daysBetween,
  labelFor,
  nextAction,
  stageRank,
  type Stage,
} from '../lib/perirO';
import type { PlannerTopic } from '../lib/studyPlanner';
import { fetchStageSnapshot, localToday } from './stageData';
import { countByStage, groupBySubject, matchesFilter, type MapFilter } from './stageMapView';
import { Chip, ChipRow, CurveButton, CurveShell, Display, Eyebrow, Panel } from './ui';
import './curve.css';

/**
 * The stage map (PRD v2 §7.2) — the one screen that answers "where does
 * everything stand?" across a whole course load.
 *
 * A student carrying six subjects has thirty-plus live topics, each at a
 * different stage. No other study tool can show that, because no other tool
 * knows what a stage is. This screen is the product's signature and the thing
 * worth screenshotting.
 */

const FILTERS: Array<{ id: MapFilter; label: string }> = [
  { id: 'week', label: 'This week' },
  { id: 'all', label: 'Everything' },
  { id: 'attention', label: 'Needs attention' },
];

/** Human label per stage, used in text as well as in the bar's accessible name. */
const STAGE_LABEL: Record<Stage, string> = {
  new: 'Not started',
  primed: 'Primed',
  encoded: 'Encoded',
  referenced: 'Referenced',
  retrieved: 'Retrieved',
  interleaved: 'Interleaved',
  overlearned: 'Overlearned',
};

export function StageMap() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [topics, setTopics] = useState<PlannerTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<MapFilter>('week');

  const today = localToday();

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetchStageSnapshot(user.id, today)
      .then((snapshot) => !cancelled && setTopics(snapshot.topics))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [user?.id, today]);

  const visible = useMemo(
    () => topics.filter((topic) => matchesFilter(topic, filter, today)),
    [topics, filter, today],
  );

  const bySubject = useMemo(() => groupBySubject(visible), [visible]);
  const totals = useMemo(() => countByStage(topics), [topics]);

  return (
    <CurveShell>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-curve-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to today
      </button>

      <Display lead="Every topic,">every subject.</Display>

      {topics.length > 0 ? (
        <p className="mt-3 text-sm text-curve-muted">
          {totals.started} of {topics.length} topics started ·{' '}
          {totals.tested} tested closed-book · {totals.mixed} survived mixed testing
        </p>
      ) : null}

      <div className="mt-6">
        <ChipRow>
          {FILTERS.map((option) => (
            <Chip
              key={option.id}
              active={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </Chip>
          ))}
        </ChipRow>
      </div>

      {loading ? (
        <Panel className="mt-6 flex items-center gap-2 text-sm text-curve-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your map
        </Panel>
      ) : topics.length === 0 ? (
        <Panel className="mt-6">
          <p className="font-semibold">No topics yet</p>
          <p className="mt-1 text-sm text-curve-muted">
            Add a syllabus and every topic on it lands here, ready to be worked through.
          </p>
          <CurveButton className="mt-4" onClick={() => navigate('/add-course')}>
            Add a course
          </CurveButton>
        </Panel>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-curve-muted">
          Nothing matches this filter.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {bySubject.map(([subject, subjectTopics]) => (
            <SubjectRow
              key={subject}
              subject={subject}
              topics={subjectTopics}
              today={today}
              onOpen={(topic) => navigate(`/stage/${topic.enrollmentId}/${topic.topicId}`)}
            />
          ))}
        </div>
      )}
    </CurveShell>
  );
}

function SubjectRow({
  subject,
  topics,
  today,
  onOpen,
}: {
  subject: string;
  topics: PlannerTopic[];
  today: string;
  onOpen: (topic: PlannerTopic) => void;
}) {
  return (
    <Panel>
      <div className="flex items-baseline justify-between gap-4">
        <Eyebrow>{subject}</Eyebrow>
        <span className="text-xs text-curve-faint">{topics.length} topics</span>
      </div>

      {/* Wide content scrolls inside its own container so the page body never
          scrolls sideways on a phone. */}
      <div className="mt-3 overflow-x-auto">
        <ul className="min-w-[22rem] space-y-1">
          {topics.map((topic) => (
            <li key={topic.topicId}>
              <TopicRow topic={topic} today={today} onOpen={() => onOpen(topic)} />
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function TopicRow({
  topic,
  today,
  onOpen,
}: {
  topic: PlannerTopic;
  today: string;
  onOpen: () => void;
}) {
  const needed = nextAction({
    state: topic.stage,
    today,
    daysToExam: topic.examOn ? Math.max(0, daysBetween(today, topic.examOn)) : null,
    competitiveMode: topic.competitiveMode,
  });

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-4 rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.04]"
    >
      <StageBar stage={topic.stage.stage} remedial={topic.stage.remedial} title={topic.title} />
      <span className="min-w-0 flex-1 truncate text-sm text-white">{topic.title}</span>
      <span className="shrink-0 text-xs text-curve-faint">
        {topic.stage.remedial
          ? 'Needs rebuilding'
          : needed
            ? labelFor(needed)
            : STAGE_LABEL[topic.stage.stage]}
      </span>
    </button>
  );
}

/**
 * Six segments, filled up to the stage cleared.
 *
 * Stage is never carried by colour alone: filled segments are also taller and
 * the whole bar has a text label naming the stage, so the map reads for
 * colour-blind students and in a screenshot with the colour crushed out.
 */
function StageBar({
  stage,
  remedial,
  title,
}: {
  stage: Stage;
  remedial: boolean;
  title: string;
}) {
  const cleared = stageRank(stage);
  const label = remedial
    ? `${title}: ${STAGE_LABEL[stage]}, needs rebuilding`
    : `${title}: ${STAGE_LABEL[stage]}`;

  return (
    <span className="flex shrink-0 items-end gap-[3px]" role="img" aria-label={label}>
      {STAGE_ORDER.slice(1).map((step, index) => {
        const done = index < cleared;
        return (
          <span
            key={step}
            aria-hidden="true"
            className={
              done
                ? `h-3.5 w-1.5 rounded-sm ${remedial ? 'bg-curve-risk' : 'bg-curve-violet-soft'}`
                : 'h-2 w-1.5 rounded-sm bg-white/12'
            }
          />
        );
      })}
    </span>
  );
}

export default StageMap;
