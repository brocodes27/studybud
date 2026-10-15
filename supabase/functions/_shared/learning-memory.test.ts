import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mergeLearningFeedback,learningAdaptation,adaptPlan,adaptRecovery, type LearningMemory} from './learning-memory.ts';
const at=()=>new Date().toISOString();
const feedback=(quote='I lose focus after 15 minutes',extra={})=>({key:'focus_span',action:'remember',kind:'observation',statement:'Reports losing focus after 15 minutes.',adjustment:'Try a shorter work block and review whether it helps.',quote,focusMinutes:15,...extra});
function remember(memory?:LearningMemory,sessionId='session-1',requestId='message-1',item=feedback()) {
  return mergeLearningFeedback(memory,[item],item.quote,{sessionId,requestId,topics:['Algebra'],at:at()});
}

test('observations remain tentative until supported by separate sessions; retries do not inflate evidence',()=>{
  let memory=remember();
  assert.equal(learningAdaptation(memory).patterns[0].confidence,'tentative');
  assert.deepEqual(remember(memory),memory);
  memory=remember(memory,'session-1','message-2');
  assert.equal(memory.observations[0].evidence.length,1);
  memory=remember(memory,'session-2','message-3');
  assert.equal(learningAdaptation(memory).patterns[0].confidence,'repeated');
  assert.equal(learningAdaptation(memory).patterns[0].sessionsObserved,2);
});

test('explicit preferences apply immediately; unsupported quotes, topics and timing are rejected',()=>{
  const memory=remember(undefined,'session-1','message-1',feedback('I prefer 10-minute blocks',{kind:'preference',focusMinutes:10}));
  assert.equal(learningAdaptation(memory).patterns[0].confidence,'stated_preference');
  assert.equal(learningAdaptation(memory).focusMinutes,10);
  assert.equal(mergeLearningFeedback(undefined,[feedback()],'Hello',{requestId:'m',sessionId:'s',topics:[],at:at()}).observations.length,0);
  assert.equal(remember(undefined,'s','m',feedback(undefined,{topic:'Invented'})).observations.length,0);
  assert.equal(learningAdaptation(remember(undefined,'s','m',feedback('I like the quiet room',{focusMinutes:15}))).focusMinutes,undefined);
  assert.equal(learningAdaptation(remember(undefined,'s','m',feedback(undefined,{focusMinutes:30}))).focusMinutes,undefined);
  assert.equal(remember(undefined,'s','m',feedback(undefined,{key:'invalid key'})).observations.length,0);
});

test('corrections replace older claims, forget removes a habit, and old observations expire',()=>{
  let memory=remember(remember(),'session-2','message-2');
  memory=remember(memory,'session-3','message-3',feedback('Now I prefer 25-minute blocks',{action:'correct',kind:'preference',focusMinutes:25,statement:'Prefers 25-minute blocks.'}));
  assert.equal(memory.observations[0].evidence.length,1);
  assert.equal(learningAdaptation(memory).focusMinutes,25);
  const forgotten=remember(memory,'session-4','message-4',feedback('Forget my old focus span',{action:'forget'}));
  assert.deepEqual(forgotten.observations,[]);
  const old=structuredClone(memory);old.observations[0].evidence[0].at='2020-01-01';
  assert.deepEqual(learningAdaptation(old).patterns,[]);
});

test('pacing changes plan blocks without changing the budget or interrupting independent checks',()=>{
  const memory=remember();
  const plan={minutes:70,steps:[{materialId:'m',topic:'Algebra',kind:'learn',minutes:35},{materialId:'m',topic:'Algebra',kind:'checkpoint',minutes:35}]};
  const adapted=adaptPlan(plan,memory);
  assert.deepEqual(adapted.steps.map(s=>s.minutes),[15,15,5,35]);
  assert.equal(adapted.steps.reduce((n,s)=>n+s.minutes,0),70);
  assert.equal(adapted.steps.filter(s=>s.kind==='checkpoint').length,1);
  assert.deepEqual(plan.steps.map(s=>s.minutes),[35,35]);
  assert.deepEqual(adaptPlan({...plan,steps:Array.from({length:12},()=>({kind:'learn',minutes:30}))},memory).steps.length,12);
});

test('topic-specific feedback stays scoped; recovery cues update without duplicating or retaining corrected advice',()=>{
  const memory=remember(undefined,'s','m',feedback(undefined,{topic:'Algebra'}));
  assert.equal(learningAdaptation(memory,'Geometry').patterns.length,0);
  const steps=[{topic:'Algebra',minutes:30,instruction:'Review the missed concepts.',accuracy:40},{topic:'Geometry',minutes:30,instruction:'Practise.',accuracy:80}];
  const adapted=adaptRecovery(steps,memory);
  assert.match(adapted[0].instruction,/15 minutes/);
  assert.equal(adapted[0].accuracy,40);
  assert.equal(adapted[1].instruction,'Practise.');
  assert.deepEqual(adaptRecovery(adapted,memory),adapted);
  assert.equal(adaptRecovery(adapted,{observations:[]})[0].instruction,steps[0].instruction);
});

test('observed trends separate practice and assisted scores from independent checks',async()=>{
  const {performancePatterns}=await import('./learning-memory.ts');
  const session=(id:number,mode:string,results:any[])=>({material_id:'m',topic:'Algebra',mode,completed_at:`2026-10-${String(id).padStart(2,'0')}`,results});
  const rows=[session(1,'checkpoint',[{correct:true},{correct:false}]),session(2,'checkpoint',[{correct:true},{correct:true}]),session(3,'practice',[{correct:false}]),session(4,'checkpoint',[{correct:false,assisted:true}])];
  const pattern=performancePatterns(rows)[0];
  assert.equal(pattern.latestAccuracy,100);assert.equal(pattern.previousAccuracy,50);
  assert.equal(pattern.observedTrend,'improving');assert.equal(pattern.independentChecks,2);
  assert.equal(pattern.practiceSessions,1);assert.equal(pattern.assistedAnswers,1);
  assert.equal(pattern.nextStep,'confirm_with_another_independent_check');
  assert.equal(performancePatterns([rows[2]])[0].observedTrend,'not_enough_data');
  assert.equal(performancePatterns([rows[2]])[0].latestAccuracy,undefined);
});

test('later confirmation retains validated pacing and an explicit preference outranks a tentative span',()=>{
  let memory=remember();
  memory=remember(memory,'session-2','message-2',feedback('The same focus issue happened again',{focusMinutes:undefined}));
  assert.equal(learningAdaptation(memory).focusMinutes,15);
  memory=remember(memory,'session-3','message-3',feedback('I prefer 25-minute blocks',{key:'preferred_blocks',kind:'preference',focusMinutes:25}));
  assert.equal(learningAdaptation(memory).focusMinutes,25);
});
