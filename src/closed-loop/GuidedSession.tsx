/* Edge-function errors are not strongly typed by the Supabase client. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormEvent, PointerEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ActionEvent } from '@openuidev/react-lang';
import {
  AlertCircle,
  ArrowLeft,
  BookOpenCheck,
  Camera,
  CheckCircle2,
  Eraser,
  FileText,
  Loader2,
  MessageCircleQuestion,
  Pencil,
  Send,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AtlasOpenUIMessage } from '../openui/AtlasOpenUIMessage';
import { resolveAtlasOpenUIAction } from '../openui/actions';
import {
  askSocraticCoach,
  ChatMessage,
  completeQueueItem,
  QueueItem,
  trackLearningEvent,
  uploadStudentWork,
} from './data';

type WorkMode = 'type' | 'draw' | 'notebook';

function readSelectedItem(): QueueItem | null {
  try {
    const value = sessionStorage.getItem('elevenfolks:guided-item');
    return value ? (JSON.parse(value) as QueueItem) : null;
  } catch {
    return null;
  }
}

// The base no-unused-vars rule incorrectly treats this callback type parameter as a local.
// eslint-disable-next-line no-unused-vars
function DrawingPad({ onChange }: { onChange: (file: File | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const context = canvas.getContext('2d');
    context?.scale(ratio, ratio);
    if (context) {
      context.lineWidth = 2.5;
      context.lineCap = 'round';
      context.strokeStyle = '#2D2A26';
    }
  }, []);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const exportDrawing = () => {
    canvasRef.current?.toBlob((blob) => {
      onChange(blob ? new File([blob], `working-${Date.now()}.png`, { type: 'image/png' }) : null);
    }, 'image/png');
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = canvasRef.current?.getContext('2d');
    const current = point(event);
    context?.beginPath();
    context?.moveTo(current.x, current.y);
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext('2d');
    const current = point(event);
    context?.lineTo(current.x, current.y);
    context?.stroke();
  };

  const stop = () => {
    if (!drawing.current) return;
    drawing.current = false;
    exportDrawing();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold text-[var(--neo-muted)]">Show your working</p>
        <button type="button" onClick={clear} className="flex items-center gap-1.5 text-xs font-bold text-stone-500">
          <Eraser className="h-3.5 w-3.5" /> Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        className="h-64 w-full touch-none rounded-2xl border border-stone-200 bg-white shadow-inner"
      />
    </div>
  );
}

export default function GuidedSession() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item] = useState(readSelectedItem);
  const [mode, setMode] = useState<WorkMode>('type');
  const [response, setResponse] = useState('');
  const [questionResponses, setQuestionResponses] = useState<string[]>(
    () => item?.draftQuestions?.map(() => '') || [],
  );
  const [workFile, setWorkFile] = useState<File | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'coach',
      content: 'I will help you think without giving away the answer. What do you notice first?',
    },
  ]);
  const [asking, setAsking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{
    title: string;
    next: string;
    score?: number;
    concept?: string;
    feedback?: string;
    pending?: boolean;
    questionResults?: Array<{
      question_number: number;
      status: 'correct' | 'partial' | 'incorrect' | 'unanswered';
      feedback: string;
    }>;
  } | null>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const startedAtRef = useRef(Date.now());
  const completedRef = useRef(false);
  const askingRef = useRef(false);

  useEffect(() => {
    const startedAt = startedAtRef.current;
    return () => {
      if (item && user?.id && !completedRef.current) {
        void trackLearningEvent('guided_session_exited', user.id, {
          source_id: item.sourceId,
          duration_seconds: Math.round((Date.now() - startedAt) / 1000),
        });
      }
    };
  }, [item, user?.id]);

  if (!item) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="max-w-md rounded-[32px] border border-stone-200 bg-white p-8 text-center shadow-sm">
          <BookOpenCheck className="mx-auto h-10 w-10 text-[var(--neo-accent)]" />
          <h1 className="mt-4 text-3xl font-semibold">Choose today’s next step</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--neo-muted)]">A guided session starts from a real assignment or repair task.</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[var(--neo-ink)] px-5 py-3 text-sm font-bold text-white">
            <ArrowLeft className="h-4 w-4" /> Go to Today
          </Link>
        </div>
      </div>
    );
  }

  const sendCoachMessage = async (message: string) => {
    if (!message.trim() || askingRef.current) return;
    const normalizedMessage = message.trim();
    const nextMessages: ChatMessage[] = [...messages, { role: 'student', content: normalizedMessage }];
    askingRef.current = true;
    setMessages(nextMessages);
    setChatInput('');
    setAsking(true);
    setError('');
    try {
      const answer = await askSocraticCoach(item, nextMessages, normalizedMessage, sessionIdRef.current);
      setMessages((current) => [...current, answer]);
    } catch (nextError: any) {
      setError(nextError?.message || 'The coach could not respond. Your work is still safe.');
    } finally {
      askingRef.current = false;
      setAsking(false);
    }
  };

  const ask = (event: FormEvent) => {
    event.preventDefault();
    void sendCoachMessage(chatInput);
  };

  const handleOpenUIAction = (event: ActionEvent) => {
    const action = resolveAtlasOpenUIAction(event);
    if (!action) return;
    if (action.kind === 'continue') {
      void sendCoachMessage(action.prompt);
    } else {
      navigate(action.route);
    }
  };

  const submit = async () => {
    if (!user?.id || submitting) return;
    const structuredResponse =
      item.draftQuestions?.length && questionResponses.length
        ? item.draftQuestions
            .map(
              (question, index) =>
                `Question ${index + 1}: ${question.question}\nStudent answer ${index + 1}: ${questionResponses[index]?.trim() || '[unanswered]'}`,
            )
            .join('\n\n')
        : response;
    const hasTypedAnswer = item.draftQuestions?.length
      ? questionResponses.some((answer) => answer.trim())
      : response.trim();
    if (mode === 'type' && !hasTypedAnswer) {
      setError('Add your answer or working before submitting.');
      return;
    }
    if (mode !== 'type' && !workFile) {
      setError(mode === 'notebook' ? 'Take or upload a photo of your notebook first.' : 'Add some working to the drawing pad first.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const attachmentUrl = workFile ? await uploadStudentWork(user.id, item.sourceId, workFile) : undefined;
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
      const result = await completeQueueItem(item, user.id, structuredResponse, attachmentUrl, {
        durationSeconds,
        workMode: mode,
      });
      await trackLearningEvent('mastery_receipt_created', user.id, {
        source_id: item.sourceId,
        subject: item.subject,
        mode,
        duration_seconds: durationSeconds,
        coach_turns: messages.filter((message) => message.role === 'coach').length,
        completed: true,
      });
      completedRef.current = true;
      setReceipt({
        title: `You completed ${item.title}`,
        next: result?.assessment?.feedback ||
          (messages.length > 2
            ? 'You used questions to work through uncertainty instead of skipping the hard part.'
            : 'Your teacher can now see the work and use it to decide what should come next.'),
        score: result?.assessment?.score,
        concept: result?.assessment?.concept,
        feedback: result?.assessment?.feedback,
        pending: result?.assessmentPending,
        questionResults: result?.assessment?.question_results,
      });
    } catch (nextError: any) {
      setError(nextError?.message || 'Your work could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--neo-surface)] px-5 py-10">
        <div className="w-full max-w-xl rounded-[36px] border border-emerald-200 bg-white p-8 text-center shadow-xl shadow-stone-900/5 sm:p-12">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Mastery receipt</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{receipt.title}</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--neo-muted)]">{receipt.next}</p>
          {receipt.pending && (
            <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              Your work is submitted. The automatic evidence check is delayed, so your teacher will see it in the review queue.
            </p>
          )}
          {receipt.questionResults && receipt.questionResults.length > 0 && (
            <div className="mt-6 space-y-2 text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--neo-muted)]">
                Answer check
              </p>
              {receipt.questionResults.map((result) => (
                <div
                  key={result.question_number}
                  className={`rounded-2xl border p-3 ${
                    result.status === 'correct'
                      ? 'border-emerald-200 bg-emerald-50'
                      : result.status === 'partial'
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black">Question {result.question_number}</p>
                    <span className="text-[10px] font-black uppercase tracking-wider">{result.status}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-stone-600">{result.feedback}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-7 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl bg-[var(--neo-surface)] p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--neo-muted)]">Subject</p>
              <p className="mt-1 font-bold">{item.subject}</p>
            </div>
            <div className="rounded-2xl bg-[var(--neo-surface)] p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-[var(--neo-muted)]">
                {receipt.score == null ? 'Work mode' : 'AI check'}
              </p>
              <p className="mt-1 font-bold capitalize">
                {receipt.score == null ? mode : `${Math.round(receipt.score * 100)}%`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem('elevenfolks:guided-item');
              navigate('/');
            }}
            className="mt-7 w-full rounded-2xl bg-[var(--neo-ink)] px-5 py-4 text-sm font-black text-white"
          >
            Return to Today
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-[calc(100vh-4rem)] grid-rows-[auto_minmax(0,1fr)] bg-[var(--neo-surface)] md:min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" className="rounded-xl border border-stone-200 p-2 text-stone-500 hover:text-stone-900" aria-label="Leave session">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{item.title}</p>
            <p className="text-xs text-[var(--neo-muted)]">{item.subject} · Guided, not answered</p>
          </div>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex items-center gap-2 rounded-xl bg-[var(--neo-ink)] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Submit work
        </button>
      </header>

      <div className="grid min-h-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <section className="min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--neo-accent)]">Your task</p>
              <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">{item.title}</h1>
              {item.draftQuestions && item.draftQuestions.length > 0 ? (
                <ol className="mt-4 space-y-3">
                  {item.draftQuestions.map((question, index) => (
                    <li
                      key={question.id || `${index}-${question.question.slice(0, 24)}`}
                      className="rounded-2xl bg-[var(--neo-surface)] px-4 py-3 text-sm leading-6 text-[var(--neo-ink)]"
                    >
                      <span className="mr-2 text-[10px] font-black uppercase tracking-wider text-[var(--neo-muted)]">
                        Q{index + 1}
                      </span>
                      {question.question}
                      {Array.isArray(question.options) && question.options.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-[var(--neo-muted)]">
                          {question.options.map((option) => (
                            <li key={option}>• {option}</li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm leading-7 text-[var(--neo-muted)]">{item.description}</p>
              )}
              {item.homeworkType && (
                <p className="mt-4 text-[11px] font-black uppercase tracking-[0.14em] text-stone-400">
                  {item.homeworkType === 'assessment_practice' ? 'Assessment practice' : 'Guided practice'}
                  {item.topic ? ` · ${item.topic}` : ''}
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-1.5">
              {[
                { id: 'type', label: 'Type', icon: FileText },
                { id: 'draw', label: 'Draw', icon: Pencil },
                { id: 'notebook', label: 'Notebook', icon: Camera },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMode(id as WorkMode);
                    setWorkFile(null);
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black ${
                    mode === id ? 'bg-[var(--neo-ink)] text-white' : 'text-stone-500 hover:bg-stone-50'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
              {mode === 'type' && (
                item.draftQuestions?.length ? (
                  <div className="space-y-5">
                    {item.draftQuestions.map((question, index) => (
                      <label key={question.id || `${index}-${question.question}`} className="block">
                        <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--neo-muted)]">
                          Answer {index + 1}
                        </span>
                        <p className="mt-1.5 text-sm font-semibold leading-6 text-[var(--neo-ink)]">
                          {question.question}
                        </p>
                        <textarea
                          value={questionResponses[index] || ''}
                          onChange={(event) =>
                            setQuestionResponses((current) =>
                              current.map((answer, answerIndex) =>
                                answerIndex === index ? event.target.value : answer,
                              ),
                            )
                          }
                          placeholder="Write your answer and show your reasoning…"
                          className="mt-2 min-h-28 w-full resize-y rounded-2xl border border-stone-200 bg-[var(--neo-surface)] p-4 text-sm leading-6 outline-none focus:border-[var(--neo-accent)]"
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={response}
                    onChange={(event) => setResponse(event.target.value)}
                    placeholder="Write your answer and show your reasoning…"
                    className="min-h-64 w-full resize-none bg-transparent text-base leading-7 outline-none placeholder:text-stone-300"
                  />
                )
              )}
              {mode === 'draw' && <DrawingPad onChange={setWorkFile} />}
              {mode === 'notebook' && (
                <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-[var(--neo-surface)] p-8 text-center hover:border-[var(--neo-accent)]/50">
                  {workFile ? (
                    <>
                      <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                      <p className="mt-3 font-bold">{workFile.name}</p>
                      <p className="mt-1 text-xs text-[var(--neo-muted)]">Tap to replace this notebook image</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-[var(--neo-accent)]" />
                      <p className="mt-3 font-bold">Photograph your notebook page</p>
                      <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--neo-muted)]">
                        Keep the full page in frame with clear light. Your teacher receives the original work.
                      </p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(event) => setWorkFile(event.target.files?.[0] || null)}
                  />
                </label>
              )}
              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-t border-stone-200 bg-white lg:border-l lg:border-t-0">
          <div className="border-b border-stone-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--neo-accent)]/10 text-[var(--neo-accent)]">
                <MessageCircleQuestion className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-black">Socratic coach</p>
                <p className="text-[11px] text-[var(--neo-muted)]">Questions and hints, never the answer</p>
              </div>
            </div>
          </div>
          <div className="min-h-[320px] flex-1 space-y-3 overflow-y-auto p-5">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`text-sm leading-6 ${
                  message.role === 'student'
                    ? 'ml-auto max-w-[90%] rounded-2xl bg-[var(--neo-ink)] px-4 py-3 text-white'
                    : message.format === 'openui'
                      ? 'max-w-full'
                      : 'max-w-[90%] rounded-2xl bg-[var(--neo-surface)] px-4 py-3 text-stone-700'
                }`}
              >
                {message.role === 'coach' && message.format === 'openui' ? (
                  <AtlasOpenUIMessage
                    content={message.content}
                    fallbackContent={message.fallbackContent}
                    onAction={handleOpenUIAction}
                  />
                ) : (
                  message.content
                )}
              </div>
            ))}
            {asking && (
              <div className="flex max-w-[90%] items-center gap-2 rounded-2xl bg-[var(--neo-surface)] px-4 py-3 text-sm text-[var(--neo-muted)]">
                <Sparkles className="h-4 w-4 animate-pulse" /> Finding the next-smallest question…
              </div>
            )}
          </div>
          <form onSubmit={ask} className="border-t border-stone-100 p-4">
            <div className="flex items-end gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-[var(--neo-accent)]/15">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                placeholder="Ask for a hint…"
                className="max-h-28 min-h-10 flex-1 resize-none px-2 py-2 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || asking}
                className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--neo-ink)] text-white disabled:opacity-30"
                aria-label="Send question"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
