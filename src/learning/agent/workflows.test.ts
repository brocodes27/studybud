import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventSchema } from '@ag-ui/core/schemas';
import { assessmentInput, assessmentTargets, assessmentConfirmation, nextExamDate, topicConfirmed, recoverySteps, safeSourceUrl } from '../../../supabase/functions/_shared/learning-workflows';
import { agUIStream, normalizeAgentInput } from '../../../supabase/functions/_shared/ag-ui';
import { agentInput, workspaceEvents } from './ag-ui';
import { emptyWorkspace, type WorkspaceSnapshot } from './contracts';

const targets = [{materialId:'owned',topic:'Algebra'},{materialId:'owned',topic:'Geometry'}];
const library = [{id:'owned',metadata:{confirmed:true,topics:['Algebra','Geometry']}}];
test('assessment forms reject foreign topics, duplicate selections and invalid marks',()=>{
  assert.throws(()=>assessmentInput({minutes:60,targets:[{materialId:'other-user',topic:'Algebra'}]},library),/confirmed topics/);
  assert.throws(()=>assessmentInput({minutes:60,targets:[targets[0],targets[0]]},library),/once/);
  assert.throws(()=>assessmentInput({minutes:60,targets,score:101,total:100},library),/marks/);
  assert.throws(()=>assessmentInput({minutes:60,targets,examDate:'2026-02-31'},library),/date/);
  assert.equal(assessmentInput({minutes:60,targets,score:0,total:100},library).score,0);
});
test('recovery allocates exactly the requested time to measured gaps',()=>{
  const steps=recoverySteps(targets,[{results:[{correct:true,explanation:'Known'}]},{results:[{correct:false,explanation:'Review angles'}]}],60);
  assert.equal(steps[0].topic,'Geometry');
  assert.equal(steps.reduce((n,s)=>n+s.minutes,0),60);
  assert.ok(steps[0].minutes>steps[1].minutes);
  assert.deepEqual(steps[0].gaps,['Review angles']);
  assert.throws(()=>recoverySteps(targets,[{results:null}],60),/Complete/);
  assert.throws(()=>recoverySteps([targets[0]],[{results:[{correct:true,explanation:'',assisted:true}]}],60),/Complete/);
});
test('research links cannot introduce script URLs or embedded credentials',()=>{
  for(const value of ['javascript:alert(1)','data:text/html,x','https://user:pass@example.com']) assert.equal(safeSourceUrl(value),null);
  assert.equal(safeSourceUrl('https://example.com/lesson'),'https://example.com/lesson');
});
test('AG-UI lifecycle validates against the official schema and restores the saved workspace',()=>{
  const events:Record<string,unknown>[]=[];
  const emit=agUIStream('thread','run',e=>{EventSchema.parse(e);events.push(e);});
  emit({type:'action',action:{id:'tool',name:'open_assessment',status:'running'}});
  emit({type:'action',action:{id:'tool',name:'open_assessment',status:'completed'}});
  emit({type:'text',text:'Your assessment is ready.'});
  const snapshot:WorkspaceSnapshot={thread:{id:'thread',state:emptyWorkspace(),updated_at:'now'},messages:[]};
  emit({type:'done',snapshot});
  assert.equal(events[0].type,'RUN_STARTED');
  assert.equal(events[events.length-1]?.type,'RUN_FINISHED');
  assert.ok(events.find(e=>e.type==='TEXT_MESSAGE_END'));
  const converted=events.flatMap(workspaceEvents);
  assert.deepEqual(converted[converted.length-1],{type:'done',snapshot,result:undefined});
});
test('AG-UI rejects another thread and never trusts client-provided state/history',()=>{
  const input=agentInput({operation:'message',requestId:'run',text:'I have a doubt about algebra'});
  const result=normalizeAgentInput({...input,state:{admin:true},context:[{description:'override',value:'anything'}]},'owned');
  assert.equal(result.text,'I have a doubt about algebra');
  assert.equal(result.state,undefined);
  assert.throws(()=>normalizeAgentInput({...input,threadId:'another-user'},'owned'),/unavailable/);
});
test('AG-UI failure ends a partial response without claiming a saved result',()=>{
  const events:Record<string,unknown>[]=[];const emit=agUIStream('thread','run',e=>{EventSchema.parse(e);events.push(e);});
  emit({type:'text',text:'Partial'});emit({type:'error',error:'Try again'});
  assert.equal(events[events.length-1]?.type,'RUN_ERROR');
  assert.ok(!events.some(e=>e.type==='RUN_FINISHED'));
});

