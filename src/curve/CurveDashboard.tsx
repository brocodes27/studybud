import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarDays, Crown, Grid3x3, Home, Loader2, LogOut, PieChart, Plus, ShieldAlert } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import {
  fetchCourseSnapshots,
  projectedGpa,
  rankByLeverage,
  recordForecastDaily,
  type CourseSnapshot,
} from './data';
import { round } from './gradeEngine';
import {
  CardGrid,
  Chip,
  ChipRow,
  CurveButton,
  CurveShell,
  Display,
  Eyebrow,
  GradientCard,
  Panel,
} from './ui';
import { DailyBriefingCard } from './DailyBriefingCard';
import { StageQueue } from './StageQueue';
import './curve.css';

type Filter = 'all' | 'at-risk' | 'due-soon' | 'secured';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All courses' },
  { id: 'at-risk', label: 'At risk' },
  { id: 'due-soon', label: 'Exam soon' },
  { id: 'secured', label: 'On track' },
];

function matchesFilter(snapshot: CourseSnapshot, filter: Filter): boolean {
  switch (filter) {
    case 'at-risk':
      return snapshot.projection.percent < 80;
    case 'due-soon':
      return snapshot.nextDue !== null && snapshot.nextDue.daysAway <= 14;
    case 'secured':
      return snapshot.projection.percent >= 80;
    default:
      return true;
  }
}

function dueLabel(snapshot: CourseSnapshot): string {
  if (!snapshot.nextDue) return snapshot.course.term;
  const { name, daysAway } = snapshot.nextDue;
  if (daysAway === 0) return `${name} today`;
  if (daysAway === 1) return `${name} tomorrow`;
  return `${name} in ${daysAway} days`;
}

