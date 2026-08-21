import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Lock, Plus, X } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { STAGE_EVENTS, trackStage } from '../lib/stageTelemetry';
import {
  STAGE_MINUTES,
  labelFor,
  nextAction,
  type StageAction,
  type TopicStage,
} from '../lib/perirO';
import type { PlannerTopic } from '../lib/studyPlanner';
import {
  fetchStageSnapshot,
  localToday,
  recordStageCompletion,
  recordStageOutcome,
} from './stageData';
import {
  gradeEncoding,
  probeEncoding,
  type EncodingArtifactKind,
  type EncodingRubric,
} from './ai';
import {
  Banner,
  CurveButton,
  CurveShell,
  Eyebrow,
  Field,
  Panel,
  Select,
  TextArea,
  TextInput,
} from './ui';
import { StudySession } from './StudySession';

/**
 * The session shell for all six PERIR-O stages (PRD v2 §4).
 *
 * The shell owns everything the stages share: loading the topic, checking that
 * the requested stage is the one this topic actually needs, timing, telemetry,
 * and writing the result. Each stage body only has to run its own activity and
 * hand back what it proved.
 *
 * A blocked stage is never a dead end. The student is told the rule in one
 * sentence, offered the correct stage in one tap, and can still override — and
 * that override is logged, because a rising override rate means a threshold is
 * wrong, not that students are.
 */

const VALID_ACTIONS: StageAction[] = [
  'prime',
  'encode',
  'reference',
  'retrieve',
  'interleave',
  'overlearn',
];

interface SessionContext {
  topic: PlannerTopic;
  prescribed: StageAction | null;
  /** Every topic the student carries — Encoding links across subjects. */
  allTopics: PlannerTopic[];
}

