import { useState, type FormEvent } from 'react';
import { ClipboardCheck, ArrowRight, FileUp } from 'lucide-react';
import { readMaterialFile } from '../api';
import type { Material } from '../model';
import { assessmentLabel, MAX_ASSESSMENT_TOPICS, type AssessmentArtifact, type ResearchArtifact } from '../../../supabase/functions/_shared/learning-workflows';
import type { WorkspaceTool } from './contracts';
import { SessionView } from './WorkspaceViews';
import ReactMarkdown from 'react-markdown';
import { useAssessmentDraft, type AssessmentDraftCache } from './useAssessmentDraft';
import { InteractiveAnswer } from './InteractiveAnswer';
import { parseInteractiveUI } from '../../../supabase/functions/_shared/interactive-ui';
import './research-brief.css';

export function AssessmentView({artifact,materials,busy,onAction,revision,drafts}: {
  artifact: AssessmentArtifact; materials:Material[]; busy:boolean; revision?:string; drafts?:AssessmentDraftCache;
  onAction:(tool:WorkspaceTool)=>Promise<void>;
}) {
  const {draft,setField} = useAssessmentDraft(artifact,drafts);
  const {targets,minutes,confidence,examDate,report,score,total} = draft;
  const [reading,setReading] = useState(false);
  const [error,setError] = useState('');
  const [step, setStep] = useState(() => {
    const saved = sessionStorage.getItem(`curve:assessment-step:${artifact.id}`);
    const parsed = saved ? parseInt(saved, 10) : 0;
    return Number.isFinite(parsed) ? Math.min(Math.max(0, parsed), (artifact.steps?.length || 1) - 1) : 0;
  });
  function changeStep(newStep: number | ((s: number) => number)) {
    setStep(prev => {
      const next = typeof newStep === 'function' ? newStep(prev) : newStep;
      const bounded = Math.min(Math.max(0, next), (artifact.steps?.length || 1) - 1);
      sessionStorage.setItem(`curve:assessment-step:${artifact.id}`, String(bounded));
      return bounded;
    });
  }
  const ready = materials.filter(m => m.metadata.topics?.length);
  async function action(tool:WorkspaceTool) {
    setError('');
    try { await onAction(tool); } catch(e) { setError(e instanceof Error ? e.message : 'Could not save. Please retry.'); }
  }
  async function submit(e:FormEvent) {
    e.preventDefault();
    await action({name:'begin_assessment',args:{artifactId:artifact.id,targets,minutes,confidence,confirmTopics:true,examDate:artifact.mode === 'exam' ? examDate : '',report,score,total}});
  }
  const current = artifact.steps?.[Math.min(step,(artifact.steps?.length || 1)-1)];
  return <section className="workflow-view" aria-label={assessmentLabel(artifact)}>
    <header className="workflow-heading">
      <div><span className="workflow-eyebrow"><ClipboardCheck size={14}/> {assessmentLabel(artifact)}</span><h2>{artifact.status === 'ready' ? 'Your revision plan' : artifact.status === 'assessing' ? 'Check your understanding' : 'Find your starting point'}</h2>{artifact.status === 'setup' && <p>{artifact.goal}</p>}</div>
      <div className="workflow-heading-actions">
        {artifact.status !== 'assessing' && <button
          type="button"
          className="learn-button subtle small workflow-quit-btn"
          disabled={busy}
          onClick={() => void action({name:'close_artifact',args:{artifactId:artifact.id}})}
          title="Quit assessment and return to study space"
        >
          Quit assessment
        </button>}
        {artifact.status !== 'setup' && <details className="assessment-options"><summary>Options</summary><button className="learn-button subtle small" disabled={busy} onClick={()=>void action({name:'restart_assessment',args:{artifactId:artifact.id}})}>Restart with fresh questions</button></details>}
      </div>
    </header>
    {artifact.status !== 'ready' && <ol className="workflow-stages" aria-label="Assessment progress"><li className={artifact.status === 'setup' ? 'current' : ''}>1. Choose topics</li><li className={artifact.status === 'assessing' ? 'current' : ''}>2. Knowledge check</li><li>3. Revision plan</li></ol>}
    {error && <p className="learn-error" role="alert">{error}</p>}
    {artifact.status === 'setup' ? <form onSubmit={submit} className="workflow-form">
      <fieldset disabled={busy || reading}>
        <legend>What should we assess?</legend><p>Choose up to {MAX_ASSESSMENT_TOPICS} topics. Starting confirms your selected topics. Each gets a short independent check before your plan is built.</p>
        {!ready.length && <p>Add notes to your library and extract their topics first. Your syllabus alone may not contain enough teaching material for a fair assessment.</p>}
        <div className="workflow-topic-list">{ready.map(m => <div key={m.id}><strong>{m.title}</strong>{m.metadata.topics!.map(topic => {
          const selected = targets.some(t => t.materialId === m.id && t.topic === topic);
          return <label key={topic}><input type="checkbox" checked={selected} disabled={!selected && targets.length >= MAX_ASSESSMENT_TOPICS} onChange={() => setField('targets',selected ? targets.filter(t => !(t.materialId === m.id && t.topic === topic)) : [...targets,{materialId:m.id,topic}])}/><span>{topic}</span></label>;
        })}</div>)}</div>
        <div className="workflow-fields"><label>Revision time after the check<input type="number" min={15} max={240} required value={minutes} onChange={e => setField('minutes',Number(e.target.value))}/> minutes</label>
        <label>How familiar does it feel?<select value={confidence} onChange={e=>setField('confidence',e.target.value)}><option value="new">Starting from scratch</option><option value="unsure">Some knowledge, some gaps</option><option value="confident">Confident — check me</option></select></label>
        {artifact.mode === 'exam' && <label>Exam date<input type="date" required value={examDate} onChange={e=>setField('examDate',e.target.value)}/></label>}</div>
        {artifact.mode === 'results' && <div className="workflow-exam-input">
          <h3>Your latest result</h3><div className="workflow-fields"><label>Marks earned<input type="number" min="0" step="0.5" required value={score} onChange={e=>setField('score',e.target.value)}/></label><label>Out of<input type="number" min="1" max="10000" step="0.5" required value={total} onChange={e=>setField('total',e.target.value)}/></label></div>
          <label>Mistakes, questions you missed, or teacher feedback<textarea rows={7} minLength={20} maxLength={12000} required value={report} onChange={e=>setField('report',e.target.value)} placeholder="Paste your marked answers or feedback. Include topics and where marks were lost — a total score alone cannot show the cause."/></label>
          <label className="workflow-upload"><FileUp size={16}/> Import a result PDF or text file<input type="file" accept=".pdf,.txt,.md" onChange={async e => {
            const file=e.target.files?.[0]; if(!file)return; setReading(true);setError('');
            try { const pages=await readMaterialFile(file);const text=pages.map(p=>p.text).join('\n\n');if(text.length>12000)throw new Error('This report is too long. Paste the marked questions and feedback (up to 12,000 characters).');setField('report',text); }
            catch(err){setError(err instanceof Error?err.message:'Could not read the result.');}finally{setReading(false);e.target.value='';}
          }}/></label><small>Searchable PDF, TXT or Markdown. Review the imported text before submitting.</small>
        </div>}
        <button className="learn-button dark" disabled={!targets.length || busy || reading}>{busy ? 'Preparing your assessment…' : reading ? 'Reading report…' : 'Assess my knowledge'}<ArrowRight size={16}/></button>
      </fieldset>
    </form> : artifact.status === 'assessing' ? <>
      <p className="workflow-progress">Topic {artifact.sessionIds.length} of {artifact.targets.length}. Your answers will update this plan and the conversation.</p>
      <SessionView revision={revision} key={artifact.sessionIds[artifact.sessionIds.length-1]} sessionId={artifact.sessionIds[artifact.sessionIds.length-1]} onCompleted={() => {void action({name:'complete_assessment',args:{artifactId:artifact.id}});}} onQuit={() => onAction({name:'close_artifact',args:{artifactId:artifact.id}})}/>
      <button className="learn-button subtle" disabled={busy} onClick={()=>void action({name:'complete_assessment',args:{artifactId:artifact.id}})}>{busy ? 'Preparing the next step…' : 'Continue after submitting answers'}</button>
    </> : <>
      <p className="workflow-plan-meta">{artifact.minutes} minutes · {artifact.steps?.length || 0} topics · Based on your in-app diagnostic</p>
      {artifact.mode === 'exam' && <p className="workflow-note">Upcoming exam · {artifact.examDate}. Start with the highest-priority gaps.</p>}
      {!!artifact.issues?.length && <section className="workflow-issues"><h3>What your exam feedback shows</h3>{artifact.issues.map((i,n)=><article key={n}><h4>{i.issue}</h4><blockquote>{i.evidence}</blockquote><p>{i.action}</p></article>)}</section>}
      {current && <article className="workflow-study-step"><span className="pill mint">STEP {step+1} OF {artifact.steps!.length} · {current.minutes} MIN</span><h3>{current.topic}</h3><p>{current.accuracy}% on the diagnostic. {current.instruction}</p>{!!current.gaps.length && <details className="workflow-gap-details"><summary>Review diagnostic feedback ({current.gaps.length})</summary>{current.gaps.map((gap,i)=><p key={i} className="workflow-gap">{gap}</p>)}</details>}
        <div className="workflow-actions"><button className="learn-button subtle" disabled={busy} onClick={()=>void action({name:'explain',args:{materialId:current.materialId,topic:current.topic}})}>Review the explanation</button><button className="learn-button dark" disabled={busy} onClick={()=>{sessionStorage.setItem(`curve:assessment-step:${artifact.id}`, String(step));void action({name:'start_practice',args:{materialId:current.materialId,topic:current.topic,mode:'checkpoint'}});}}>Check the gap is fixed</button></div>
        <nav className="workflow-actions" aria-label="Revision steps"><button className="text-button" disabled={step===0} onClick={()=>changeStep(s=>s-1)}>Previous</button><button className="text-button" disabled={step===artifact.steps!.length-1} onClick={()=>changeStep(s=>s+1)}>Next topic <ArrowRight size={14}/></button></nav>
      </article>}
    </>}
  </section>;
}

