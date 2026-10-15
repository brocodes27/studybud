import { useEffect, useState } from 'react';
import { buildSemesterSchedule, localDate, semesterExamTimeline, plannedSessionContext } from './semesterPlanner';
import type { Material, StudySession } from '../model';
import { daysToExam } from '../model';
import {
  Calendar,
  Coffee,
  Edit3,
  Flame,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { SemesterPlan, StudyPlanStep } from './contracts';

interface SemesterRoadmapViewProps {
  plan: SemesterPlan;
  onEditPlan: () => void;
  onStartStep: (step: StudyPlanStep) => void;
  onFinishExam?: (examId: string) => Promise<void>;
  onReviewExam?: (examId: string) => void;
  busy?: boolean;
  materials?: Material[];
  sessions?: StudySession[];
  onOpenSession?: (id: string) => void;
}

export function SemesterRoadmapView({
  plan,
  onEditPlan,
  onStartStep,
  onFinishExam,
  onReviewExam,
  busy = false,
  materials = [],
  sessions = [],
  onOpenSession,
}: SemesterRoadmapViewProps) {
  const [now, setNow] = useState(() => new Date());
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState('');
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  // Render today's plan even while a network refresh is pending or has failed.
  const currentPlan = plan.roadmap[0]?.date === localDate(now) ? plan : buildSemesterSchedule(plan, plan.dailyMinutes || 30, now).semesterPlan;
  const { stageLabel, breaks, roadmap, courses } = currentPlan;

  // Calculate days until earliest exam
  const { upcoming: sortedExams, elapsed } = semesterExamTimeline(currentPlan, now);
  const lastExam = elapsed[0];
  const nextExam = sortedExams[0];
  const daysUntilNextExam = nextExam
    ? daysToExam(nextExam.date, now)
    : null;

  // Find next actionable study topic
  const today = roadmap.find(d => d.date === localDate(now));
  const nextStudyDay = today?.type === 'study' || today?.type === 'buffer' ? today : undefined;
  const activeTopic = nextStudyDay?.topics?.[0] || 'Core Review';
  const activeCourse = nextStudyDay?.course || nextExam?.course || courses[0]?.course || 'General';

  const context = plannedSessionContext(activeCourse, activeTopic, materials, sessions, now);

  const defaultStep: StudyPlanStep = {
    materialId: context.material?.id || '',
    topic: activeTopic,
    minutes: nextStudyDay?.minutes || 30,
    kind: 'practice',
  };

  const totalRestDays = roadmap.filter((d) => d.type === 'rest').length;

  return (
    <section className="semester-roadmap-view" aria-label="Active Semester Study Plan">
      {/* Top Banner Card */}
      <div className="roadmap-hero-card">
        <div className="roadmap-hero-header">
          <div className="hero-status-pill">
            <Sparkles size={14} className="hero-sparkle" />
            <span>SEMESTER PLAN ACTIVE · {stageLabel.toUpperCase()}</span>
          </div>
          <button
            type="button"
            className="edit-plan-link"
            onClick={onEditPlan}
            disabled={busy}
            title="Adjust your semester position, exams, or break pacing"
          >
            <Edit3 size={14} />
            <span>Adjust Plan & Exams</span>
          </button>
        </div>

        <div className="roadmap-hero-main">
          <div className="hero-headline">
            <h2>{nextStudyDay ? context.completed ? "Today’s practice is recorded." : context.pending ? "Pick up where you left off." : "Your next step is ready." : today?.type === "exam" ? "Today is exam day. Keep it light." : "Today is for rest. Your plan is ready for tomorrow."}</h2>
            <p>
              {lastExam ? <>The revision deadline for <strong>{lastExam.title}</strong> has passed or been marked finished. Unfinished work stays saved; it is not counted as completed. {nextExam ? <>Your plan now focuses on <strong>{nextExam.title}</strong>.</> : 'Your plan now follows a steady study routine. Add your next exam when you know the date.'}</> : <>Curve is pacing your study blocks across <strong>{courses.map((c) => c.course).join(', ')}</strong> with break-respectful rest intervals so you reach exam day ready, not exhausted.</>}
            </p>
          </div>

          {nextExam && (
            <div className="exam-countdown-box">
              <span className="countdown-eyebrow">NEXT UPCOMING EXAM</span>
              <div className="countdown-val">
                <span className="days-num">{daysUntilNextExam}</span>
                <span className="days-label">
                  {daysUntilNextExam === 1 ? 'day away' : 'days away'}
                </span>
              </div>
              <strong className="exam-name">{nextExam.title}</strong>
              <span className="exam-meta">
                {new Date(`${nextExam.date}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })} · {nextExam.course}
              </span>
              {nextExam.date === localDate(now) && onFinishExam && <button type="button" className="learn-button subtle" disabled={busy || finishing} onClick={async () => {
                setFinishing(true); setFinishError('');
                try { await onFinishExam(nextExam.id); }
                catch { setFinishError('Could not update your exam. Please try again.'); }
                finally { setFinishing(false); }
              }}>{finishing ? 'Updating plan…' : 'Exam finished'}</button>}
              {finishError && <p role="alert">{finishError}</p>}
            </div>
          )}
        </div>

        {context.completed && nextStudyDay && <p role="status">Your practice is saved. Review your results to see what needs attention, then take a break.</p>}

        {/* Primary Today Action Card */}
        <div className="today-action-card">
          <div className="action-details">
            <span className="action-badge">{context.completed && nextStudyDay ? 'TODAY’S PRACTICE COMPLETE' : "TODAY'S FOCUSED SESSION"}</span>
            <h3>{nextStudyDay ? activeTopic : today?.title}</h3>
            <p>
              {nextStudyDay ? `${activeCourse} · ${defaultStep.minutes} minutes of spaced practice & retrieval.` : 'Protect your downtime. Curve has already scheduled your next study block.'}
            </p>
          </div>
          <button
            type="button"
            className="learn-button dark launch-action-btn"
            onClick={() => {
              const saved = context.completed || context.pending;
              if (nextStudyDay && saved && onOpenSession) onOpenSession(saved.id);
              else if (nextStudyDay) onStartStep(defaultStep);
              else onEditPlan();
            }}
            disabled={busy}
          >
            <Play size={16} fill="currentColor" />
            <span>{nextStudyDay ? context.completed && onOpenSession ? "Review today’s results" : context.pending && onOpenSession ? "Resume today’s session" : "Start today’s session" : "Review my plan"}</span>
          </button>
        </div>
      </div>

      {lastExam && <div className="pending-session-banner exam-checkin-banner">
        <div><strong>How did {lastExam.title} go?</strong><p>Review what felt difficult, add your result when it’s available, or change the date if it was postponed.</p></div>
        {onReviewExam && <button type="button" className="learn-button subtle" disabled={busy} onClick={() => onReviewExam(lastExam.id)}>Review exam & gaps</button>}
        <button type="button" className="learn-button subtle" disabled={busy} onClick={onEditPlan}>Update exams</button>
      </div>}

      {!lastExam && <div className="pending-session-banner">
        <p>What has been taught since we last planned? Any new or recently finished exams?</p>
        <button type="button" className="learn-button subtle" onClick={onEditPlan} disabled={busy}>Update topics & exams</button>
      </div>}

      {/* Enlisted Exams Row */}
      <div className="enlisted-exams-container">
        <div className="section-mini-header">
          <div className="flex-title">
            <Flame size={16} className="text-amber" />
            <h4>Upcoming Exams ({sortedExams.length})</h4>
          </div>
          <span className="break-respectful-note">
            <Coffee size={14} /> {totalRestDays} scheduled rest days in next 14 days
          </span>
        </div>

        <div className="exams-badges-scroll">
          {sortedExams.map((ex) => {
            const daysAway = daysToExam(ex.date, now);
            return (
              <div key={ex.id} className="exam-badge-card">
                <div className="exam-badge-top">
                  <span className="badge-course">{ex.course}</span>
                  <span className="badge-days-pill">
                    {daysAway === 0 ? 'Today' : `${daysAway}d`}
                  </span>
                </div>
                <strong className="badge-title">{ex.title}</strong>
                <span className="badge-date">
                  {new Date(`${ex.date}T12:00:00`).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <div className="badge-topics-preview">
                  {ex.topics.slice(0, 2).map((t) => (
                    <span key={t} className="badge-topic-tag">
                      {t}
                    </span>
                  ))}
                  {ex.topics.length > 2 && (
                    <span className="badge-topic-more">+{ex.topics.length - 2}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 14-Day Break-Respectful Timeline Track */}
      <div className="roadmap-timeline-section">
        <div className="section-mini-header">
          <div className="flex-title">
            <Calendar size={16} />
            <h4>14-Day Break-Respectful Schedule</h4>
          </div>
          <span className="break-tagline">
            Includes {breaks.preExamBufferHours}h pre-exam buffers & weekly recharge days
          </span>
        </div>

        <div className="timeline-grid">
          {roadmap.slice(0, 14).map((day, idx) => {
            const isToday = idx === 0;
            return (
              <div
                key={day.date + idx}
                className={`timeline-day-card ${day.type} ${isToday ? 'is-today' : ''}`}
              >
                <div className="day-header">
                  <span className="day-name">{day.dayLabel}</span>
                  <span className="day-date">{day.date.slice(5)}</span>
                </div>

                <div className="day-content">
                  {day.type === 'exam' ? (
                    <div className="exam-day-content">
                      <span className="indicator-pill exam">TARGET</span>
                      <strong>{day.title}</strong>
                      <span className="sub-text">{day.course}</span>
                    </div>
                  ) : day.type === 'rest' ? (
                    <div className="rest-day-content">
                      <span className="indicator-pill rest">
                        <Coffee size={12} /> REST
                      </span>
                      <strong>Recharge Day</strong>
                      <span className="sub-text">Consolidate concepts</span>
                    </div>
                  ) : day.type === 'buffer' ? (
                    <div className="buffer-day-content">
                      <span className="indicator-pill buffer">
                        <ShieldCheck size={12} /> BUFFER
                      </span>
                      <strong>Light Review</strong>
                      <span className="sub-text">{day.minutes}m spaced recall</span>
                    </div>
                  ) : (
                    <div className="study-day-content">
                      <span className="indicator-pill study">STUDY</span>
                      <strong className="study-topic-name">
                        {day.topics?.[0] || 'Core Practice'}
                      </strong>
                      <span className="sub-text">{day.minutes}m focus session</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
