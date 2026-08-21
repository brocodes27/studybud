import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageSquare, Plus, Share2, Trash2 } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import {
  addScore,
  createForecastReceipt,
  deleteScore,
  fetchCourseSnapshot,
  setTermStart,
  type CourseSnapshot,
} from './data';
import { DEFAULT_SCALE, requiredFractionForTarget, round } from './gradeEngine';
import {
  Banner,
  CurveButton,
  CurveShell,
  Eyebrow,
  Field,
  Panel,
  Select,
  TextInput,
} from './ui';

const TARGETS = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'];

export function CourseDetail() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [snapshot, setSnapshot] = useState<CourseSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState('A-');

  const [componentId, setComponentId] = useState('');
  const [label, setLabel] = useState('');
  const [earned, setEarned] = useState('');
  const [possible, setPossible] = useState('100');
  const [saving, setSaving] = useState(false);
  const [termStartDraft, setTermStartDraft] = useState('');
  const [savingTermStart, setSavingTermStart] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id || !enrollmentId) return;
    try {
      const result = await fetchCourseSnapshot(user.id, enrollmentId);
      setSnapshot(result);
      if (result && !componentId && result.components.length > 0) {
        setComponentId(result.components[0]!.id);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this course.');
    } finally {
      setLoading(false);
    }
    // componentId is intentionally omitted: it seeds once and must not retrigger loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, enrollmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const requirement = useMemo(() => {
    if (!snapshot) return null;
    const band = DEFAULT_SCALE.bands.find((entry) => entry.letter === target);
    if (!band) return null;
    return requiredFractionForTarget(snapshot.components, snapshot.scores, band.min);
  }, [snapshot, target]);

  async function handleSaveTermStart() {
    if (!snapshot || !termStartDraft) return;
    setSavingTermStart(true);
    const ok = await setTermStart(snapshot.course.id, termStartDraft);
    setSavingTermStart(false);
    if (ok) await load();
    else setError('Could not save when this course started.');
  }

  async function handleAddScore() {
    if (!snapshot || !componentId) return;
    const earnedValue = Number(earned);
    const possibleValue = Number(possible);

    if (!Number.isFinite(earnedValue) || !Number.isFinite(possibleValue) || possibleValue <= 0) {
      setError('Enter the points you earned and the points the assignment was out of.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await addScore({
        enrollmentId: snapshot.enrollmentId,
        componentId,
        label: label || null,
        pointsEarned: earnedValue,
        pointsPossible: possibleValue,
      });
      setLabel('');
      setEarned('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that score.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(scoreId: string) {
    try {
      await deleteScore(scoreId);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove that score.');
    }
  }

  const [sharing, setSharing] = useState(false);
  const [sharedUrl, setSharedUrl] = useState<string | null>(null);

  async function handleShare() {
    if (!user?.id || !snapshot) return;
    setSharing(true);
    setError(null);
    try {
      const slug = await createForecastReceipt(user.id, snapshot);
      const url = `${window.location.origin}/m/${slug}`;
      setSharedUrl(url);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Clipboard can be denied; the visible link still lets the user copy.
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not publish the forecast card.');
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <CurveShell>
        <div className="flex items-center gap-3 py-20 text-curve-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading the course…</span>
        </div>
      </CurveShell>
    );
  }

  if (!snapshot) {
    return (
      <CurveShell>
        <Banner tone="error">This course could not be found.</Banner>
        <div className="mt-4">
          <CurveButton onClick={() => navigate('/')}>Back to courses</CurveButton>
        </div>
      </CurveShell>
    );
  }

  const { projection, standing, course } = snapshot;

  return (
    <CurveShell>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-curve-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to courses
      </button>

      <Eyebrow>
        {course.courseCode}
        {course.instructorName ? ` · ${course.instructorName}` : ''} · {course.term}
      </Eyebrow>
      <h1 className="curve-display mt-2 !text-[clamp(1.8rem,4.5vw,2.8rem)]">{course.title}</h1>

      {error ? (
        <div className="mt-6">
          <Banner tone="error">{error}</Banner>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel>
          <Eyebrow>Projected final</Eyebrow>
          <p className="curve-figure mt-1 text-5xl">{projection.letter}</p>
          <p className="mt-2 text-sm text-curve-muted">
            {round(projection.percent, 1)}%
            {projection.lowLetter === projection.highLetter
              ? ' · fully graded'
              : ` · likely ${projection.lowLetter} to ${projection.highLetter}`}
          </p>
          <p className="mt-1 text-xs text-curve-faint">{projection.confidence} confidence</p>
        </Panel>

        <Panel>
          <Eyebrow>Where you stand now</Eyebrow>
          <p className="curve-figure mt-1 text-5xl">
            {standing.percent === null ? '—' : `${round(standing.percent, 1)}%`}
          </p>
          <p className="mt-2 text-sm text-curve-muted">
            {standing.percent === null
              ? 'Nothing graded yet'
              : `${standing.letter} across graded work`}
          </p>
          <p className="mt-1 text-xs text-curve-faint">
            {round(standing.gradedWeight, 0)}% of the grade decided
          </p>
        </Panel>

        <Panel>
          <Eyebrow>What you need</Eyebrow>
          <div className="mt-2">
            <Select value={target} onChange={(event) => setTarget(event.target.value)}>
              {TARGETS.map((option) => (
                <option key={option} value={option}>
                  Target {option}
                </option>
              ))}
            </Select>
          </div>
          <p className="mt-3 text-sm text-curve-muted">
            {!requirement ? null : requirement.alreadySecured ? (
              <span className="font-semibold text-curve-good">
                Already locked in. Remaining work cannot drop you below {target}.
              </span>
            ) : !requirement.reachable ? (
              <span className="font-semibold text-curve-bad">
                Not reachable. You would need {round(requirement.required * 100, 1)}% on everything
                left.
              </span>
            ) : (
              <>
                Average{' '}
                <span className="font-semibold text-white">
                  {round(requirement.required * 100, 1)}%
                </span>{' '}
                across the remaining {round(standing.ungradedWeight, 0)}% of the grade.
              </>
            )}
          </p>
        </Panel>
      </div>

      {standing.weightSumWarning ? (
        <div className="mt-4">
          <Banner tone="warn">{standing.weightSumWarning}</Banner>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <CurveButton onClick={() => navigate(`/session/${snapshot.enrollmentId}`)}>
          <MessageSquare className="h-4 w-4" strokeWidth={2.4} />
          Study this with the coach
        </CurveButton>
        <CurveButton onClick={handleShare} disabled={sharing} ghost>
          {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Share forecast card
        </CurveButton>
      </div>

      {sharedUrl ? (
        <div className="mt-3">
          <Banner tone="info">
            Forecast card published. Anyone with this link can view it: {sharedUrl}
          </Banner>
        </div>
      ) : null}

      {snapshot.course.termStartOn === null ? (
        <Panel className="mt-6 border-curve-risk/40">
          <Eyebrow>When did this course start?</Eyebrow>
          <p className="mt-2 text-sm text-curve-muted">
            Lecture dates come from week 1 plus each topic's week number. Without this date we
            cannot tell you to prime a topic before its lecture — the one stage that has to happen
            at a particular time.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Field label="First day of classes">
                <TextInput
                  type="date"
                  value={termStartDraft}
                  onChange={(event) => setTermStartDraft(event.target.value)}
                />
              </Field>
            </div>
            <CurveButton onClick={() => void handleSaveTermStart()} disabled={!termStartDraft || savingTermStart}>
              {savingTermStart ? 'Saving' : 'Save'}
            </CurveButton>
          </div>
        </Panel>
      ) : null}

      <Panel className="mt-6">
        <Eyebrow>Grading breakdown</Eyebrow>
        <div className="mt-4 space-y-2">
          {standing.components.map((component) => (
            <div
              key={component.componentId}
              className="curve-inset flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{component.name}</p>
                <p className="text-xs text-curve-faint">
                  {round(component.weight, 1)}% of grade
                  {component.droppedCount > 0 ? ` · drops ${component.droppedCount} lowest` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="curve-figure text-lg">
                  {component.gradedCount === 0 ? '—' : `${round(component.fraction * 100, 1)}%`}
                </p>
                <p className="text-xs text-curve-faint">
                  {component.gradedCount === 0
                    ? 'not graded'
                    : `${component.gradedCount} score${component.gradedCount === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="mt-4">
        <Eyebrow>Add a returned score</Eyebrow>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
          <div className="sm:col-span-4">
            <Field label="Category">
              <Select value={componentId} onChange={(event) => setComponentId(event.target.value)}>
                {snapshot.components.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Label">
              <TextInput
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Problem set 4"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Earned">
              <TextInput
                type="number"
                min="0"
                value={earned}
                onChange={(event) => setEarned(event.target.value)}
                placeholder="87"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Out of">
              <TextInput
                type="number"
                min="1"
                value={possible}
                onChange={(event) => setPossible(event.target.value)}
              />
            </Field>
          </div>
          <div className="sm:col-span-1">
            <CurveButton onClick={handleAddScore} disabled={saving} className="w-full !px-3">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </CurveButton>
          </div>
        </div>

        {snapshot.scoreRows.length > 0 ? (
          <div className="mt-5 space-y-2">
            {snapshot.scoreRows.map((score) => {
              const component = snapshot.components.find((entry) => entry.id === score.componentId);
              return (
                <div
                  key={score.id}
                  className="flex items-center justify-between gap-3 border-b border-white/5 px-1 py-2 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{score.label || component?.name || 'Score'}</span>
                    <span className="ml-2 text-xs text-curve-faint">{component?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="curve-figure">
                      {round((score.pointsEarned / score.pointsPossible) * 100, 1)}%
                    </span>
                    <span className="text-xs text-curve-faint">
                      {score.pointsEarned}/{score.pointsPossible}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove score"
                      onClick={() => handleDelete(score.id)}
                      className="text-curve-faint transition hover:text-curve-bad"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 text-sm text-curve-faint">
            No scores yet. Add the first one and the projection sharpens immediately.
          </p>
        )}
      </Panel>
    </CurveShell>
  );
}

export default CourseDetail;