export function ResearchView({artifact,onNext,onClose,busy,reviewed}: {artifact:ResearchArtifact;onNext:()=>void;onClose?:()=>void;busy:boolean;reviewed:boolean}) {
  const ui = parseInteractiveUI(artifact.ui);
  const [view, setView] = useState<'explore' | 'report' | 'sources'>(() => ui ? 'explore' : 'report');
  return <article className="workflow-view research-brief"><header className="workflow-heading"><div><span className="workflow-eyebrow">DAILY RESEARCH · {new Date(artifact.createdAt).toLocaleDateString()}</span><h2>{artifact.title}</h2><p>Selected from your syllabus and recent knowledge checks.</p></div><span className={`brief-review-status ${reviewed ? 'reviewed' : ''}`}>{reviewed ? 'Reviewed' : 'Unread brief'}</span></header>
    <nav className="brief-view-switcher" aria-label="Brief sections">
      {ui && <button type="button" aria-pressed={view === 'explore'} onClick={() => setView('explore')}>Explore</button>}
      <button type="button" aria-pressed={view === 'report'} onClick={() => setView('report')}>Full report</button>
      <button type="button" aria-pressed={view === 'sources'} onClick={() => setView('sources')}>Sources <span>{artifact.sources.length}</span></button>
    </nav>
    {view === 'explore' && ui && <div className="brief-explorer"><p>Try the controls, work through the ideas, then check the full report.</p><InteractiveAnswer key={artifact.id} ui={ui} title={artifact.title}/></div>}
    {(view === 'report' || (view === 'explore' && !ui)) && <div className="workflow-research"><ReactMarkdown>{artifact.text}</ReactMarkdown></div>}
    {view === 'sources' && <aside className="workflow-sources"><h3>Read the sources</h3><p>Source numbers match the citations in your report.</p>{artifact.sources.length ? artifact.sources.map((s,i)=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">[{i+1}] {s.title} ↗</a>) : <p>No sources are attached to this saved brief.</p>}</aside>}
    <div className="workflow-actions">
      <button className="learn-button dark" disabled={busy} onClick={onNext}>{reviewed ? 'Continue to next unread brief' : 'Mark reviewed & continue'}<ArrowRight size={16}/></button>
      {onClose && <button type="button" className="learn-button subtle" disabled={busy} onClick={onClose}>Close brief</button>}
    </div>
  </article>;
}
