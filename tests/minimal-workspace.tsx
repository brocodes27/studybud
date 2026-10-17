// Real workspace UI with a local transport and fictional learning data.
import React from 'react';
import type { StudySession } from '../src/learning/model';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextType } from '../src/contexts/AuthContext';
import { supabase } from '../src/lib/supabase';
import { buildSemesterSchedule, localDate } from '../src/learning/agent/semesterPlanner';
import { emptyWorkspace, type SemesterPlan, type WorkspaceSnapshot } from '../src/learning/agent/contracts';
import '../src/index.css';
import '../src/learning/learning.css';
const now = new Date();
const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12);
const input: SemesterPlan = {
  stage: 'mid', stageLabel: 'Mid-semester', dailyMinutes: 30,
  courses: [{ course: 'Physics', taughtTopics: ['Optics', 'Waves'] }, { course: 'Mathematics', taughtTopics: ['Integration'] }],
  exams: [{ id: 'physics-exam', title: 'Physics midterm', course: 'Physics', date: localDate(tomorrow), topics: ['Optics'] }],
  breaks: { restDaysPerWeek: 1, preExamBufferHours: 48, preferredRestDays: ['Sunday'] }, roadmap: [], createdAt: now.toISOString(), updatedAt: now.toISOString(),
};
const { semesterPlan, studyPlan } = buildSemesterSchedule(input, 30, now);
const snapshot: WorkspaceSnapshot = {
  thread: { id: 'fixture-thread', state: { ...emptyWorkspace(), semesterPlan, plan: studyPlan }, updated_at: now.toISOString() },
  messages: [{ id: 'hello', role: 'assistant', content: 'Your Physics midterm is tomorrow. Today is a short review of optics. Start whenever you’re ready.', created_at: now.toISOString() }],
  research: { enabled: true, status: 'pending' },
};
// Slow-save fixture: the selected activity must render before this request resolves.
const tabTest = new URLSearchParams(window.location.search).get('tabTest');
if (tabTest) snapshot.thread.state.artifacts = [
  { id: 'research-test', kind: 'research', title: 'Slow network research', topic: 'Optics', text: 'This research should appear immediately while the tab selection saves.', sources: [], createdAt: now.toISOString() },
  { id: 'progress-test', kind: 'progress', title: 'Saved progress' },
];
const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12).toISOString();
const question = { id: 'q1', topic: 'Optics', question: 'When light enters glass from air at an angle, which way does it bend?', options: ['Toward the normal', 'Away from the normal', 'It does not bend'], page: 1 };
const results = [{ question_id: 'q1', correct: false, assisted: false, expected: 'Toward the normal', explanation: 'Light slows down in glass, so the refracted ray bends toward the normal.', quote: 'A ray entering a medium with a higher refractive index bends toward the normal.', page: 1 }];
const sessions: StudySession[] = [{ id: 'yesterday', material_id: 'physics-notes', mode: 'practice', topic: 'Optics', questions: [question], answers: { q1: 1 }, hints: [], results, created_at: yesterday, completed_at: yesterday }];
const realFetch = window.fetch.bind(window);
window.fetch = async (resource, options) => {
  const url = new URL(typeof resource === 'string' ? resource : resource instanceof URL ? resource.href : resource.url);
  if (!url.hostname.endsWith('.supabase.co')) return realFetch(resource, options);
  const path = url.pathname;
  let data: unknown = [];
  if (path.endsWith('/curve_study_preferences')) data = { courses: ['Physics', 'Mathematics'], onboarding_answers: { semester_plan: semesterPlan } };
  else if (path.endsWith('/materials')) data = [{ id: 'physics-notes', title: 'Physics · Lecture notes', created_at: now.toISOString(), course: 'Physics', confirmed: true, topics: ['Optics', 'Waves'] }];
  else if (path.endsWith('/curve_material_sessions')) {
    const id = url.searchParams.get('id')?.replace('eq.', '');
    data = id ? sessions.find(session => session.id === id) : sessions;
  } else if (path.endsWith('/material-study')) {
    const request = JSON.parse(String(options?.body || '{}'));
    const session = sessions.find(item => item.id === request.session_id)!;
    if (request.action === 'hint') { session.hints.push(request.question_id); data = { hint: 'Glass has a higher refractive index than air.' }; }
    else if (request.action === 'submit') {
      session.answers = request.answers;
      session.completed_at = new Date().toISOString();
      session.results = [{ ...results[0], correct: request.answers.q1 === 0, assisted: session.hints.includes('q1') }];
      data = session;
    } else { session.answers = request.answers; data = { saved: true }; }
  } else if (path.endsWith('/workspace-agent')) {
    const raw = JSON.parse(String(options?.body || '{}'));
    const request = raw.forwardedProps || raw;
    if (request.tool?.name === 'start_practice' || request.tool?.name === 'resume_session') {
      let id = request.tool.args.sessionId;
      if (!id) { id = 'today-session'; sessions.push({ id, material_id: 'physics-notes', mode: 'practice', topic: 'Optics', questions: [question], answers: {}, hints: [], results: null, created_at: new Date().toISOString(), completed_at: null }); }
      snapshot.thread.state.artifacts = [{ id: 'practice', kind: 'session', title: 'Optics', sessionId: id }];
      snapshot.thread.state.activeId = 'practice';
    }
    if (request.operation === 'activate') {
      if (tabTest) await new Promise(resolve => setTimeout(resolve, 3000));
      if (tabTest === 'failure') return new Response(JSON.stringify({ error: 'Simulated tab save failure' }), { status: 503 });
      snapshot.thread.state.activeId = request.artifactId;
    }
    snapshot.thread.updated_at = new Date().toISOString();
    data = request.operation === 'load' ? snapshot : { snapshot };
  }
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
type SessionResponse = Awaited<ReturnType<typeof supabase.auth.getSession>>;
supabase.auth.getSession = async () => ({ data: { session: { access_token: 'local-fixture-only' } }, error: null } as SessionResponse);
const { AgentWorkspace } = await import('../src/learning/agent/AgentWorkspace');
const auth = { user: { id: 'minimal-ui-fixture', email: 'student@example.test' }, fullName: 'Alex', signOut: async () => undefined } as AuthContextType;
createRoot(document.getElementById('root')!).render(<AuthContext.Provider value={auth}><MemoryRouter><AgentWorkspace /></MemoryRouter></AuthContext.Provider>);
