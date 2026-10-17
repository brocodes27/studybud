import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link } from 'react-router-dom';
import { BookOpen, CalendarDays, FileText, Home, Settings2, TrendingUp } from 'lucide-react';
import { HomeView } from '../src/learning/agent/DashboardHome';
import { CurveMark } from '../src/learning/Preview';
import { SessionExitDialog } from '../src/learning/SessionExitDialog';
import { MaterialFirstSetup, MaterialJourney } from '../src/learning/agent/MaterialJourney';
import { buildSemesterSchedule, localDate } from '../src/learning/agent/semesterPlanner';
import type { Material, StudySession } from '../src/learning/model';
import type { SemesterPlan } from '../src/learning/agent/contracts';
import '../src/index.css';
import '../src/learning/learning.css';
import '../src/learning/agent/workspace.css';
import '../src/learning/agent/dashboard.css';
import '../src/learning/agent/focus.css';
import '../src/learning/agent/study-flow.css';
const now = new Date();
const offset = (days: number) => { const d = new Date(now); d.setDate(d.getDate() + days); return localDate(d); };
const materials: Material[] = [
  { id: 'calculus', title: 'Limits, continuity & derivatives', created_at: now.toISOString(), extracted_text: 'Limits describe the value a function approaches.', metadata: { course: 'Calculus II', confirmed: true, topics: ['Limits and continuity', 'Partial derivatives'], page_count: 12, pages: [{ page: 1, text: 'Limits and continuity. A limit describes the value a function approaches as its input approaches a point. Partial derivatives measure change along one variable.' }] } },
  { id: 'physics', title: 'Motion and the laws behind it', created_at: now.toISOString(), extracted_text: 'Newtonian mechanics and energy conservation.', metadata: { course: 'Physics', confirmed: true, topics: ['Newton’s laws', 'Energy conservation'], page_count: 24 } },
  { id: 'chemistry', title: 'A guide to organic reactions', created_at: now.toISOString(), extracted_text: 'Nucleophilic substitution and reaction mechanisms.', metadata: { course: 'Organic chemistry', confirmed: true, topics: ['SN2 mechanisms', 'Stereochemistry'], page_count: 18 } },
];
const basePlan = buildSemesterSchedule({ dailyMinutes: 30, stage: 'mid', stageLabel: 'Mid-semester', courses: materials.map(m => ({ course: m.metadata.course!, taughtTopics: m.metadata.topics! })), exams: [{ id: 'exam1', course: 'Calculus II', title: 'Calculus midterm', date: offset(9), topics: materials[0].metadata.topics! }], breaks: { restDaysPerWeek: 1, preferredRestDays: ['Sunday'], preExamBufferHours: 48 }, roadmap: [], createdAt: now.toISOString(), updatedAt: now.toISOString() }, 30).semesterPlan;
const sessions: StudySession[] = [1, 2, 4].map((days, i) => ({ id: `session${i}`, material_id: 'calculus', mode: 'checkpoint', topic: 'Limits and continuity', questions: [], answers: {}, hints: [], results: [{ question_id: 'q1', correct: true, expected: 'A', explanation: 'Correct', quote: '', page: 1, assisted: false }], created_at: `${offset(-days)}T12:00:00`, completed_at: `${offset(-days)}T12:00:00` }));
function Preview() {
  const [mode, setMode] = useState(new URLSearchParams(location.search).get('state') || 'ready');
  const [plan, setPlan] = useState<SemesterPlan>(basePlan);
  const [message, setMessage] = useState('');
  const [review, setReview] = useState(false);
  const [failSave, setFailSave] = useState(false);
  const [searchProof, setSearchProof] = useState('');
  const [showExit, setShowExit] = useState(false);
  const [exitError, setExitError] = useState('');
  return <div className="learn agent-workspace-container is-dashboard" data-assistant-open="false" data-mobile-view="workspace">
    <header className="agent-app-header"><Link className="learn-brand" to="/tests/learning-flow.html"><CurveMark /><span className="rail-brand-name">curve</span></Link><nav aria-label="Workspace">{[{icon: Home, name: 'Today'}, {icon: BookOpen, name: 'Library'}, {icon: FileText, name: 'Courses'}, {icon: TrendingUp, name: 'Progress'}, {icon: CalendarDays, name: 'Topic map'}].map(({icon: Icon, name}) => <a href="#preview-state" key={name} className={name === 'Today' ? 'active' : ''} onClick={() => setMessage(`${name} navigation preview`)}><Icon size={20} /><span>{name}</span></a>)}</nav><a href="#preview-state" className="agent-account"><Settings2 size={17} /><span className="user-avatar">A</span></a></header>
    <main className="agent-working-pane"><header className="workspace-toolbar"><span>Today</span><div style={{display:'flex',gap:10,alignItems:'center',marginLeft:'auto'}}><label htmlFor="preview-state">Sample state</label><select id="preview-state" value={mode} onChange={e => {setMode(e.target.value);setReview(false);setMessage('');}}>{['ready','empty','loading','error','setup','exit','semester'].map(m => <option key={m}>{m}</option>)}</select><label><input type="checkbox" checked={failSave} onChange={e=>setFailSave(e.target.checked)} /> Simulate save error</label></div></header>
    <div className="agent-view-canvas"><p style={{fontSize:11,color:'var(--learn-muted)',marginBottom:18}}>Interactive preview · sample data only · no account writes</p>
      {message && <p role="status" style={{padding:16,background:'var(--learn-mint)',borderRadius:12,marginBottom:20}}>{message}</p>}
      {searchProof && <p>{searchProof}</p>}
      {mode === 'exit' && <button className="learn-button dark" id="preview-exit" onClick={() => {setExitError('');setShowExit(true);}}>Pause sample session</button>}
      {showExit && <SessionExitDialog answered={2} total={5} busy={false} error={exitError} onClose={()=>setShowExit(false)} onSaveExit={()=>{if(failSave)setExitError('Your draft could not save. Please try again.');else{setShowExit(false);setMessage('Draft saved. Session was not graded.');}}} />}
      {mode === 'semester' ? <MaterialFirstSetup
        materials={[
          { ...materials[0], id: 'semester-1', title: 'Semester 1 curriculum', metadata: { ...materials[0].metadata, semester: 'Semester 1', topics: ['Old semester topic'] } },
          { ...materials[0], id: 'semester-2', title: 'Semester 2 curriculum', metadata: { ...materials[0].metadata, semester: 'Semester 2', topics: ['Integration', 'Series'] } },
        ]}
        onManualSetup={() => setMode('setup')}
        onConfirmMaterial={async material => { if (failSave) throw new Error('Sample save failure. Your choices are still here.'); setMessage(`Confirmed ${material.metadata.semester}: ${material.metadata.confirmed_topics?.join(', ')}`); }}
        onSavePlan={async next => { setPlan(next); setMode('ready'); setMessage(`Saved ${next.semester} · ${next.stageLabel}: ${next.courses.flatMap(c => c.taughtTopics).join(', ')}`); }}
      /> : review ? <MaterialJourney semester="Semester 2" stage="mid" material={materials[0]} initialDailyMinutes={20} busy={false} onBack={() => setReview(false)} onConfirmMaterial={async () => { if(failSave) throw new Error('Sample save failure. Your choices are still here.'); }} onSave={async next => {setPlan(next);setMode('ready');setReview(false);setMessage('Your study plan is ready. Sample confirmation saved.');}} /> : <HomeView firstName="Aryan" materials={mode === 'empty' ? [] : materials} sessions={mode === 'empty' ? [] : sessions} loading={mode === 'loading'} error={mode === 'error' ? 'Your library could not load. Your saved work is safe.' : ''} semesterPlan={['empty','setup'].includes(mode) ? null : plan} onRetry={() => setMode('ready')} onUploadClick={() => {setReview(true);setMessage('Sample upload ready for topic review.');}} onOpenMaterial={() => setReview(true)} onOpenSession={() => setMessage('Saved session selected. Production opens the persisted session.')} onPromptClick={setMessage} onStartPlanStep={step => setMessage(`Ready to study: ${step.topic}. Production starts the saved learning activity.`)} onSaveSemesterPlan={async next => {setPlan(next);setMode('ready');}} onLoadMaterial={async m => m} onConfirmMaterial={async () => {if(failSave) throw new Error('Sample save failure. Your choices are still here.');setSearchProof('Topics confirmed against the sample source.');}} />}
    </div></main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><Preview /></BrowserRouter>);
