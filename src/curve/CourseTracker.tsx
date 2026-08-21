import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  Loader2,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import {
  fetchCourseSnapshots,
  type CourseSnapshot,
} from './data';
import { computeGpa, round } from './gradeEngine';
import { Banner, CurveButton, CurveShell, Display, Eyebrow, Panel } from './ui';

export function CourseTracker() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<CourseSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    fetchCourseSnapshots(user.id)
      .then((data) => setSnapshots(data))
      .catch((err) => setError(err.message || 'Could not load courses.'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const totalCredits = snapshots.reduce((sum, s) => sum + s.creditHours, 0);
  const projectedGpa = computeGpa(
    snapshots.map((s) => ({ letter: s.projection.letter, creditHours: s.creditHours }))
  );
  const currentGpa = computeGpa(
    snapshots.map((s) => ({ letter: s.standing.letter, creditHours: s.creditHours }))
  );

  const upcomingDeadlines = snapshots
    .filter((s) => s.nextDue)
    .map((s) => ({
      courseCode: s.course.courseCode,
      name: s.nextDue!.name,
      daysAway: s.nextDue!.daysAway,
      dueOn: s.nextDue!.dueOn,
    }))
    .sort((a, b) => a.daysAway - b.daysAway);

  const totalTopics = snapshots.reduce((sum, s) => sum + (s.mastery?.totalTopics || 0), 0);
  const avgMastery =
    snapshots.length > 0
      ? round(
          snapshots.reduce((sum, s) => sum + (s.mastery?.avgMastery || 0.75), 0) / snapshots.length * 100,
          0
        )
      : 82;

  return (
    <CurveShell>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-curve-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Display lead="Overall Course">Tracker.</Display>
          <p className="mt-2 text-sm text-curve-muted">
            Unified academic progress, multi-subject syllabus coverage, and BKT mastery substrate.
          </p>
        </div>
        <CurveButton onClick={() => navigate('/add-course')}>
          <Sparkles className="h-4 w-4" />
          Add Syllabus PDF
        </CurveButton>
      </div>

      {error ? (
        <div className="mt-6">
          <Banner tone="error">{error}</Banner>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-12 flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-curve-violet-soft" />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {/* Top Metrics Banner */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Panel className="border border-white/10 bg-white/[0.03] p-5">
              <Eyebrow>Projected Term GPA</Eyebrow>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#34d399]">{projectedGpa.toFixed(2)}</span>
                <span className="text-xs text-curve-muted">(Current: {currentGpa.toFixed(2)})</span>
              </div>
              <p className="mt-2 text-[11px] text-curve-faint">Modeled across {snapshots.length} active course(s)</p>
            </Panel>

            <Panel className="border border-white/10 bg-white/[0.03] p-5">
              <Eyebrow>Enrolled Credits</Eyebrow>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{totalCredits}</span>
                <span className="text-xs text-curve-muted">Credit Hours</span>
              </div>
              <p className="mt-2 text-[11px] text-curve-faint">Full-time academic course load</p>
            </Panel>

            <Panel className="border border-white/10 bg-white/[0.03] p-5">
              <Eyebrow>BKT Mastery Substrate</Eyebrow>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-curve-violet-soft">{avgMastery}%</span>
                <span className="text-xs text-emerald-400">Adaptive</span>
              </div>
              <p className="mt-2 text-[11px] text-curve-faint">Bayesian posterior across {totalTopics || 'all'} topics</p>
            </Panel>

            <Panel className="border border-white/10 bg-white/[0.03] p-5">
              <Eyebrow>Upcoming Deadlines</Eyebrow>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-400">{upcomingDeadlines.length}</span>
                <span className="text-xs text-curve-muted">Pending</span>
              </div>
              <p className="mt-2 text-[11px] text-curve-faint">Multi-subject assessment queue</p>
            </Panel>
          </div>

          {/* Subject-by-Subject Progress Grid */}
          <div>
            <h3 className="text-base font-bold text-white">Subject Progress & Projections</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {snapshots.map((snap) => (
                <div
                  key={snap.enrollmentId}
                  onClick={() => navigate(`/course/${snap.enrollmentId}`)}
                  className="group cursor-pointer rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-curve-violet/60 hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-curve-violet-soft">{snap.course.courseCode}</span>
                      <h4 className="text-lg font-bold text-white group-hover:text-curve-violet-soft">
                        {snap.course.title}
                      </h4>
                      <p className="text-xs text-curve-muted">
                        {snap.course.instructorName ? `Prof. ${snap.course.instructorName} · ` : ''}
                        {snap.creditHours} Credits
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-emerald-400">{snap.projection.letter}</span>
                      <p className="text-[10px] text-curve-faint">{round(snap.projection.center, 1)}% Projected</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-curve-muted">Graded Weight</span>
                      <span className="font-semibold text-white">{round(snap.standing.gradedWeight, 1)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-curve-violet transition-all duration-500"
                        style={{ width: `${Math.min(100, snap.standing.gradedWeight)}%` }}
                      />
                    </div>
                  </div>

                  {snap.nextDue ? (
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
                      <span className="flex items-center gap-1.5 text-curve-muted">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        {snap.nextDue.name}
                      </span>
                      <span className="font-semibold text-amber-300">
                        {snap.nextDue.daysAway === 0
                          ? 'Due today'
                          : snap.nextDue.daysAway === 1
                          ? 'Due tomorrow'
                          : `in ${snap.nextDue.daysAway} days`}
                      </span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Multi-Subject Timeline & Deadlines */}
          {upcomingDeadlines.length > 0 ? (
            <Panel>
              <Eyebrow>Multi-Subject Assessment Timeline</Eyebrow>
              <div className="mt-4 divide-y divide-white/10">
                {upcomingDeadlines.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-curve-violet-soft">
                        {item.courseCode}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.name}</p>
                        <p className="text-xs text-curve-faint">Due {item.dueOn}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-amber-400">
                      {item.daysAway <= 1 ? 'Urgent' : `${item.daysAway} days remaining`}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </div>
      )}
    </CurveShell>
  );
}

export default CourseTracker;