export function CurveDashboard() {
  const { user, fullName, signOut } = useAuth();
  const navigate = useNavigate();

  const [snapshots, setSnapshots] = useState<CourseSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  // F3-R2: track previous forecast per enrollment so the projection delta is
  // visible the moment a session moves the needle.
  const [forecastDeltas, setForecastDeltas] = useState<Record<string, number | null>>({});
  const previousPercents = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCourseSnapshots(user.id)
      .then((result) => {
        if (cancelled) return;
        setSnapshots(result);
        setForecastDeltas((prev) => {
          const deltas: Record<string, number | null> = {};
          result.forEach((snapshot) => {
            const prevPercent = previousPercents.current.get(snapshot.enrollmentId);
            deltas[snapshot.enrollmentId] =
              prevPercent !== undefined && prevPercent !== snapshot.projection.percent
                ? round(snapshot.projection.percent - prevPercent, 1)
                : prev[snapshot.enrollmentId] ?? null;
            previousPercents.current.set(snapshot.enrollmentId, snapshot.projection.percent);
          });
          return deltas;
        });
        result.forEach((snapshot) => {
          void recordForecastDaily(snapshot).catch(() => undefined);
        });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load your courses.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const visible = useMemo(
    () => snapshots.filter((snapshot) => matchesFilter(snapshot, filter)),
    [snapshots, filter],
  );

  const gpa = useMemo(() => projectedGpa(snapshots), [snapshots]);
  const focus = useMemo(() => rankByLeverage(snapshots)[0] ?? null, [snapshots]);
  const firstName = (fullName ?? '').split(' ')[0] || 'there';

  // Check for upcoming exams within 3 days for Emergency Mode banner
  const emergencyCourse = useMemo(() => {
    return snapshots.find(
      (s) => s.nextDue !== null && s.nextDue.daysAway <= 3
    ) || snapshots[0] || null;
  }, [snapshots]);

  function openCourse(snapshot: CourseSnapshot) {
    navigate(`/course/${snapshot.enrollmentId}`);
  }

  return (
    <CurveShell>
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-bold text-white ring-1 ring-white/15">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <div className="leading-tight">
            <p className="text-xs text-curve-muted">Welcome back</p>
            <p className="text-sm font-semibold text-white">{fullName ?? 'Student'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CurveButton
            ghost
            onClick={() => navigate(emergencyCourse ? `/emergency/${emergencyCourse.enrollmentId}` : '/emergency')}
            className="!px-3 !py-2 !text-xs text-red-300 border-red-500/30 hover:bg-red-500/10"
          >
            <ShieldAlert className="h-4 w-4 text-red-400 animate-pulse" />
            <span className="hidden sm:inline font-bold">Emergency Mode</span>
          </CurveButton>
          <CurveButton ghost onClick={() => navigate('/map')} className="!px-3 !py-2 !text-xs text-curve-mint border-emerald-500/30 hover:bg-emerald-500/10">
            <Grid3x3 className="h-4 w-4 text-curve-mint" />
            <span className="hidden sm:inline font-bold">Stage map</span>
          </CurveButton>
          <CurveButton ghost onClick={() => navigate('/tracker')} className="!px-3 !py-2 !text-xs text-curve-violet-soft border-purple-500/30 hover:bg-purple-500/10">
            <PieChart className="h-4 w-4 text-curve-violet-soft" />
            <span className="hidden sm:inline font-bold">Course Tracker</span>
          </CurveButton>
          <CurveButton ghost onClick={() => navigate('/subscription')} className="!px-3 !py-2 !text-xs text-amber-300 border-amber-500/30 hover:bg-amber-500/10">
            <Crown className="h-4 w-4 text-amber-400" />
            <span className="hidden sm:inline font-bold">Pro Pass</span>
          </CurveButton>
          <CurveButton onClick={() => navigate(user ? '/add-course' : '/auth')} className="!px-4 !py-2 !text-sm">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            <span className="hidden sm:inline">Add course</span>
          </CurveButton>
          {user ? (
            <button
              type="button"
              aria-label="Sign out"
              onClick={() => void signOut()}
              className="curve-orb curve-orb-light curve-orb-static"
            >
              <LogOut className="h-4 w-4" strokeWidth={2.2} />
            </button>
          ) : null}
        </div>
      </header>

      <div className="mt-8 sm:mt-10">
        <Display lead="Here's where">you stand.</Display>
      </div>

      {/* Daily Cognitive Audio & Visual Briefing */}
      <div className="mt-6">
        <DailyBriefingCard
          snapshot={focus}
          onStartSession={() =>
            navigate(focus ? `/session/${focus.enrollmentId}` : '/session/demo')
          }
        />
      </div>

      {loading ? (
        <div className="mt-10 flex items-center gap-3 text-curve-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Working out your grades…</span>
        </div>
      ) : error ? (
        <Panel className="mt-8 border-curve-bad/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-curve-bad" />
            <div>
              <p className="font-semibold">We could not load your courses</p>
              <p className="mt-1 text-sm text-curve-muted">{error}</p>
            </div>
          </div>
        </Panel>
      ) : snapshots.length === 0 ? (
        <EmptyState signedIn={Boolean(user)} onAdd={() => navigate('/add-course')} />
      ) : (
        <>
          {focus ? (
            <FocusPanel
              snapshot={focus}
              gpa={gpa}
              onStudy={() => navigate(`/session/${focus.enrollmentId}`)}
              onAddScore={() => navigate(`/course/${focus.enrollmentId}`)}
              onEmergency={() => navigate(`/emergency/${focus.enrollmentId}`)}
            />
          ) : null}
          {user ? <StageQueue /> : null}

          <div className="mt-8">
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

          <div className="mt-5">
            {visible.length === 0 ? (
              <p className="py-10 text-center text-sm text-curve-muted">
                No courses match this filter.
              </p>
            ) : (
              <CardGrid>
                {visible.map((snapshot) => (
                  <CourseCard
                    key={snapshot.enrollmentId}
                    snapshot={snapshot}
                    onOpen={() => openCourse(snapshot)}
                  />
                ))}
              </CardGrid>
            )}
          </div>
        </>
      )}

      <Dock
        onHome={() => navigate('/')}
        onAdd={() => navigate(user ? '/add-course' : '/auth')}
      />
    </CurveShell>
  );
}

function FocusPanel({
  snapshot,
  gpa,
  onStudy,
  onAddScore,
  onEmergency,
}: {
  snapshot: CourseSnapshot;
  gpa: number | null;
  onStudy: () => void;
  onAddScore: () => void;
  onEmergency: () => void;
}) {
  const { projection, standing } = snapshot;

  return (
    <Panel className="mt-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <Eyebrow>Highest leverage today</Eyebrow>
          <p className="mt-2 text-xl font-semibold leading-snug sm:text-2xl">
            {snapshot.course.courseCode} is tracking{' '}
            <span className="text-curve-violet-soft">{projection.letter}</span>
            {snapshot.nextDue ? (
              <>
                {' '}
                with {snapshot.nextDue.name.toLowerCase()} in {snapshot.nextDue.daysAway} days.
              </>
            ) : (
              '.'
            )}
          </p>
          <p className="mt-2 text-sm text-curve-muted">
            {round(standing.ungradedWeight, 0)}% of the grade is still unearned, so this is where
            the next hour moves the number most.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <CurveButton onClick={onStudy}>Start a study session</CurveButton>
            <CurveButton ghost onClick={onAddScore}>
              Add a returned score
            </CurveButton>
            <button
              type="button"
              onClick={onEmergency}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/20"
            >
              <ShieldAlert className="h-4 w-4 text-red-400" />
              72h Emergency Sprint
            </button>
          </div>
        </div>

        {gpa !== null ? (
          <div className="curve-inset shrink-0 px-6 py-5 text-center lg:w-48">
            <Eyebrow>Projected GPA</Eyebrow>
            <p className="curve-figure mt-1 text-4xl">{gpa.toFixed(2)}</p>
            <p className="mt-1 text-xs text-curve-muted">
              across {snapshot.course.term || 'this term'}
            </p>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function CourseCard({ snapshot, onOpen }: { snapshot: CourseSnapshot; onOpen: () => void }) {
  const { projection, standing } = snapshot;
  const rangeLabel =
    projection.lowLetter === projection.highLetter
      ? 'Locked in'
      : `${projection.lowLetter} to ${projection.highLetter}`;

  return (
    <GradientCard
      tone={snapshot.tone}
      tag={snapshot.course.courseCode}
      title={snapshot.course.title}
      subtitle={dueLabel(snapshot)}
      onOpen={onOpen}
      openLabel={`Open ${snapshot.course.courseCode}`}
    >
      <div className="mt-4 flex items-end gap-3">
        <span className="curve-figure text-5xl leading-none text-[#1a1224]">
          {projection.letter}
        </span>
        <span className="pb-1 text-sm font-semibold text-[#1a1224]/70">
          {round(projection.percent, 1)}%
        </span>
      </div>
      <p className="mt-1.5 text-xs font-medium text-[#1a1224]/65">
        {rangeLabel} · {round(standing.gradedWeight, 0)}% graded
      </p>
    </GradientCard>
  );
}

function EmptyState({ signedIn, onAdd }: { signedIn: boolean; onAdd: () => void }) {
  return (
    <Panel className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-curve-violet/20 ring-1 ring-white/10">
            <CalendarDays className="h-5 w-5 text-curve-violet-soft" />
          </div>
          <div>
            <p className="font-semibold">
              {signedIn ? 'No courses yet' : 'Your grades, forecast before they are final'}
            </p>
            <p className="mt-1 text-sm text-curve-muted">
              {signedIn
                ? 'Upload your first syllabus and Curve will start forecasting your final grade today.'
                : 'Add your syllabus and get a daily forecast plus the single highest-leverage action to move your grade. Sign in to save your courses.'}
            </p>
          </div>
        </div>
        <CurveButton className="shrink-0" onClick={onAdd}>
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          {signedIn ? 'Add my first course' : 'Sign in and add a course'}
        </CurveButton>
      </div>
    </Panel>
  );
}

function Dock({ onHome, onAdd }: { onHome: () => void; onAdd: () => void }) {
  return (
    <nav className="curve-dock lg:hidden" aria-label="Primary">
      <button
        type="button"
        className="curve-dock-item"
        aria-current="page"
        aria-label="Today"
        onClick={onHome}
      >
        <Home className="h-5 w-5" strokeWidth={2.2} />
      </button>
      <button type="button" className="curve-dock-item" aria-label="Add course" onClick={onAdd}>
        <Plus className="h-5 w-5" strokeWidth={2.2} />
      </button>
      <button type="button" className="curve-dock-item" aria-label="Courses" onClick={onHome}>
        <PieChart className="h-5 w-5" strokeWidth={2.2} />
      </button>
    </nav>
  );
}

export default CurveDashboard;
