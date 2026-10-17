import { InteractiveAnswer } from './InteractiveAnswer';
import type { InteractiveUI } from '../../../supabase/functions/_shared/interactive-ui';
import { sessionEvidence } from './dailyFocus';
import { useEffect, useState, FormEvent } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flag,
  Lightbulb,
  Loader2,
  LogOut,
  Play,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMaterial, learningAction } from '../api';
import {
  independentAccuracy,
  weeklyActivity,
  restoreSessionAnswers,
  type Material,
  type StudySession,
} from '../model';
import type {
  Citation,
  StudyPlan,
} from './contracts';
import { MaterialEditor } from '../Workspace';
import { SessionExitDialog } from '../SessionExitDialog';
import './material-journey.css';

export function StudyPlanBanner({
  plan,
  onStepClick,
}: {
  plan: StudyPlan;
  onStepClick: (step: StudyPlan['steps'][0]) => void;
}) {
  return (
    <section className="agent-plan-banner" aria-label="Current Study Plan">
      <div className="plan-summary">
        <Clock size={16} className="plan-icon" />
        <strong>{plan.minutes} min session plan</strong>
        <span className="plan-steps-count">{plan.steps.length} steps</span>
      </div>
      <div className="plan-steps-scroll">
        {plan.steps.map((step, idx) => (
          <button
            key={idx}
            className={`plan-step-pill ${step.kind}`}
            onClick={() => onStepClick(step)}
            title={`Start ${step.kind} on ${step.topic}`}
          >
            <span className="step-num">{idx + 1}</span>
            <span className="step-topic">{step.topic}</span>
            <span className="step-kind-badge">{step.kind}</span>
            <span className="step-time">{step.minutes}m</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function MaterialView({
  materialId,
  initialPage = 1,
  onStartPractice,
  onSaved,
}: {
  materialId: string;
  initialPage?: number;
  onSaved?: () => void;
  onStartPractice: (material: Material, topic: string) => void;
}) {
  const { user } = useAuth();
  const [material, setMaterial] = useState<Material | null>(null);
  const [pageIndex, setPageIndex] = useState<number>(Math.max(1, initialPage));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [focusTopic, setFocusTopic] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setShowEditor(false);
    setFocusTopic('');
    fetchMaterial(materialId, user.id)
      .then((m) => {
        if (cancelled) return;
        setMaterial(m);
        setError(null);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load material.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [materialId, user]);

  useEffect(() => {
    if (initialPage) setPageIndex(initialPage);
  }, [initialPage]);

  if (loading) {
    return (
      <div className="agent-view-loading">
        <Loader2 size={24} className="spin" />
        <p>Loading course notes…</p>
      </div>
    );
  }

  if (error || !material) {
    return (
      <div className="agent-view-error">
        <p>{error || 'Material unavailable.'}</p>
      </div>
    );
  }

  const pages = material.metadata.pages || [];
  const currentPage = pages.find((p) => p.page === pageIndex) || pages[0];
  const topics = material.metadata.topics || [];
  const currentIndex = currentPage ? pages.indexOf(currentPage) : 0;
  const selectedTopic = topics.includes(focusTopic) ? focusTopic : topics[0] || '';

  return (
    <div className="agent-material-view material-journey-reader">
      <header className="material-view-header">
        <div>
          <h2>{material.title}</h2>
          {material.metadata.course && (
            <span className="pill lavender">{material.metadata.course}</span>
          )}
        </div>
        <div className="header-actions">
          <button
            className="learn-button subtle small"
            onClick={() => setShowEditor(true)}
          >
            Review topics ({topics.length})
          </button>
        </div>
      </header>

      {showEditor && (
        <MaterialEditor
          inline={true}
          material={material}
          onClose={() => setShowEditor(false)}
          onSaved={() => {
            fetchMaterial(materialId, user!.id).then((m) => setMaterial(m)).catch(error => setError(error instanceof Error ? error.message : 'Could not reload this material.'));
            setShowEditor(false);
            onSaved?.();
          }}
          onStart={(s) => {
            setShowEditor(false);
            onStartPractice(material, s.topic);
          }}
        />
      )}

      <section className="material-next-action" aria-label="Next learning action">
        <div><span className="journey-eyebrow">{material.metadata.confirmed ? 'Source reviewed' : 'Before you begin'}</span>
          <h3>{material.metadata.confirmed ? 'Turn your notes into practice.' : 'Make this material yours.'}</h3>
          <p>{material.metadata.confirmed ? 'Choose a topic for guided practice. Your source stays here whenever you need to revisit it.' : 'Check the extracted topics against your source. Edit anything that needs correcting before you begin.'}</p>
        </div>
        {material.metadata.confirmed && topics.length ? <>
          <label className="journey-field">Practice topic<select value={selectedTopic} onChange={e => setFocusTopic(e.target.value)}>{topics.map(topic => <option key={topic}>{topic}</option>)}</select></label>
          <button className="learn-button dark" onClick={() => onStartPractice(material, selectedTopic)}><Play size={15} /> Start guided practice</button>
        </> : <button className="learn-button dark" onClick={() => setShowEditor(true)}>Review & confirm topics</button>}
      </section>
      {topics.length > 0 && <details className="material-topic-directory">
        <summary>{topics.length} topics in this material</summary>
        <div className="material-topics-bar">{topics.map(topic => <button key={topic} className="topic-tag" onClick={() => { setFocusTopic(topic); const source = pages.find(page => page.text.toLocaleLowerCase().includes(topic.toLocaleLowerCase())); if (source) setPageIndex(source.page); }}>{topic}</button>)}</div>
      </details>}

      <div className="material-reader">
        <div className="reader-pagination">
          <span>
            {currentPage ? `Source page ${currentPage.page} · ${pages.length} pages total` : 'Source material'}
          </span>
          <div className="pagination-buttons">
            <button
              disabled={currentIndex <= 0}
              onClick={() => setPageIndex(pages[currentIndex - 1].page)}
              className="text-button small"
            >
              Previous
            </button>
            <button
              disabled={!pages.length || currentIndex >= pages.length - 1}
              onClick={() => setPageIndex(pages[currentIndex + 1].page)}
              className="text-button small"
            >
              Next
            </button>
          </div>
        </div>

        <article className="reader-content">
          {currentPage ? (
            <pre className="page-text">{currentPage.text}</pre>
          ) : (
            <p className="empty-text">No text available for this page.</p>
          )}
        </article>
      </div>
    </div>
  );
}

export function SessionView({
  sessionId,
  onCompleted,
  revision,
  onReturnToPlan,
  nextTopic,
  returnToPlanLabel,
  onQuit,
}: {
  sessionId: string;
  onCompleted?: (session: StudySession) => void;
  revision?: string;
  onReturnToPlan?: () => void;
  nextTopic?: string | null;
  returnToPlanLabel?: string;
  onQuit?: () => Promise<void> | void;
}) {
  const { user } = useAuth();
  const [session, setSession] = useState<StudySession | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState('');
  const [reported, setReported] = useState(false);
  const [reportError, setReportError] = useState('');
  const [showQuitDialog, setShowQuitDialog] = useState(false);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    setLoading(true);
    setError('');
    let cancelled = false;
    async function load() {
      try {
        const { data, error: err } = await supabase
          .from('curve_material_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', userId)
          .single();
        if (cancelled) return;
        if (err || !data) {
          setError('Session unavailable. Please retry.');
        } else {
          const s = data as StudySession;
          setSession(s);
          let savedDraft: unknown;
          try { savedDraft = JSON.parse(sessionStorage.getItem(`curve-draft:${userId}:${s.id}`) || 'null'); }
          catch { /* Remote answers remain available when local storage cannot be read. */ }
          const draft = restoreSessionAnswers(s, savedDraft);
          setAnswers(draft);
          const unanswered = (s.questions || []).findIndex(
            (q) => draft[q.id] === undefined
          );
          setIndex(Math.max(0, unanswered));
        }
      } catch {
        if (!cancelled) setError('Session unavailable.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, user?.id, revision]);

  async function next() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      await learningAction({ action: 'save', session_id: session.id, answers });
      setIndex((i) => i + 1);
      setHint('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save answer.');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      const res = await learningAction<StudySession>({
        action: 'submit',
        session_id: session.id,
        answers,
      });
      try { sessionStorage.removeItem(`curve-draft:${user!.id}:${session.id}`); }
      catch { /* Completed sessions ignore local drafts. */ }
      setSession(res);
      onCompleted?.(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit answers.');
    } finally {
      setBusy(false);
    }
  }

  async function quitWithoutSubmitting() {
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      if (Object.keys(answers).length > 0) {
        await learningAction({ action: 'save', session_id: session.id, answers });
      }
      if (onQuit) await onQuit();
      else if (onReturnToPlan) onReturnToPlan();
      setShowQuitDialog(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save session.');
    } finally {
      setBusy(false);
    }
  }

  async function showHint() {
    if (!session) return;
    const q = session.questions[index];
    if (!q) return;
    setBusy(true);
    try {
      const h = await learningAction<{ hint: string }>({
        action: 'hint',
        session_id: session.id,
        question_id: q.id,
      });
      setHint(h.hint);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hint unavailable.');
    } finally {
      setBusy(false);
    }
  }

  async function reportIssue(e: FormEvent) {
    e.preventDefault();
    if (!session || !user) return;
    setReportError('');
    const { error: err } = await supabase.from('curve_material_reports').insert({
      user_id: user.id,
      session_id: session.id,
      question_id: 'session',
      reason: report.trim(),
    });
    if (err) setReportError('Could not send report.');
    else setReported(true);
  }

  if (loading) {
    return (
      <div className="agent-view-loading">
        <Loader2 size={24} className="spin" />
        <p>Loading questions…</p>
      </div>
    );
  }

  if (error && !session) {
    return <div className="agent-view-error">{error}</div>;
  }

  if (!session) return null;

  const evidence = sessionEvidence(session);
  const isCheckpoint = session.mode === 'checkpoint';
  const questions = session.questions || [];
  const question = questions[index];

  return (
    <div className="agent-session-view">
      <div className="session-mode-bar">
        <div className="session-mode-title-wrap">
          <span className={`pill ${isCheckpoint ? 'peach' : 'lavender'}`}>
            {isCheckpoint ? 'INDEPENDENT CHECK' : 'GUIDED PRACTICE'}
          </span>
          <h3>{session.topic}</h3>
        </div>
        {!session.results && (
          <button
            type="button"
            className="session-quit-btn"
            disabled={busy}
            onClick={() => setShowQuitDialog(true)}
            aria-label={isCheckpoint ? "End independent check" : "Quit practice session"}
            title={isCheckpoint ? "End independent check" : "Quit practice session"}
          >
            <LogOut size={13} />
            <span>{isCheckpoint ? 'End check' : 'Quit practice'}</span>
          </button>
        )}
      </div>

      {error && <p role="alert" className="learn-error">{error}</p>}
      {session.results ? (
        <div className="session-results-pane">
          <div className="learn-panel session-finish">
            <CheckCircle2 size={36} className="text-mint" />
            <h2>{evidence.missed ? "Here’s what to work on next." : "That’s today’s practice done."}</h2>
            <strong>
              {session.results.filter((r) => r.correct).length} /{' '}
              {session.results.length} correct
            </strong>
            <p>
              {evidence.missed ? `${evidence.missed} answer${evidence.missed === 1 ? '' : 's'} to revisit. Review the explanations below; your next recommendation will use these results.` : evidence.assisted ? 'You got these right with some help. Try recalling them independently next time.' : 'Your results are saved. Take a break; we’ll use this evidence when choosing your next practice.'}
            </p>
            {onReturnToPlan && (
              <button
                type="button"
                className="learn-button dark"
                style={{ marginTop: 16 }}
                onClick={onReturnToPlan}
              >
                {nextTopic ? `Continue to next topic: ${nextTopic} →` : returnToPlanLabel || 'Back to recovery plan →'}
              </button>
            )}
          </div>

          <div className="results-list">
            {session.results.map((r) => (
              <details key={r.question_id} className="learn-panel result-card" open={!r.correct || r.assisted}>
                <summary>{questions.find(question => question.id === r.question_id)?.question || 'Review answer'}</summary>
                <span className={`pill ${r.correct ? 'mint' : 'peach'}`}>
                  {r.correct ? (r.assisted ? 'Correct · with help' : 'Correct') : 'Review needed'}
                </span>
                <p>
                  <strong>Expected: </strong>
                  {r.expected}
                </p>
                <p>{r.explanation}</p>
                {r.quote && (
                  <blockquote>
                    <span>{r.source ? <a href={r.source.url} target="_blank" rel="noreferrer">{r.source.title} ↗</a> : <>SOURCE EXCERPT · PAGE {r.page}</>}</span>
                    {r.quote}
                  </blockquote>
                )}
              </details>
            ))}
          </div>

          <form className="learn-panel report-form" onSubmit={reportIssue}>
            <h4>
              <Flag size={14} /> Report an issue with this question set
            </h4>
            {reported ? (
              <p className="text-mint">Thank you. Your report was submitted.</p>
            ) : (
              <>
                <textarea
                  required
                  placeholder="Describe inaccuracies or formatting issues…"
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                />
                {reportError && <p className="text-danger">{reportError}</p>}
                <button className="learn-button subtle small">Send report</button>
              </>
            )}
          </form>
        </div>
      ) : question ? (
        <div className="session-runner-pane">
          <div className="question-header">
            <span>
              Question {index + 1} of {questions.length}
            </span>
            <span>{question.source ? 'Topic concepts' : <>Source Page {question.page}</>}</span>
          </div>

          <div className="question-progress-track">
            <span
              style={{
                width: `${(100 * (index + 1)) / questions.length}%`,
              }}
            />
          </div>

          <h3 className="question-prompt">{question.question}</h3>

          <div className="answer-options-grid">
            {question.options.map((option, optIdx) => (
              <button
                key={optIdx}
                disabled={busy}
                className={`answer-option-button ${
                  answers[question.id] === optIdx ? 'selected' : ''
                }`}
                onClick={() => {
                  const draft = { ...answers, [question.id]: optIdx };
                  setAnswers(draft);
                  try { sessionStorage.setItem(`curve-draft:${user!.id}:${session.id}`, JSON.stringify(draft)); }
                  catch { /* Save & continue still persists remotely. */ }
                }}
              >
                <span className="opt-letter">
                  {String.fromCharCode(65 + optIdx)}
                </span>
                <span className="opt-text">{option}</span>
                {answers[question.id] === optIdx && (
                  <Check size={16} className="opt-check" />
                )}
              </button>
            ))}
          </div>

          {hint && (
            <div className="session-hint-card">
              <Lightbulb size={16} />
              <p>{hint}</p>
            </div>
          )}

          <div className="question-action-bar">
            {index > 0 ? (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setIndex((i) => i - 1);
                  setHint('');
                }}
              >
                Previous
              </button>
            ) : (
              <span />
            )}

            <button
              type="button"
              className="text-button subtle-quit-action"
              disabled={busy}
              onClick={() => setShowQuitDialog(true)}
            >
              {isCheckpoint ? 'End check early' : 'Quit practice'}
            </button>

            {!isCheckpoint && (
              <button
                className="text-button hint-btn"
                disabled={busy}
                onClick={showHint}
              >
                <Lightbulb size={14} /> A little nudge
              </button>
            )}

            <button
              className="learn-button dark"
              disabled={busy || answers[question.id] === undefined}
              onClick={index === questions.length - 1 ? submit : next}
            >
              {busy ? (
                <Loader2 size={16} className="spin" />
              ) : index === questions.length - 1 ? (
                'Submit answers'
              ) : (
                'Save & continue'
              )}
            </button>
          </div>
        </div>
      ) : null}

      {showQuitDialog && <SessionExitDialog answered={Object.keys(answers).filter(id => answers[id] !== undefined).length} total={questions.length} busy={busy} error={error} onClose={() => setShowQuitDialog(false)} onSaveExit={() => void quitWithoutSubmitting()} />}

    </div>
  );
}

export function ExplanationView({
  title,
  text,
  citations,
  ui,
  onOpenCitation,
}: {
  title: string;
  text: string;
  citations: Citation[];
  ui?: InteractiveUI;
  onOpenCitation: (c: Citation) => void;
}) {
  return (
    <article className="agent-explanation-view">
      <header className="explanation-header">
        <span className="pill mint">SOURCE-GROUNDED EXPLANATION</span>
        <h2>{title}</h2>
      </header>

      {ui && <InteractiveAnswer key={title + ui.html + ui.js} ui={ui} title={title} />}

      <div className="explanation-body">
        <p className="explanation-prose">{text}</p>
      </div>

      {citations.length > 0 && (
        <aside className="explanation-citations">
          <h4>
            <BookOpen size={16} /> Verifiable Source Citations ({citations.length})
          </h4>
          <div className="citations-grid">
            {citations.map((c, i) => (
              <div
                key={i}
                className="citation-card"
                onClick={() => onOpenCitation(c)}
              >
                <div className="citation-top">
                  <span className="citation-page">{c.source ? <a href={c.source.url} target="_blank" rel="noreferrer">{c.source.title} ↗</a> : <>Page {c.page}</>}</span>
                  <ExternalLink size={12} />
                </div>
                <blockquote className="citation-quote">"{c.quote}"</blockquote>
              </div>
            ))}
          </div>
        </aside>
      )}
    </article>
  );
}

export function ProgressView({ sessions }: { sessions: StudySession[] }) {
  const accuracy = independentAccuracy(sessions);
  const activity = weeklyActivity(sessions);
  const completed = sessions.filter((s) => s.completed_at);

  return (
    <div className="agent-progress-view">
      <header className="progress-header">
        <h2>Your Learning Progress</h2>
        <p>Real effort tracked separately by mode.</p>
      </header>

      <div className="progress-stats-row">
        <div className="learn-panel stat-card">
          <p>Independent accuracy</p>
          <strong>{accuracy === null ? '—' : `${accuracy}%`}</strong>
          <small>Checks completed without hints</small>
        </div>
        <div className="learn-panel stat-card">
          <p>Completed sessions</p>
          <strong>{completed.length}</strong>
          <small>Practice & independent checks</small>
        </div>
      </div>

      <div className="learn-panel progress-chart-card">
        <h3>Sessions this week</h3>
        <div className="activity-chart">
          {activity.map((d, i) => {
            const max = Math.max(3, ...activity.map((x) => x.practice + x.checkpoint));
            return (
              <div key={i} className="activity-day">
                <div className="activity-bar-space">
                  <span
                    className="activity-bar practice"
                    style={{ height: `${(100 * d.practice) / max}%` }}
                    title={`${d.practice} practice`}
                  />
                  <span
                    className="activity-bar checkpoint"
                    style={{ height: `${(100 * d.checkpoint) / max}%` }}
                    title={`${d.checkpoint} checks`}
                  />
                </div>
                <small>{d.label}</small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
