import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { build } from 'esbuild';
import type { AssessmentArtifact } from '../_shared/learning-workflows.ts';

let handler: (req: Request) => Promise<Response>;
const globals = globalThis as any;
before(async () => {
  const bundle = await build({
    entryPoints:[new URL('./index.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm',
    plugins:[{name:'coordinator-fixture',setup(build) {
      build.onResolve({filter:/http\/server/},()=>({path:'serve',namespace:'fixture'}));
      build.onResolve({filter:/_shared\/workspace\.ts$/},()=>({path:'workspace',namespace:'fixture'}));
      build.onResolve({filter:/_shared\/meta\.ts$/},()=>({path:'meta',namespace:'fixture'}));
      build.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path==='serve'
        ? 'export const serve = handler => { globalThis.__assessmentChatHandler = handler; };'
        : path==='meta'
          ? 'export const callMetaJSON = (...args) => globalThis.__assessmentChat.decide(...args); export async function* streamMeta(...args){ globalThis.__assessmentChat.replies?.push(args); yield "Topics saved. Ready to start?"; }'
          : `export const toolGuide = '';
             export const authorize = async () => ({});
             export const threadFor = async () => globalThis.__assessmentChat.thread;
             export const snapshot = async () => ({thread:globalThis.__assessmentChat.thread,messages:[]});
             export const claim = async () => ({}); export const finish = async () => {};
             export const message = async () => {};
             export const checkpointFor = async () => globalThis.__assessmentChat.checkpoint;
             export const contextFor = async () => ({state:globalThis.__assessmentChat.thread.state,learningAdaptation:globalThis.__assessmentChat.thread.state.learningMemory,library:[{metadata:{topics:['Algebra']}}],sessions:globalThis.__assessmentChat.sessions || []});
             export const execute = (...args) => globalThis.__assessmentChat.execute(...args);
             export const saveState = async (_access,thread,state) => {if(globalThis.__assessmentChat.saveError)throw new Error('Could not save your workspace.');thread.state=state;}; export const publicError = e => e.message;`,
      }));
    }}],
  });
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  handler=globals.__assessmentChatHandler;
});

test('chat saves inferred scope, then yes pls starts it without another model confirmation',async()=>{
  let artifact:AssessmentArtifact={id:'exam',kind:'assessment',title:'Exam tomorrow',goal:'Assess me',mode:'exam',status:'setup',targets:[],sessionIds:[],examDate:'2026-10-16'};
  const targets=Array.from({length:10},(_,i)=>({materialId:'systems',topic:i===9?'GitHub remote, push and clone':`Topic ${i+1}`}));
  const calls:string[]=[];let decisions=0;
  const fixture=globals.__assessmentChat={thread:{id:'thread',state:{artifacts:[artifact],activeId:'exam'}},checkpoint:null,
    decide:async()=>{decisions++;return {tools:[{name:'configure_assessment',args:{artifactId:'exam',targets}}],reply:''};},
    execute:async(_access:unknown,_thread:unknown,tool:any)=>{
      calls.push(tool.name);
      if(tool.name==='configure_assessment') artifact={...artifact,targets:tool.args.targets};
      else {
        assert.equal(tool.name,'begin_assessment');assert.equal(tool.args.artifactId,'exam');assert.equal(tool.args.confirmTopics,true);
        assert.deepEqual(artifact.targets,targets);artifact={...artifact,status:'assessing',sessionIds:['check']};fixture.checkpoint={id:'check'};
      }
      fixture.thread.state.artifacts=[artifact];return artifact;
    },
  };
  async function send(text:string,id:string) {
    const response=await handler(new Request('https://project.supabase.co/functions/v1/workspace-agent',{
      method:'POST',body:JSON.stringify({operation:'message',requestId:id,text,localDate:'2026-10-15 Asia/Calcutta'}),
    }));
    return (await response.text()).trim().split('\n').map(line=>JSON.parse(line));
  }
  const scoped=await send('everything from start till github: remote, push and clone','11111111-1111-4111-8111-111111111111');
  assert.ok(scoped.some(e=>e.type==='done'));assert.ok(!scoped.some(e=>e.type==='error'));
  const started=await send('yes pls','22222222-2222-4222-8222-222222222222');
  assert.deepEqual(calls,['configure_assessment','begin_assessment']);assert.equal(decisions,1);
  assert.ok(started.some(e=>e.type==='text' && e.text.includes('independent check is ready')));
  assert.ok(started.some(e=>e.type==='done'));assert.ok(!started.some(e=>e.type==='error'));
});

test('button completion always asks about performance before suggesting the next activity',async()=>{
  globals.__assessmentChat={thread:{id:'thread',state:{artifacts:[],activeId:null}},checkpoint:null,
    decide:async()=>{throw new Error('Completion must not depend on the model');},
    execute:async()=>({completed:true}),
  };
  const response=await handler(new Request('https://project.supabase.co/functions/v1/workspace-agent',{
    method:'POST',body:JSON.stringify({operation:'tool',requestId:'33333333-3333-4333-8333-333333333333',tool:{name:'submit_session',args:{sessionId:'check'}}}),
  }));
  const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
  assert.ok(!events.some(e=>e.type==='error'));
  assert.match(events.filter(e=>e.type==='text').map(e=>e.text).join(''),/How was your performance in this session/);
});

