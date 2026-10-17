import { useEffect, useState } from 'react';
import { buildSemesterSchedule, localDate, semesterExamTimeline } from './semesterPlanner';
import type { Material, StudySession } from '../model';
import { dailyFocus } from './dailyFocus';
import { ArrowRight, Edit3 } from 'lucide-react';
import { StudyDoodle } from '../StudyDoodle';
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
  const { roadmap, courses } = currentPlan;
  const focus = dailyFocus(currentPlan, materials, sessions, now);

  // Calculate days until earliest exam
  const { upcoming: sortedExams, elapsed } = semesterExamTimeline(currentPlan, now);
  const lastExam = elapsed[0];
  const nextExam = sortedExams[0];

  // Find next actionable study topic
  const today = roadmap.find(d => d.date === localDate(now));
  const nextStudyDay = today?.type === 'study' || today?.type === 'buffer' ? today : undefined;
  const activeTopic = focus?.topic || nextStudyDay?.topics?.[0] || 'Core Review';
  const activeCourse = nextStudyDay?.course || nextExam?.course || courses[0]?.course || 'General';

  const context = focus?.context || { material: undefined, pending: undefined, completed: undefined };

  const defaultStep: StudyPlanStep = {
    materialId: context.material?.id || '',
    topic: activeTopic,
    minutes: nextStudyDay?.minutes || 30,
    kind: 'practice',
  };

  return (
    <section className="semester-roadmap-view" aria-label="Active Semester Study Plan">
      {plan.semester && <p className="journey-small">{plan.semester} · {plan.stageLabel} · Confirmed syllabus topics</p>}
      {/* Top Banner Card */}
      <div className="roadmap-hero-card">
        <div className="roadmap-hero-header">
          <div className="hero-status-pill">
            <span>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
          <button
            type="button"
            className="edit-plan-link"
            onClick={onEditPlan}
            disabled={busy}
            title="Adjust your semester position, exams, or break pacing"
          >
            <Edit3 size={14} />
            <span>Edit plan</span>
          </button>
        </div>

        <div className="daily-focus-story">
          <StudyDoodle kind="orbit" className="flow-focus-doodle" />
          <p className="daily-focus-eyebrow">{nextStudyDay ? `${activeCourse} · ${defaultStep.minutes} min${today?.type === 'buffer' ? ' · Light review' : ''}` : today?.type === 'exam' ? 'Exam day' : 'Rest day'}</p>
          <h2>{nextStudyDay ? context.completed ? 'You showed up. Now let it settle.' : context.pending ? `Pick up ${activeTopic}.` : `Let’s work on ${activeTopic}.` : today?.type === 'exam' ? 'You’ve got this.' : 'A little space to recharge.'}</h2>
          <p className="daily-focus-reason">{focus?.reason || (today?.type === 'exam' ? 'Your revision stays saved. Come back after your exam to review how it went.' : 'No study session scheduled today. Your next study day is already in the plan.')}</p>
          {focus?.exam && <p className="daily-focus-deadline">{focus.exam.title} · {new Date(`${focus.exam.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>}
          {context.completed && focus?.result && <div className="daily-result-receipt"><strong>{focus.result.correct}/{focus.result.total}</strong><span>correct{focus.result.assisted ? ` · ${focus.result.assisted} with help` : ''}{focus.result.missed ? ` · ${focus.result.missed} to revisit` : ''}</span></div>}
          {nextStudyDay ? <div className="daily-focus-actions">
            <button type="button" className="learn-button dark" disabled={busy} onClick={() => {
              const saved = context.completed || context.pending;
              if (saved && onOpenSession) onOpenSession(saved.id);
              else onStartStep(defaultStep);
            }}>{busy ? 'Preparing your session…' : context.completed ? 'Review my results' : context.pending ? 'Continue session' : 'Let’s begin'}<ArrowRight size={16} /></button>
            <span>{context.material ? `From ${context.material.title}` : 'We’ll set up a topic check first.'}</span>
          </div> : <button type="button" className="edit-plan-link" onClick={onEditPlan}>View or change my plan <ArrowRight size={14} /></button>}
          {today?.type === 'exam' && nextExam && <div className="daily-exam-checkin"><strong>{today.title}</strong>{onFinishExam && <button type="button" className="learn-button dark" disabled={busy || finishing} onClick={async () => {
            setFinishing(true); setFinishError('');
            try { await onFinishExam(nextExam.id); }
            catch { setFinishError('Could not update your exam. Please try again.'); }
            finally { setFinishing(false); }
          }}>{finishing ? 'Updating plan…' : 'Exam finished'}</button>}{finishError && <p role="alert">{finishError}</p>}</div>}
        </div>
      </div>

      {lastExam && <div className="pending-session-banner exam-checkin-banner">
        <div><strong>How did {lastExam.title} go?</strong><p>{nextExam ? `Your plan now focuses on ${nextExam.title}.` : 'Your plan has moved back to regular study.'} Unfinished revision stays saved.</p></div>
        {onReviewExam && <button type="button" className="learn-button subtle" disabled={busy} onClick={() => onReviewExam(lastExam.id)}>Review exam</button>}
        <button type="button" className="edit-plan-link" disabled={busy} onClick={onEditPlan}>Change date</button>
      </div>}

      <div className="plan-update-row">
        <span>New topics or exams?</span>
        <button type="button" className="edit-plan-link" onClick={onEditPlan} disabled={busy}>Update plan <ArrowRight size={14} /></button>
      </div>

      <details className="semester-schedule">
        <summary><span>Next 14 days</span><span>{sortedExams.length} upcoming exam{sortedExams.length === 1 ? '' : 's'}</span></summary>
        {sortedExams.length > 0 && <div className="schedule-exams" aria-label="Upcoming exams">{sortedExams.map(ex => <div key={ex.id}>
          <strong>{ex.title}</strong><span>{ex.course} · {new Date(`${ex.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>)}</div>}
      {/* 14-Day Break-Respectful Timeline Track */}
      <div className="roadmap-timeline-section">
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
                      <span className="indicator-pill exam">Exam</span>
                      <strong>{day.title}</strong>
                      <span className="sub-text">{day.course}</span>
                    </div>
                  ) : day.type === 'rest' ? (
                    <div className="rest-day-content">
                      <span className="indicator-pill rest">
                        Rest
                      </span>
                      <strong>Rest day</strong>

                    </div>
                  ) : day.type === 'buffer' ? (
                    <div className="buffer-day-content">
                      <span className="indicator-pill buffer">
                        Review
                      </span>
                      <strong>Light review</strong>
                      <span className="sub-text">{day.minutes}m spaced recall</span>
                    </div>
                  ) : (
                    <div className="study-day-content">
                      <span className="indicator-pill study">Study</span>
                      <strong className="study-topic-name">
                        {(isToday && focus ? focus.topic : day.topics?.[0]) || 'Core Practice'}
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
      </details>
    </section>
  );
}
