import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, SendHorizontal } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { coachReply, type CoachContext } from './ai';
import { fetchCourseSnapshot, type CourseSnapshot } from './data';
import { round } from './gradeEngine';
import { Banner, CurveShell, Eyebrow, Panel, TextInput } from './ui';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

function buildContext(snapshot: CourseSnapshot, userId?: string): CoachContext {
  const gradedComponents = snapshot.standing.components.filter(
    (component) => component.gradedCount > 0,
  );
  const weakest = gradedComponents.sort((a, b) => a.fraction - b.fraction)[0] ?? null;

  return {
    courseCode: snapshot.course.courseCode,
    courseTitle: snapshot.course.title,
    projectedLetter: snapshot.projection.letter,
    ungradedWeight: snapshot.standing.ungradedWeight,
    weakestComponent: weakest ? `${weakest.name} at ${round(weakest.fraction * 100, 0)}%` : null,
    nextDue: snapshot.nextDue
      ? { name: snapshot.nextDue.name, daysAway: snapshot.nextDue.daysAway }
      : null,
    userId,
  };
}

export function StudySession() {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const [searchParams] = useSearchParams();
  const focus = searchParams.get('focus');
  const { user } = useAuth();
  const navigate = useNavigate();

  const [snapshot, setSnapshot] = useState<CourseSnapshot | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id || !enrollmentId) return;
    fetchCourseSnapshot(user.id, enrollmentId)
      .then((result) => {
        setSnapshot(result);
        if (result) {
          const context = buildContext(result, user.id);
          if (focus && result.components.some((component) => component.name === focus)) {
            setTurns([
              {
                role: 'assistant',
                content: `You are tracking ${context.projectedLetter} in ${context.courseCode}. You came here to work on ${focus} specifically — what part of it is giving you trouble?`,
              },
            ]);
          } else {
            setTurns([
              {
                role: 'assistant',
                content: context.weakestComponent
                  ? `You are tracking ${context.projectedLetter} in ${context.courseCode}, and ${context.weakestComponent} is your weakest category so far. Tell me what you last got stuck on and we will work it out from there.`
                  : `You are tracking ${context.projectedLetter} in ${context.courseCode}. What are you working on right now?`,
              },
            ]);
          }
        }
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Could not load this course.'),
      );
  }, [user?.id, enrollmentId, focus]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, thinking]);

  async function send() {
    const message = input.trim();
    if (!message || !snapshot || thinking) return;

    setInput('');
    setError(null);
    const nextTurns: Turn[] = [...turns, { role: 'user', content: message }];
    setTurns(nextTurns);
    setThinking(true);

    try {
      const reply = await coachReply(buildContext(snapshot, user?.id), nextTurns, message);
      setTurns([...nextTurns, { role: 'assistant', content: reply }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The coach could not respond.');
    } finally {
      setThinking(false);
    }
  }

  return (
    <CurveShell>
      <button
        type="button"
        onClick={() => navigate(enrollmentId ? `/course/${enrollmentId}` : '/')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-curve-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to the course
      </button>

      {snapshot ? (
        <>
          <Eyebrow>Study session</Eyebrow>
          <h1 className="curve-display mt-2 !text-[clamp(1.6rem,4vw,2.4rem)]">
            {snapshot.course.courseCode}
          </h1>
          <p className="mt-2 text-sm text-curve-muted">
            Tracking {snapshot.projection.letter} · {round(snapshot.standing.ungradedWeight, 0)}% of
            the grade still unearned
          </p>
        </>
      ) : null}

      {error ? (
        <div className="mt-6">
          <Banner tone="error">{error}</Banner>
        </div>
      ) : null}

      <Panel className="mt-6">
        <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto pr-1">
          {turns.map((turn, index) => (
            <div
              key={index}
              className={`curve-bubble ${
                turn.role === 'user' ? 'curve-bubble-student' : 'curve-bubble-coach'
              }`}
            >
              {turn.content}
            </div>
          ))}
          {thinking ? (
            <div className="curve-bubble curve-bubble-coach flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <TextInput
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder="What are you stuck on?"
            disabled={!snapshot || thinking}
          />
          <button
            type="button"
            aria-label="Send"
            onClick={() => void send()}
            disabled={!snapshot || thinking || !input.trim()}
            className="curve-orb curve-orb-light curve-orb-static disabled:opacity-40"
          >
            <SendHorizontal className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
        <p className="mt-3 text-xs text-curve-faint">
          The coach will not give you the answer. It asks the question that gets you there.
        </p>
      </Panel>
    </CurveShell>
  );
}

export default StudySession;
