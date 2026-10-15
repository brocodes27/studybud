// Isolated dashboard fixture: no authentication, network writes, or real student data.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { HomeView } from '../src/learning/agent/DashboardHome';
import { buildSemesterSchedule, localDate } from '../src/learning/agent/semesterPlanner';
import type { SemesterPlan } from '../src/learning/agent/contracts';
import type { StudySession } from '../src/learning/model';
import '../src/index.css';
import '../src/learning/learning.css';
import '../src/learning/agent/workspace.css';

const now = new Date();
const date = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
function scenario(offset: number, next = false): SemesterPlan {
  const plan: SemesterPlan = {
    stage: 'mid', stageLabel: 'Mid-Semester', dailyMinutes: 30,
    courses: [{ course: 'Mathematics', taughtTopics: ['Integration', 'Limits'] }, { course: 'Physics', taughtTopics: ['Optics'] }],
    exams: [{ id: 'math', title: 'Calculus midterm', course: 'Mathematics', date: localDate(date(offset)), topics: ['Integration'] },
      ...(next ? [{ id: 'physics', title: 'Physics midterm', course: 'Physics', date: localDate(date(1)), topics: ['Optics'] }] : [])],
    breaks: { restDaysPerWeek: 0, preExamBufferHours: 48 }, roadmap: [], createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
  return buildSemesterSchedule(plan, 30, date(-2)).semesterPlan;
}
const pending: StudySession = { id: 'saved', material_id: 'notes', mode: 'practice', topic: 'Integration', questions: [{ id: 'q', topic: 'Integration', question: 'Integrate x', options: ['x²/2', 'x²'], page: 1 }], answers: {}, hints: [], results: null, created_at: date(-2).toISOString(), completed_at: null };
function Fixture() {
  const [plan, setPlan] = useState(() => scenario(-1, true));
  const [message, setMessage] = useState('');
  const [failSave, setFailSave] = useState(false);
  const [finished, setFinished] = useState(false);
  return <MemoryRouter><div className="learn" style={{ padding: 20 }}>
    <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }} aria-label="Fixture controls">
      <button onClick={() => setPlan(scenario(-1, true))}>Past exam, next exam tomorrow</button>
      <button onClick={() => setPlan(scenario(-1))}>All exams past</button>
      <button onClick={() => setPlan(scenario(0))}>Exam today</button>
      <button onClick={() => setFailSave(!failSave)}>Save failure: {failSave ? 'on' : 'off'}</button>
      <button onClick={() => setFinished(!finished)}>Today’s practice: {finished ? "completed" : "saved"}</button>
    </nav>
    {message && <p role="status">{message}</p>}
    <HomeView firstName="Student" materials={[{ id: 'physics-notes', title: 'Physics syllabus', created_at: now.toISOString(), extracted_text: null, metadata: { course: 'Physics', confirmed: true, topics: ['Optics'] } }]} sessions={[pending, { ...pending, id: 'optics', material_id: 'physics-notes', topic: 'Optics', completed_at: finished ? now.toISOString() : null }]} semesterPlan={plan}
      onSaveSemesterPlan={async updated => { if (failSave) throw new Error('Fixture save failure'); setPlan(updated); }}
      onReviewExam={exam => setMessage(`Exam review opened: ${exam.title}`)}
      onStartPlanStep={step => setMessage(`Study session: ${step.topic}`)}
      onRetry={() => {}} onOpenMaterial={() => {}} onOpenSession={id => setMessage(`Opened saved session: ${id}`)}
      onUploadClick={() => {}} onPromptClick={setMessage} />
  </div></MemoryRouter>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