export function StageSession() {
  const { enrollmentId, topicId } = useParams<{ enrollmentId: string; topicId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const requested = searchParams.get('action') as StageAction | null;
  const overridden = searchParams.get('override') === '1';

  const [context, setContext] = useState<SessionContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const today = localToday();

  useEffect(() => {
    if (!user?.id || !topicId) return;
    let cancelled = false;

    fetchStageSnapshot(user.id, today)
      .then((snapshot) => {
        if (cancelled) return;
        const topic = snapshot.topics.find((candidate) => candidate.topicId === topicId) ?? null;
        if (!topic) {
          setError('That topic is not on any of your current syllabi.');
          return;
        }
        const planned = snapshot.plan.actions.find((action) => action.topicId === topicId);
        setContext({ topic, prescribed: planned?.action ?? null, allTopics: snapshot.topics });
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Could not load this topic.'),
      )
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [user?.id, topicId, today]);

  const needed = useMemo(() => {
    if (!context) return null;
    return nextAction({
      state: context.topic.stage,
      today,
      daysToExam: daysToExam(today, context.topic.examOn),
      competitiveMode: context.topic.competitiveMode,
    });
  }, [context, today]);

  const action: StageAction | null =
    requested && VALID_ACTIONS.includes(requested) ? requested : needed;

  const blocked = needed !== null && action !== null && action !== needed && !overridden;

  useEffect(() => {
    if (!context || !action) return;
    trackStage(blocked ? STAGE_EVENTS.gateBlocked : STAGE_EVENTS.started, {
      action,
      topic_id: topicId,
      stage: context.topic.stage.stage,
      needed,
      was_prescribed: context.prescribed === action,
      overridden,
    });
  }, [context, action, blocked, needed, overridden, topicId]);

  if (loading) {
    return (
      <Frame onBack={() => navigate('/')}>
        <Panel className="mt-6 flex items-center gap-2 text-sm text-curve-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading this topic
        </Panel>
      </Frame>
    );
  }

  if (error || !context || !action) {
    return (
      <Frame onBack={() => navigate('/')}>
        <div className="mt-6">
          <Banner tone="error">{error ?? 'Nothing to do on this topic right now.'}</Banner>
        </div>
      </Frame>
    );
  }

  return (
    <Frame onBack={() => navigate(`/course/${enrollmentId}`)}>
      <Eyebrow>
        {labelFor(action)} · {context.topic.subject}
      </Eyebrow>
      <h1 className="curve-display mt-2 !text-[clamp(1.6rem,4vw,2.4rem)]">{context.topic.title}</h1>

      {blocked ? (
        <GateBlocked
          requested={action}
          needed={needed!}
          topic={context.topic}
          onTakeCorrect={() => setSearchParams({ action: needed! })}
          onOverride={() => {
            if (user?.id && topicId && enrollmentId) {
              void recordStageOutcome(
                {
                  userId: user.id,
                  enrollmentId,
                  topicId,
                  action,
                  wasPrescribed: false,
                },
                'overridden',
                { needed },
              );
            }
            setSearchParams({ action, override: '1' });
          }}
        />
      ) : (
        <StageBody
          action={action}
          topic={context.topic}
          allTopics={context.allTopics}
          enrollmentId={enrollmentId!}
          topicId={topicId!}
          userId={user!.id}
          wasPrescribed={context.prescribed === action}
          today={today}
          onDone={() => navigate('/')}
        />
      )}
    </Frame>
  );
}

function Frame({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <CurveShell>
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-curve-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      {children}
    </CurveShell>
  );
}

/** Why a stage is locked, what to do instead, and the way past it anyway. */
function GateBlocked({
  requested,
  needed,
  topic,
  onTakeCorrect,
  onOverride,
}: {
  requested: StageAction;
  needed: StageAction;
  topic: PlannerTopic;
  onTakeCorrect: () => void;
  onOverride: () => void;
}) {
  return (
    <Panel className="mt-6">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-curve-risk" />
        <div>
          <p className="text-sm font-semibold text-white">{reasonFor(requested, topic.stage)}</p>
          <p className="mt-2 text-sm text-curve-muted">
            {labelFor(needed)} is what this topic needs next — about {STAGE_MINUTES[needed]} minutes.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <CurveButton onClick={onTakeCorrect}>{labelFor(needed)} instead</CurveButton>
        <button
          type="button"
          onClick={onOverride}
          className="text-xs text-curve-faint underline underline-offset-4 transition hover:text-curve-muted"
        >
          Do it anyway
        </button>
      </div>
    </Panel>
  );
}

function reasonFor(requested: StageAction, stage: TopicStage): string {
  if (requested === 'overlearn') {
    return 'Overlearning is a polish stage. Clear interleaving first — drilling something that has not survived mixed testing builds speed on a shaky foundation.';
  }
  if (stage.remedial) {
    return 'This topic has faded. It needs rebuilding before it is worth testing again.';
  }
  return `This topic is at ${stage.stage}, so ${labelFor(requested).toLowerCase()} would skip a step. Skipped stages are where study time leaks.`;
}

interface BodyProps {
  action: StageAction;
  topic: PlannerTopic;
  allTopics: PlannerTopic[];
  enrollmentId: string;
  topicId: string;
  userId: string;
  wasPrescribed: boolean;
  today: string;
  onDone: () => void;
}

function StageBody(props: BodyProps) {
  if (props.action === 'prime') return <PrimingBody {...props} />;
  if (props.action === 'encode') return <EncodingBody {...props} />;
  // Reference through Overlearning land in Phase 2. Until then the topic opens
  // in the existing coach session rather than a dead end.
  return <StudySession />;
}

/* ---------------------------------------------------------------- priming -- */

interface PrimerContent {
  summary: string;
  listenFor: string[];
  terms: string[];
  prereqCheck: string;
  connectsTo: string;
}

/**
 * Priming: about six minutes before the lecture (PRD v2 §4.1).
 *
 * The gate is the questions, not the reading. A student who reads a primer and
 * closes it has done nothing — priming works because it loads a set of open
 * questions the lecture then answers. So the primer's suggestions are only
 * starting points: they are editable, removable, and the student can add their
 * own.
 */
function PrimingBody({ topic, enrollmentId, topicId, userId, wasPrescribed, today, onDone }: BodyProps) {
  const [primer, setPrimer] = useState<PrimerContent | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;

    supabase.functions
      .invoke('generate-primer', { body: { topic_id: topicId } })
      .then(({ data, error: invokeError }) => {
        if (cancelled) return;
        if (invokeError || !data?.content) {
          setError('Could not build a primer for this topic. You can still write your own questions.');
          return;
        }
        setPrimer(data.content as PrimerContent);
        setQuestions((data.content as PrimerContent).listenFor.slice(0, 3));
        trackStage(
          data.fallback ? STAGE_EVENTS.primerFallbackUsed : STAGE_EVENTS.primerCacheHit,
          { topic_id: topicId, cached: Boolean(data.cached) },
        );
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [topicId]);

  const enough = questions.filter((question) => question.trim().length > 0).length >= 3;

  async function finish() {
    setSaving(true);
    const kept = questions.map((question) => question.trim()).filter(Boolean);

    const result = await recordStageCompletion({
      userId,
      enrollmentId,
      topicId,
      action: 'prime',
      evidence: { primingQuestions: kept.length },
      wasPrescribed,
      durationSec: Math.round((Date.now() - startedAt.current) / 1000),
      payload: { questions: kept, usedFallback: primer === null },
      examOn: topic.examOn,
      today,
    });

    setSaving(false);
    if (result.advanced) onDone();
    else setError(result.reason || 'Could not save this session.');
  }

  return (
    <>
      <p className="mt-2 text-sm text-curve-muted">
        {lectureLine(topic, today)} · about {STAGE_MINUTES.prime} minutes
      </p>

      {loading ? (
        <Panel className="mt-6 flex items-center gap-2 text-sm text-curve-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Building your primer
        </Panel>
      ) : null}

      {error ? (
        <div className="mt-6">
          <Banner tone="warn">{error}</Banner>
        </div>
      ) : null}

      {primer ? (
        <Panel className="mt-6">
          <p className="text-sm leading-relaxed text-white">{primer.summary}</p>

          <p className="mt-5 curve-label">Terms you will hear</p>
          <ul className="mt-2 space-y-1">
            {primer.terms.map((term) => (
              <li key={term} className="text-sm text-curve-muted">
                {term}
              </li>
            ))}
          </ul>

          <p className="mt-5 curve-label">Before you go in</p>
          <p className="mt-2 text-sm text-curve-muted">{primer.prereqCheck}</p>
          <p className="mt-2 text-sm text-curve-faint">{primer.connectsTo}</p>
        </Panel>
      ) : null}

      {!loading ? (
        <Panel className="mt-4">
          <p className="curve-label">What you want this lecture to answer</p>
          <p className="mt-1 text-xs text-curve-faint">
            Keep at least three. Edit them into your own words — questions you actually care about
            are the ones you will notice getting answered.
          </p>

          <ul className="mt-4 space-y-2">
            {questions.map((question, index) => (
              <li key={index} className="flex items-center gap-2">
                <TextInput
                  value={question}
                  onChange={(event) =>
                    setQuestions((current) =>
                      current.map((item, i) => (i === index ? event.target.value : item)),
                    )
                  }
                  aria-label={`Question ${index + 1}`}
                />
                <button
                  type="button"
                  aria-label={`Remove question ${index + 1}`}
                  onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))}
                  className="curve-orb curve-orb-light curve-orb-static shrink-0"
                >
                  <X className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center gap-2">
            <TextInput
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && draft.trim()) {
                  event.preventDefault();
                  setQuestions((current) => [...current, draft.trim()]);
                  setDraft('');
                }
              }}
              placeholder="Add your own question"
              aria-label="Add your own question"
            />
            <button
              type="button"
              aria-label="Add question"
              disabled={!draft.trim()}
              onClick={() => {
                setQuestions((current) => [...current, draft.trim()]);
                setDraft('');
              }}
              className="curve-orb curve-orb-light curve-orb-static shrink-0 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <CurveButton onClick={() => void finish()} disabled={!enough || saving}>
              {saving ? 'Saving' : 'Primed and ready'}
              {!saving ? <Check className="ml-2 inline h-4 w-4" /> : null}
            </CurveButton>
            {!enough ? (
              <span className="text-xs text-curve-faint">
                {3 - questions.filter((q) => q.trim()).length} more question(s) to go
              </span>
            ) : null}
          </div>
        </Panel>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------- encoding -- */

const ARTIFACT_KINDS: Array<{ kind: EncodingArtifactKind; label: string; prompt: string }> = [
  {
    kind: 'explanation',
    label: 'Explain it',
    prompt: 'Explain this from scratch to someone who has never seen it. No notes open.',
  },
  {
    kind: 'analogy',
    label: 'Find an analogy',
    prompt: 'Map this onto something from everyday life — part for part, not just a vibe.',
  },
  {
    kind: 'simplification',
    label: 'Simplify it',
    prompt: 'Compress it to the smallest version that still works. What cannot be dropped?',
  },
  {
    kind: 'concept_link',
    label: 'Link it',
    prompt: 'Connect it to something you already learned, and say what the connection buys you.',
  },
];

const MIN_ARTIFACT_CHARS = 120;

/**
 * Encoding: the stage where information actually moves into long-term memory
 * (PRD v2 §4.2), and the one students skip most often because highlighting and
 * re-reading feel like the same work.
 *
 * The gate is a produced artifact scored by rubric. There is no "mark as done"
 * button, because a stage that can be cleared by clicking is not a stage.
 */
function EncodingBody({
  topic,
  allTopics,
  enrollmentId,
  topicId,
  userId,
  wasPrescribed,
  today,
  onDone,
}: BodyProps) {
  const [kind, setKind] = useState<EncodingArtifactKind>('explanation');
  const [artifact, setArtifact] = useState('');
  const [linkedTopicId, setLinkedTopicId] = useState('');
  const [probe, setProbe] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);
  const [rubric, setRubric] = useState<EncodingRubric | null>(null);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  // Anything except this topic itself. Cross-subject links are the point, so
  // the list is not filtered down to the current course.
  const linkable = useMemo(
    () => allTopics.filter((candidate) => candidate.topicId !== topicId),
    [allTopics, topicId],
  );
  const linked = linkable.find((candidate) => candidate.topicId === linkedTopicId) ?? null;

  const context = {
    courseCode: topic.subject,
    topic: topic.title,
    kind,
    linkedTopic: linked?.title ?? null,
    linkedSubject: linked?.subject ?? null,
  };

  const longEnough = artifact.trim().length >= MIN_ARTIFACT_CHARS;
  const linkReady = kind !== 'concept_link' || linked !== null;

  async function runProbe() {
    setProbing(true);
    setError(null);
    try {
      setProbe(await probeEncoding(context, artifact.trim()));
    } catch {
      setError('Could not reach the tutor. You can still submit this for scoring.');
    } finally {
      setProbing(false);
    }
  }

  async function submit() {
    setScoring(true);
    setError(null);
    try {
      const scored = await gradeEncoding(context, artifact.trim());
      setRubric(scored);

      const result = await recordStageCompletion({
        userId,
        enrollmentId,
        topicId,
        action: 'encode',
        evidence: { rubricScore: scored.score },
        wasPrescribed,
        durationSec: Math.round((Date.now() - startedAt.current) / 1000),
        payload: {
          kind,
          artifact: artifact.trim(),
          linkedTopicId: linked?.topicId ?? null,
          crossSubject: linked ? linked.subject !== topic.subject : false,
          rubric: scored,
          probe,
        },
        examOn: topic.examOn,
        today,
      });

      // The artifact is stored either way — a revision should build on the last
      // attempt, not start from a blank box.
      if (result.advanced) setTimeout(onDone, 1600);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not score that.');
    } finally {
      setScoring(false);
    }
  }

  const brief = ARTIFACT_KINDS.find((option) => option.kind === kind)!;
  const passed = rubric !== null && rubric.score >= 3;

  return (
    <>
      <p className="mt-2 text-sm text-curve-muted">
        Covered in class, not yet processed · about {STAGE_MINUTES.encode} minutes
      </p>

      <Panel className="mt-6">
        <p className="curve-label">Pick how you want to process it</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ARTIFACT_KINDS.map((option) => (
            <button
              key={option.kind}
              type="button"
              onClick={() => {
                setKind(option.kind);
                setRubric(null);
                setProbe(null);
              }}
              aria-pressed={kind === option.kind}
              className="curve-chip"
            >
              {option.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm text-white">{brief.prompt}</p>

        {kind === 'concept_link' ? (
          <div className="mt-4">
            <Field label="Link it to" hint="Reaching into another subject is harder — and it holds better.">
              <Select
                value={linkedTopicId}
                onChange={(event) => setLinkedTopicId(event.target.value)}
              >
                <option value="">Pick a topic</option>
                {linkable.map((candidate) => (
                  <option key={candidate.topicId} value={candidate.topicId}>
                    {candidate.subject} · {candidate.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}

        <div className="mt-4">
          <TextArea
            value={artifact}
            onChange={(event) => setArtifact(event.target.value)}
            rows={9}
            placeholder="In your own words. Close your notes first — copying them out is the thing this stage exists to replace."
            aria-label="Your encoding"
          />
          <p className="mt-1 text-xs text-curve-faint">
            {longEnough
              ? `${artifact.trim().length} characters`
              : `${MIN_ARTIFACT_CHARS - artifact.trim().length} more characters before this can be scored`}
          </p>
        </div>

        {probe ? (
          <div className="mt-4 curve-bubble curve-bubble-coach">{probe}</div>
        ) : null}

        {error ? (
          <div className="mt-4">
            <Banner tone="warn">{error}</Banner>
          </div>
        ) : null}

        {rubric ? <RubricCard rubric={rubric} passed={passed} /> : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <CurveButton onClick={() => void submit()} disabled={!longEnough || !linkReady || scoring}>
            {scoring ? 'Scoring' : rubric ? 'Score the revision' : 'Submit for scoring'}
          </CurveButton>
          <CurveButton ghost onClick={() => void runProbe()} disabled={!longEnough || probing}>
            {probing ? 'Thinking' : 'Poke a hole in it'}
          </CurveButton>
        </div>
      </Panel>
    </>
  );
}

function RubricCard({ rubric, passed }: { rubric: EncodingRubric; passed: boolean }) {
  const dimensions: Array<[string, number]> = [
    ['Organized', rubric.organize],
    ['Simplified', rubric.simplify],
    ['Connected', rubric.connect],
    ['Analogized', rubric.analogize],
  ];

  return (
    <div className="mt-5 rounded-xl border border-white/10 p-4">
      <div className="flex items-center gap-2">
        {passed ? (
          <Check className="h-4 w-4 text-curve-good" />
        ) : (
          <X className="h-4 w-4 text-curve-risk" />
        )}
        <p className="text-sm font-semibold text-white">
          {rubric.score.toFixed(1)} / 5 — {passed ? 'encoded' : 'not there yet'}
        </p>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
        {dimensions.map(([label, value]) => (
          <li key={label} className="flex items-center justify-between text-xs text-curve-muted">
            <span>{label}</span>
            <span aria-label={`${label}: ${value} out of 5`}>{value.toFixed(1)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm text-curve-muted">{rubric.feedback}</p>
      {!passed ? (
        <p className="mt-2 text-xs text-curve-faint">
          Weakest right now: {rubric.weakest}. Revise above and score it again.
        </p>
      ) : null}
    </div>
  );
}

function lectureLine(topic: PlannerTopic, today: string): string {
  if (!topic.lectureOn) return 'Not covered in class yet';
  const days = Math.round(
    (Date.parse(`${topic.lectureOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (days < 0) return 'Already covered in class';
  if (days === 0) return 'Lecture is today';
  return days === 1 ? 'Lecture is tomorrow' : `Lecture in ${days} days`;
}

function daysToExam(today: string, examOn: string | null): number | null {
  if (!examOn) return null;
  const days = Math.round(
    (Date.parse(`${examOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  return days < 0 ? null : days;
}

export default StageSession;
