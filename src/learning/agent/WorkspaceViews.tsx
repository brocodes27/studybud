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
  Play,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMaterial, learningAction } from '../api';
import {
  independentAccuracy,
  weeklyActivity,
  type Material,
  type StudySession,
} from '../model';
import type {
  Citation,
  StudyPlan,
} from './contracts';
import { MaterialEditor } from '../Workspace';

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
}: {
  materialId: string;
  initialPage?: number;
  onStartPractice: (material: Material, topic: string) => void;
}) {
  const { user } = useAuth();
  const [material, setMaterial] = useState<Material | null>(null);
  const [pageIndex, setPageIndex] = useState<number>(Math.max(1, initialPage));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchMaterial(materialId, user.id)
      .then((m) => {
        setMaterial(m);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load material.'))
      .finally(() => setLoading(false));
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

  return (
    <div className="agent-material-view">
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
            fetchMaterial(materialId, user!.id).then((m) => setMaterial(m));
            setShowEditor(false);
          }}
          onStart={(s) => {
            setShowEditor(false);
            onStartPractice(material, s.topic);
          }}
        />
      )}

      {topics.length > 0 && (
        <div className="material-topics-bar">
          <span className="bar-label">Topics:</span>
          {topics.slice(0, 8).map((t, idx) => (
            <button
              key={idx}
              className="topic-tag"
              onClick={() => onStartPractice(material, t)}
              title={`Practice ${t}`}
            >
              {t} <Play size={10} />
            </button>
          ))}
        </div>
      )}

      <div className="material-reader">
        <div className="reader-pagination">
          <span>
            Page {currentPage ? currentPage.page : 1} of {pages.length || 1}
          </span>
          <div className="pagination-buttons">
            <button
              disabled={pageIndex <= 1}
              onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
              className="text-button small"
            >
              Previous
            </button>
            <button
              disabled={pageIndex >= pages.length}
              onClick={() => setPageIndex((p) => Math.min(pages.length, p + 1))}
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
}: {
  sessionId: string;
  onCompleted?: (session: StudySession) => void;
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
          const draft = s.answers || {};
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
  }, [sessionId, user]);

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
      setSession(res);
      onCompleted?.(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit answers.');
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

  const isCheckpoint = session.mode === 'checkpoint';
  const questions = session.questions || [];
  const question = questions[index];

  return (
    <div className="agent-session-view">
      <div className="session-mode-bar">
        <span className={`pill ${isCheckpoint ? 'peach' : 'lavender'}`}>
          {isCheckpoint ? 'INDEPENDENT CHECK' : 'GUIDED PRACTICE'}
        </span>
        <h3>{session.topic}</h3>
      </div>

      {session.results ? (
        <div className="session-results-pane">
          <div className="learn-panel session-finish">
            <CheckCircle2 size={36} className="text-mint" />
            <h2>Session Completed</h2>
            <strong>
              {session.results.filter((r) => r.correct).length} /{' '}
              {session.results.length} correct
            </strong>
            <p>
              {isCheckpoint
                ? 'Your independent check is recorded in your progress history.'
                : 'Guided practice complete. Ready for an independent check?'}
            </p>
          </div>

          <div className="results-list">
            {session.results.map((r, i) => (
              <article key={r.question_id} className="learn-panel result-card">
                <span className={`pill ${r.correct ? 'mint' : 'peach'}`}>
                  {r.correct ? 'Correct' : 'Review needed'}
                </span>
                <h4>{questions[i]?.question}</h4>
                <p>
                  <strong>Expected: </strong>
                  {r.expected}
                </p>
                <p>{r.explanation}</p>
                {r.quote && (
                  <blockquote>
                    <span>SOURCE EXCERPT · PAGE {r.page}</span>
                    {r.quote}
                  </blockquote>
                )}
              </article>
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
            <span>Source Page {question.page}</span>
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
                  setAnswers({ ...answers, [question.id]: optIdx });
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
    </div>
  );
}

export function ExplanationView({
  title,
  text,
  citations,
  onOpenCitation,
}: {
  title: string;
  text: string;
  citations: Citation[];
  onOpenCitation: (c: Citation) => void;
}) {
  return (
    <article className="agent-explanation-view">
      <header className="explanation-header">
        <span className="pill mint">SOURCE-GROUNDED EXPLANATION</span>
        <h2>{title}</h2>
      </header>

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
                  <span className="citation-page">Page {c.page}</span>
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

export function HomeView({
  materials,
  sessions,
  onOpenMaterial,
  onOpenSession,
  onUploadClick,
  onPromptClick,
}: {
  materials: Material[];
  sessions: StudySession[];
  onOpenMaterial: (m: Material) => void;
  onOpenSession: (sessionId: string) => void;
  onUploadClick: () => void;
  onPromptClick: (prompt: string) => void;
}) {
  const pendingSession = sessions.find(
    (s) => !s.completed_at && s.questions && s.questions.length > 0
  );
  const confirmedMaterials = materials.filter(
    (m) => m.metadata?.confirmed && m.metadata?.topics?.length
  );

  return (
    <div className="agent-home-view">
      <div className="home-hero">
        <Sparkles size={32} className="home-sparkle-icon" />
        <h2>What are we learning today?</h2>
        <p>Speak or type below to plan a session, practice, or inspect your notes.</p>
      </div>

      {pendingSession && (
        <div className="home-card resume-card">
          <div className="card-left">
            <span className="pill lavender">UNFINISHED SESSION</span>
            <h3>{pendingSession.topic}</h3>
            <p>
              {pendingSession.mode === 'checkpoint'
                ? 'Independent check in progress'
                : 'Guided practice in progress'}
            </p>
          </div>
          <button
            className="learn-button dark"
            onClick={() => onOpenSession(pendingSession.id)}
          >
            <RotateCcw size={14} /> Resume session
          </button>
        </div>
      )}

      {confirmedMaterials.length > 0 ? (
        <div className="home-materials-shelf">
          <h3>Your course notes</h3>
          <div className="materials-grid">
            {confirmedMaterials.slice(0, 4).map((m) => (
              <div
                key={m.id}
                className="home-material-tile"
                onClick={() => onOpenMaterial(m)}
              >
                <h4>{m.title}</h4>
                <span>{m.metadata.topics?.length || 0} topics confirmed</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="home-card upload-prompt-card">
          <h3>Add your first course notes</h3>
          <p>Upload a PDF, Markdown, or paste lecture notes to begin.</p>
          <button className="learn-button dark" onClick={onUploadClick}>
            <Upload size={14} /> Add course notes
          </button>
        </div>
      )}

      <div className="home-quick-prompts">
        <h4>Try asking Curve:</h4>
        <div className="prompt-chips">
          <button
            className="prompt-chip"
            onClick={() => onPromptClick('My exam is Friday. I have 40 minutes.')}
          >
            "My exam is Friday. I have 40 minutes."
          </button>
          <button
            className="prompt-chip"
            onClick={() => onPromptClick('Create a 30-minute focused study plan.')}
          >
            "Create a 30-minute focused study plan."
          </button>
          <button
            className="prompt-chip"
            onClick={() => onPromptClick('Start an independent check on my notes.')}
          >
            "Start an independent check on my notes."
          </button>
        </div>
      </div>
    </div>
  );
}