test('chat submission also asks about performance and waits for the student',async()=>{
  const fixture=globals.__assessmentChat={thread:{id:'thread',state:{artifacts:[],activeId:null}},checkpoint:{id:'check',questions:[],answers:{}},
    execute:async()=>{fixture.checkpoint=null as any;return {completed:true};},
  };
  const response=await handler(new Request('https://project.supabase.co/functions/v1/workspace-agent',{
    method:'POST',body:JSON.stringify({operation:'message',requestId:'44444444-4444-4444-8444-444444444444',text:'submit'}),
  }));
  const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
  assert.ok(!events.some(e=>e.type==='error'));
  assert.match(events.filter(e=>e.type==='text').map(e=>e.text).join(''),/How was your performance in this session/);
});

test('even a mistaken model tool cannot turn practice results into an external exam',async()=>{
  const calls:string[]=[];
  globals.__assessmentChat={thread:{id:'thread',state:{artifacts:[{id:'old-draft',kind:'assessment',mode:'results',status:'setup'}],activeId:null}},checkpoint:null,
    decide:async()=>({tools:[{name:'open_exam_results',args:{goal:'Mistaken exam review'}},{name:'open_assessment',args:{goal:'Mistaken new check'}}],reply:''}),
    execute:async(_a:unknown,_t:unknown,tool:any)=>{calls.push(tool.name);return {};},
  };
  const response=await handler(new Request('https://project.supabase.co/functions/v1/workspace-agent',{
    method:'POST',body:JSON.stringify({operation:'message',requestId:'55555555-5555-4555-8555-555555555555',text:'My scores from the practice here were low'}),
  }));
  const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
  assert.ok(!events.some(e=>e.type==='error'));assert.deepEqual(calls,[]);
});

test('ambiguous test results ask their source without opening an exam form',async()=>{
  globals.__assessmentChat={thread:{id:'thread',state:{artifacts:[],activeId:null}},checkpoint:null,
    decide:async(messages:any)=>{assert.match(messages[0].content,/Return JSON \{feedback/);return {feedback:[]};},
    execute:async()=>{throw new Error('Must not open an exam form');},
  };
  const response=await handler(new Request('https://project.supabase.co/functions/v1/workspace-agent',{
    method:'POST',body:JSON.stringify({operation:'message',requestId:'66666666-6666-4666-8666-666666666666',text:'Show my test results'}),
  }));
  const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
  assert.ok(!events.some(e=>e.type==='error'));
  assert.match(events.filter(e=>e.type==='text').map(e=>e.text).join(''),/practice or knowledge check here/);
});

test('feedback persists before replying, adapts the current revision plan, and reaches the next turn after reload',async()=>{
  const replies:any[]=[];
  const fixture=globals.__assessmentChat={thread:{id:'thread',state:{artifacts:[{id:'plan',kind:'assessment',mode:'study',status:'ready',sessionIds:['s1'],targets:[],steps:[{topic:'Algebra',minutes:30,instruction:'Review algebra.',accuracy:40}]}],activeId:'plan',plan:{minutes:30,steps:[{materialId:'m',topic:'Algebra',kind:'learn',minutes:30}]}}},checkpoint:null,sessions:[{id:'s1',completed_at:'2026-10-15'}],replies,
    decide:async()=>({tools:[],reply:'Use shorter blocks.',feedback:[{key:'focus_span',action:'remember',kind:'observation',statement:'Loses focus after 15 minutes.',adjustment:'Try a shorter block and check whether it helps.',quote:'I lose focus after 15 minutes',focusMinutes:15}]}),
  };
  async function send(text:string,id:string){
    const response=await handler(new Request('https://project.supabase.co/functions/v1/workspace-agent',{method:'POST',body:JSON.stringify({operation:'message',requestId:id,text})}));
    return (await response.text()).trim().split('\n').map(line=>JSON.parse(line));
  }
  const events=await send('I lose focus after 15 minutes','77777777-7777-4777-8777-777777777777');
  assert.ok(!events.some(e=>e.type==='error'));
  const state:any=fixture.thread.state;
  assert.equal(state.learningMemory.observations[0].evidence[0].sessionId,'s1');
  assert.deepEqual(state.plan.steps.map((s:any)=>s.minutes),[15,15]);
  assert.match(state.artifacts[0].steps[0].instruction,/15 minutes/);
  const finalContext=JSON.parse(replies[0][0][1].content).context;
  assert.equal(finalContext.learning.learningAdaptation.observations[0].key,'focus_span');
  // A fresh request reads the persisted state, not an in-memory profile cache.
  fixture.thread=structuredClone(fixture.thread);
  fixture.decide=async(messages:any)=>{
    const context=JSON.parse(messages[1].content).context;
    assert.equal(context.learningAdaptation.observations[0].focusMinutes,15);
    return {tools:[],reply:'Continue with your shorter blocks.',feedback:[]};
  };
  assert.ok((await send('What should I do next?','88888888-8888-4888-8888-888888888888')).some(e=>e.type==='done'));
});

test('a memory write failure is reported and does not claim feedback was remembered',async()=>{
  globals.__assessmentChat={thread:{id:'thread',state:{artifacts:[],activeId:null}},checkpoint:null,saveError:true,
    decide:async()=>({tools:[],reply:'Remembered.',feedback:[{key:'phone_distraction',action:'remember',kind:'observation',statement:'Reports phone distractions.',adjustment:'Try putting the phone aside.',quote:'My phone distracted me'}]}),
  };
  const response=await handler(new Request('https://project.supabase.co/functions/v1/workspace-agent',{method:'POST',body:JSON.stringify({operation:'message',requestId:'99999999-9999-4999-8999-999999999999',text:'My phone distracted me'})}));
  const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
  assert.ok(events.some(e=>e.type==='error' && /save/.test(e.error)));
  assert.ok(!events.some(e=>e.type==='text'));
  assert.equal(globals.__assessmentChat.thread.state.learningMemory,undefined);
});
