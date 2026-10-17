import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpen, Check, Clock3, FileText, Plus, Search, X } from 'lucide-react';
import { independentAccuracy, weeklyActivity, type Material, type StudySession } from '../model';
import { StudyDoodle } from '../StudyDoodle';
import type { EnlistedExam, SemesterPlan, StudyPlan, StudyPlanStep } from './contracts';
import { buildSemesterSchedule } from './semesterPlanner';
import { SemesterIntake } from './SemesterIntake';
import { SemesterRoadmapView } from './SemesterRoadmapView';
import { MaterialFirstSetup } from './MaterialJourney';
import './dashboard.css';
import './focus.css';
import './study-flow.css';

export function HomeView({
  materials, sessions, firstName, loading = false, error = '', busy = false,
  semesterPlan = null, initialCourses = [], onSaveSemesterPlan, onStartPlanStep,
  onReviewExam, onRetry, onOpenMaterial, onOpenSession, onUploadClick, onPromptClick,
  stageQueue, onConfirmMaterial, onLoadMaterial, researchDesk,
}: {
  materials: Material[];
  sessions: StudySession[];
  firstName: string;
  loading?: boolean;
  error?: string;
  busy?: boolean;
  semesterPlan?: SemesterPlan | null;
  initialCourses?: string[];
  onSaveSemesterPlan?: (plan: SemesterPlan, studyPlan: StudyPlan) => Promise<void> | void;
  onStartPlanStep?: (step: StudyPlanStep) => void;
  onReviewExam?: (exam: EnlistedExam) => void;
  onRetry: () => void;
  onOpenMaterial: (material: Material) => void;
  onOpenSession: (sessionId: string) => void;
  onUploadClick: () => void;
  onPromptClick: (prompt: string) => void;
  stageQueue?: ReactNode;
  researchDesk?: ReactNode;
  onConfirmMaterial: (material: Material) => Promise<void>;
  onLoadMaterial?: (material: Material) => Promise<Material>;
}) {
  const [query, setQuery] = useState('');
  const [isEditingSemester, setIsEditingSemester] = useState(false);
  const pending = sessions.find(s => !s.completed_at && s.questions?.length);
  const accuracy = independentAccuracy(sessions);
  const activity = weeklyActivity(sessions);
  const weeklyTotal = activity.reduce((sum, day) => sum + day.practice + day.checkpoint, 0);
  const topicCount = materials.filter(m => m.metadata.confirmed).reduce((sum, m) => sum + (m.metadata.topics?.length || 0), 0);
  const ready = topicCount > 0;
  const visible = materials.filter(m => `${m.title} ${m.metadata.course || ''} ${(m.metadata.topics || []).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  const courses = initialCourses.length ? initialCourses : [...new Set(materials.map(m => m.metadata.course).filter(Boolean))] as string[];

  return (
    <div className="curve-dashboard study-home" aria-busy={loading}>
      {researchDesk || <header className="study-home-heading">
        <div>
          <p className="flow-eyebrow">Your learning, a little clearer</p>
          <h1>A little progress, {firstName}.</h1>
          <p>One good session is a good place to start.</p>
        </div>
        <button type="button" className="learn-button subtle flow-upload" disabled={busy || loading} onClick={onUploadClick}>
          <Plus size={16} /> Add material
        </button>
      </header>}
      {error ? (
        <div className="dash-error" role="alert"><p>{error}</p><button type="button" className="learn-button subtle" onClick={onRetry}>Try again</button></div>
      ) : loading ? (
        <div className="dash-skeleton" role="status"><span className="sr-only">Loading your study space…</span><div /><div /><div /></div>
      ) : (
        <>
          <div className="flow-snapshot" aria-label="Your learning at a glance">
            <div><span className="flow-stat-icon"><BookOpen size={16} /></span><p><strong>{courses.length}</strong><span>subject{courses.length === 1 ? '' : 's'} in your space</span></p></div>
            <div><span className="flow-stat-icon"><Check size={16} /></span><p><strong>{weeklyTotal}</strong><span>session{weeklyTotal === 1 ? '' : 's'} this week</span></p></div>
            <div><span className="flow-stat-icon"><FileText size={16} /></span><p><strong>{topicCount}</strong><span>confirmed topic{topicCount === 1 ? '' : 's'}</span></p></div>
          </div>
          {stageQueue}
          {pending && <section className="flow-resume" aria-label="Saved session">
            <Clock3 size={18} /><div><span>Right where you left off</span><strong>{pending.topic}</strong></div>
            <button type="button" className="flow-text-button" disabled={busy} onClick={() => onOpenSession(pending.id)}>Resume <ArrowRight size={16} /></button>
          </section>}
          {semesterPlan && !isEditingSemester ? (
            <SemesterRoadmapView
              plan={semesterPlan} materials={materials} sessions={sessions} busy={busy}
              onOpenSession={onOpenSession} onEditPlan={() => setIsEditingSemester(true)}
              onStartStep={step => onStartPlanStep ? onStartPlanStep(step) : onPromptClick(`Let's study ${step.topic}`)}
              onFinishExam={onSaveSemesterPlan ? async examId => {
                const updated = buildSemesterSchedule({ ...semesterPlan, exams: semesterPlan.exams.map(exam => exam.id === examId ? { ...exam, isRecent: true } : exam) }, semesterPlan.dailyMinutes || 30);
                await onSaveSemesterPlan(updated.semesterPlan, updated.studyPlan);
              } : undefined}
              onReviewExam={examId => {
                const exam = semesterPlan.exams.find(e => e.id === examId);
                if (!exam) return;
                if (onReviewExam) onReviewExam(exam);
                else onPromptClick(`Help me review ${exam.title} (${exam.course}) and identify gaps. Use my recorded results to understand what needs attention.`);
              }}
            />
          ) : !semesterPlan && !isEditingSemester ? (
            <MaterialFirstSetup materials={materials} busy={busy} onUploadClick={onUploadClick}
              onConfirmMaterial={onConfirmMaterial} onLoadMaterial={onLoadMaterial}
              onSavePlan={async (plan, studyPlan) => { await onSaveSemesterPlan?.(plan, studyPlan); }}
              onManualSetup={() => setIsEditingSemester(true)} />
          ) : (
            <SemesterIntake materials={materials} initialCourses={courses} initialPlan={semesterPlan}
              onSavePlan={async (plan, studyPlan) => { await onSaveSemesterPlan?.(plan, studyPlan); setIsEditingSemester(false); }}
              onCancel={() => setIsEditingSemester(false)}
              onUploadSyllabusClick={onUploadClick} busy={busy} />
          )}
          <div className="flow-support-grid">
            <section className="flow-library" aria-labelledby="flow-library-title">
              <header className="flow-section-heading"><div><p className="flow-eyebrow">Made from your materials</p><h2 id="flow-library-title">Your bookshelf</h2></div><Link to="/library" className="flow-text-button">View all <ArrowUpRight size={15} /></Link></header>
              {materials.length ? <>
                <div className="flow-library-search"><Search size={16} /><input aria-label="Search your bookshelf" placeholder="Find a course or topic…" value={query} onChange={e => setQuery(e.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={15} /></button>}</div>
                <div className="flow-bookshelf">{visible.slice(0, 4).map((material, index) => (
                  <button type="button" className={`flow-book tone-${index % 4}`} key={material.id} disabled={busy} onClick={() => onOpenMaterial(material)}>
                    <span className="flow-book-cover"><FileText size={20} strokeWidth={1.4} /><span className="flow-book-lines" aria-hidden="true"><i /><i /><i /></span><small>{material.metadata.page_count ? `${material.metadata.page_count} pages` : 'Course material'}</small></span>
                    <span className="flow-book-content"><span className="flow-book-course">{material.metadata.course || 'Your notes'}</span><strong>{material.title}</strong><span className="flow-book-meta">{material.metadata.confirmed ? `${material.metadata.topics?.length || 0} topics · Open material` : 'Review and confirm topics'} <ArrowUpRight size={14} /></span></span>
                  </button>
                ))}</div>
                {!visible.length && <p className="flow-no-results" role="status">No materials match “{query}”. Try a course name or topic.</p>}
              </> : <div className="flow-library-empty"><StudyDoodle kind="notebook" /><h3>Your first course starts here.</h3><p>Add a syllabus, notes, or slides. We’ll help you find your next step.</p><button type="button" className="flow-text-button" disabled={busy} onClick={onUploadClick}>Add your first material <Plus size={15} /></button></div>}
            </section>
            <section className="flow-progress" aria-labelledby="flow-progress-title">
              <header className="flow-section-heading"><div><p className="flow-eyebrow">Small steps add up</p><h2 id="flow-progress-title">This week</h2></div><Link to="/progress" className="icon-button" aria-label="View progress"><ArrowUpRight size={18} /></Link></header>
              <div className="flow-week-chart" role="img" aria-label={activity.map(d => `${d.label}: ${d.practice + d.checkpoint} sessions`).join('; ')}>{activity.map((day, i) => <div key={i} aria-hidden="true"><span style={{ '--bar-height': `${Math.max(3, ((day.practice + day.checkpoint) / Math.max(1, ...activity.map(d => d.practice + d.checkpoint))) * 72)}px` } as React.CSSProperties} className={day.practice + day.checkpoint ? 'has-activity' : ''} /><small>{day.label.slice(0, 1)}</small></div>)}</div>
              <div className="flow-accuracy"><p><strong>{accuracy === null ? '—' : `${accuracy}%`}</strong><span>Independent accuracy</span></p><p>{accuracy === null ? 'Your first independent check gives you a starting point.' : 'From your checks, answered without hints.'}</p></div>
              <button type="button" className="flow-text-button" disabled={busy || !ready} onClick={() => onPromptClick('Start an independent check on my notes.')}>Check your understanding <ArrowRight size={15} /></button>
            </section>
          </div>
          <footer className="flow-home-footer"><span>A little more clarity. A little less cramming.</span><Link to="/map">Explore your learning stages <ArrowUpRight size={13} /></Link></footer>
        </>
      )}
    </div>
  );
}
