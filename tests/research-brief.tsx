import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ActivityTabs } from '../src/learning/agent/ActivityTabs';
import { ResearchView } from '../src/learning/agent/AssessmentView';
import type { ResearchArtifact } from '../supabase/functions/_shared/learning-workflows';
import type { WorkspaceArtifact } from '../src/learning/agent/contracts';
import '../src/index.css';
import '../src/learning/learning.css';
import '../src/learning/agent/workspace.css';
import '../src/learning/agent/dashboard.css';
import '../src/learning/agent/study-flow.css';

const brief: ResearchArtifact = {
  id: 'sample-brief', kind: 'research', title: 'Understanding linear relationships', topic: 'Linear equations', materialId: 'sample', createdAt: new Date().toISOString(),
  text: '## A constant rate of change\nFor the illustrative relationship **y = 2x**, each increase of 1 in x increases y by 2. [1]\n\n### Try it yourself\nIf x is 4, what is y? Move the slider in Explore, then explain the pattern in your own words.',
  sources: [{ title: 'OpenStax · Linear functions', url: 'https://openstax.org/books/college-algebra-2e/pages/4-1-linear-functions' }],
  ui: { html: '<h2>One input. A predictable change.</h2><p>Illustrative example · y = 2x</p><label for="input-x">Input x</label><input id="input-x" type="range" min="0" max="10" value="3"><p>x = <output id="x">3</output> → y = <output id="y">6</output></p><svg viewBox="0 0 320 90" role="img" aria-label="Output magnitude"><rect id="bar" x="0" y="20" width="90" height="40" rx="5" fill="#36745a"/></svg><button id="check" aria-expanded="false">Check your understanding</button><p id="answer" hidden>When x = 4, y = 8. Every step in x adds 2 to y.</p>', css: 'h2{font-size:25px;letter-spacing:-.5px}input{display:block;width:100%;margin:24px 0;accent-color:#36745a}output{font-size:25px;font-weight:600}button{border:1px solid #ddd;background:#f4f7f2;border-radius:8px;padding:10px 14px;cursor:pointer}svg{display:block;width:100%;height:90px}', js: 'document.querySelector("#input-x").addEventListener("input",e=>{const x=Number(e.target.value);document.querySelector("#x").value=x;document.querySelector("#y").value=x*2;document.querySelector("#bar").setAttribute("width",x*30)});document.querySelector("#check").addEventListener("click",e=>{const answer=document.querySelector("#answer");answer.hidden=!answer.hidden;e.target.setAttribute("aria-expanded",String(!answer.hidden))});' },
};
function Preview() {
  const [artifacts, setArtifacts] = useState<WorkspaceArtifact[]>([brief, { ...brief, id: 'saved-brief', title: 'Saved text-only brief', ui: undefined }, { id: 'notes', kind: 'material', title: 'Calculus lecture notes', materialId: 'sample' }]);
  const [activeId, setActiveId] = useState<string | null>(brief.id);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const artifact = artifacts.find(a => a.id === activeId);
  return <main className="learn" style={{ minHeight: '100dvh', background: 'var(--learn-bg)' }}>
    <ActivityTabs artifacts={artifacts} activeId={activeId} busy={false} onSelect={setActiveId} onClose={id => { setArtifacts(items => items.filter(a => a.id !== id)); if (activeId === id) setActiveId(null); }}/>
    <div id="study-canvas" role="tabpanel" aria-labelledby={`activity-tab-${activeId || 'today'}`} style={{ padding: 'clamp(16px, 4vw, 48px)', maxWidth: 1060, margin: 'auto' }}>
      {artifact?.kind === 'research' ? <ResearchView key={artifact.id} artifact={artifact} busy={false} reviewed={reviewed.includes(artifact.id)} onNext={() => setReviewed(items => [...items, artifact.id])} onClose={() => {setArtifacts(items => items.filter(a => a.id !== artifact.id));setActiveId(null);}}/> : <h1>{artifact?.title || 'Today’s study space'}</h1>}
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
