import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ResearchArrival } from '../src/learning/agent/ResearchArrival';
import { ActivityTabs } from '../src/learning/agent/ActivityTabs';
import { ResearchView } from '../src/learning/agent/AssessmentView';
import type { ResearchArtifact, ResearchStatus } from '../supabase/functions/_shared/learning-workflows';
import '../src/index.css';
import '../src/learning/learning.css';
import '../src/learning/agent/workspace.css';
import '../src/learning/agent/study-flow.css';

const examples: ResearchArtifact[] = [
  { id: 'limits', kind: 'research', topic: 'Limits & continuity', title: 'Making sense of limits', materialId: 'calculus', text: '## Getting close to an idea\nA limit describes the value a function approaches. Explore how one-sided limits agree before deciding whether a limit exists. [1]', sources: [{ title: 'OpenStax · The limit of a function', url: 'https://openstax.org/books/calculus-volume-1/pages/2-2-the-limit-of-a-function' }], createdAt: new Date().toISOString() },
  { id: 'energy', kind: 'research', topic: 'Energy conservation', title: 'Following energy through a system', materialId: 'physics', text: '## Follow the system\nChoose a system boundary before you account for energy transfer. [1]', sources: [{ title: 'OpenStax · Conservation of energy', url: 'https://openstax.org/books/university-physics-volume-1/pages/8-3-conservation-of-energy' }], createdAt: new Date().toISOString() },
  { id: 'reactions', kind: 'research', topic: 'SN2 reaction mechanisms', title: 'One step, two reacting species', materialId: 'chemistry', text: '## Look for the single step\nIn an SN2 reaction, bond formation and bond breaking happen in a single step. [1]', sources: [{ title: 'OpenStax · The SN2 reaction', url: 'https://openstax.org/books/organic-chemistry/pages/11-2-the-sn2-reaction' }], createdAt: new Date().toISOString() },
];
function Preview() {
  const [briefs, setBriefs] = useState(examples);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [state, setState] = useState('ready');
  const unread = briefs.filter(brief => !reviewed.includes(brief.id));
  const shown = state === 'ready' ? briefs : [];
  const active = shown.find(brief => brief.id === activeId);
  const research: ResearchStatus = { enabled: state !== 'paused', status: state === 'running' ? 'running' : state === 'failed' ? 'failed' : state === 'ready' ? 'ready' : 'pending' };
  return <main className="learn" style={{ minHeight: '100dvh' }}>
    <header style={{ padding: '16px 5vw', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--learn-line)' }}><strong>Curve / Research desk</strong><label>Sample state <select aria-label="Sample state" value={state} onChange={event => { setState(event.target.value); setActiveId(null); }}>{['ready', 'running', 'pending', 'failed', 'paused'].map(value => <option key={value}>{value}</option>)}</select></label></header>
    <ActivityTabs artifacts={shown} activeId={activeId} revealIds={shown.map(brief => brief.id)} reviewedIds={reviewed} busy={false} onSelect={setActiveId} onClose={id => { setBriefs(items => items.filter(item => item.id !== id)); if (activeId === id) setActiveId(null); }} />
    <div id="study-canvas" role="tabpanel" aria-labelledby={`activity-tab-${activeId || 'today'}`} style={{ maxWidth: 1120, margin: 'auto', padding: 'clamp(20px, 4vw, 54px)' }}>
      <p style={{ fontSize: 10, color: 'var(--learn-muted)', marginBottom: 18 }}>Interactive preview · sample research · no account writes</p>
      {active ? <ResearchView artifact={active} busy={false} reviewed={reviewed.includes(active.id)} onNext={() => { setReviewed(items => [...items, active.id]); setActiveId(unread.find(brief => brief.id !== active.id)?.id || null); }} onClose={() => {setBriefs(items => items.filter(item => item.id !== active.id)); setActiveId(null);}} /> : <ResearchArrival briefs={state === 'ready' ? unread : []} research={research} firstName="Aryan" busy={false} onOpen={setActiveId} />}
      {!active && <div style={{ padding: '15px 0', color: 'var(--learn-muted)', fontSize: 13 }}>Your semester plan and next study session continue below.</div>}
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Preview /></React.StrictMode>);