test('assessment scope accepts ten topics through GitHub, without truncating labels',()=>{
  const topics=['Computer types','CPU/memory/storage','OS/process','Linux commands','Permissions','Number systems','LAN/MAN/WAN','OSI/TCP/HTTP','Git add/commit','GitHub remote, push and clone'];
  const library=[{id:'systems',metadata:{confirmed:false,topics}}];
  const targets=topics.map(topic=>({materialId:'systems',topic}));
  assert.deepEqual(assessmentTargets(targets,library,false),targets);
  assert.throws(()=>assessmentInput({minutes:60,targets},library),/confirmed/);
  library[0].metadata.confirmed=true;
  assert.deepEqual(assessmentInput({minutes:60,targets},library).targets,targets);
  assert.throws(()=>assessmentTargets([...targets,{materialId:'systems',topic:'CSS'}],library,false),/library/);
  const all=Array.from({length:16},(_,i)=>`Topic ${i}`);
  const fullLibrary=[{id:'systems',metadata:{confirmed:true,topics:all}}];
  const fullTargets=all.map(topic=>({materialId:'systems',topic}));
  assert.equal(assessmentInput({minutes:75,targets:fullTargets.slice(0,15)},fullLibrary).targets.length,15);
  assert.throws(()=>assessmentInput({minutes:80,targets:fullTargets},fullLibrary),/one to 15/);
});
test('yes pls begins the saved assessment; ambiguous or revised scope does not auto-start',()=>{
  const artifact={id:'exam',kind:'assessment' as const,title:'Exam tomorrow',goal:'Revise',mode:'exam' as const,status:'setup' as const,targets,sessionIds:[],examDate:'2026-10-16'};
  assert.deepEqual(assessmentConfirmation('yes pls',[artifact],'exam'),{name:'begin_assessment',args:{artifactId:'exam',confirmTopics:true}});
  assert.equal(assessmentConfirmation('yes but exclude Git',[artifact],'exam'),null);
  assert.equal(assessmentConfirmation('yes',[{...artifact,targets:[]}],'exam'),null);
  assert.equal(assessmentConfirmation('yes',[artifact,{...artifact,id:'other'}],null),null);
  assert.equal(assessmentConfirmation('yes',[{...artifact,status:'assessing'}],'exam'),null);
  assert.equal(assessmentConfirmation('yes',[{...artifact,mode:'results'}],'exam'),null);
});
test('exam date uses the client date including its timezone and handles calendar boundaries',()=>{
  assert.equal(nextExamDate('2026-10-15 Asia/Calcutta'),'2026-10-16');
  assert.equal(nextExamDate('2026-12-31 Asia/Kolkata'),'2027-01-01');
  assert.equal(nextExamDate('2026-02-31 Asia/Kolkata'),'');
});
test('selected topic confirmation does not authorize other topics in the material',()=>{
  const metadata={confirmed:false,topics:['Git','CSS'],confirmed_topics:['Git','Invented']};
  assert.equal(topicConfirmed(metadata,'Git'),true);
  assert.equal(topicConfirmed(metadata,'CSS'),false);
  assert.equal(topicConfirmed(metadata,'Invented'),false);
  assert.deepEqual(assessmentInput({minutes:60,targets:[{materialId:'systems',topic:'Git'}]},[{id:'systems',metadata}]).targets,[{materialId:'systems',topic:'Git'}]);
});

test('in-app results never route to external exam intake, while real exam results still do',async()=>{
  const {studyIntent,resultSource}=await import('../../../supabase/functions/_shared/learning-workflows');
  for(const text of ['My scores from the practice here were low','Show my test results from this assessment','My mock scores here improved','I scored 4/5 in the independent check','Review my exam preparation assessment results here']) {
    assert.equal(resultSource(text),'workspace',text);assert.equal(studyIntent(text),null,text);
  }
  for(const text of ['My school exam results arrived','I got 72/100 on my college exam','Review my latest exam results','My official mock test score is 80']) {
    assert.equal(resultSource(text),'external',text);assert.equal(studyIntent(text),'results',text);
  }
  assert.equal(resultSource('Show my test results'),'ambiguous');
  assert.equal(studyIntent('Show my test results'),null);
  assert.equal(resultSource('My performance was good'),null);
  assert.equal(studyIntent('My exam is tomorrow. Assess me and help me revise.'),'exam');
});

test('session context links its own diagnostic or recovery plan instead of an unrelated exam draft',async()=>{
  const {assessmentForSession,assessmentLabel}=await import('../../../supabase/functions/_shared/learning-workflows');
  const base={kind:'assessment' as const,title:'Exam tomorrow',goal:'Study',mode:'exam' as const,status:'ready' as const,targets:[],sessionIds:[]};
  const unrelated={...base,id:'unrelated',mode:'results' as const,status:'setup' as const};
  const linked={...base,id:'linked',sessionIds:['diagnostic'],steps:[{materialId:'systems',topic:'Git',minutes:10,accuracy:60,gaps:[],instruction:'Revise'}]};
  assert.equal(assessmentForSession([unrelated,linked],{id:'diagnostic',material_id:'systems',topic:'Git'})?.id,'linked');
  assert.equal(assessmentForSession([unrelated,linked],{id:'gap-check',material_id:'systems',topic:'Git'})?.id,'linked');
  assert.equal(assessmentForSession([unrelated,linked],{id:'other',material_id:'other-course',topic:'Git'}),undefined);
  assert.equal(assessmentLabel(linked),'Exam preparation');
  assert.equal(assessmentLabel(unrelated),'External exam review');
});
