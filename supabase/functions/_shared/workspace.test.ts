import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { build } from 'esbuild';
import { assessmentConfirmation } from './learning-workflows.ts';

let workspace: typeof import('./workspace.ts');
before(async () => {
  (globalThis as any).__workspaceTestEnv = () => 'test';
  const bundle = await build({
    entryPoints: [new URL('./workspace.ts', import.meta.url).pathname],
    bundle: true, write: false, platform: 'node', format: 'esm',
    define: { 'Deno.env.get': 'globalThis.__workspaceTestEnv' },
    plugins: [{ name: 'edge-imports', setup(build) {
      build.onResolve({filter: /^https:\/\//}, args => ({path: args.path, namespace: 'fake'}));
      build.onLoad({filter: /.*/, namespace: 'fake'}, () => ({contents: 'export const createClient = () => globalThis.__workspaceAuthClient;'}));
    }}],
  });
  workspace = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
});

const thread = () => ({ id: 'thread-1', state: {artifacts: [], activeId: null, plan: null, checkpointId: null}, updated_at: '' });
function store() {
  const messages: Record<string, unknown>[] = [];
  const db = { from(table: string) {
    const query = {
      select: () => query, eq: () => query, order: () => query,
      single: async () => ({data: thread(), error: null}),
      limit: async () => ({data: [...messages].reverse(), error: null}),
      upsert: async (message: Record<string, unknown>) => {
        if (table === 'curve_workspace_messages') {
          const prior = messages.find(x => x.request_id === message.request_id && x.role === message.role);
          if (prior) Object.assign(prior, message);
          else messages.push({...message, id: `saved-${messages.length}`, created_at: String(messages.length)});
        }
        return {error: null};
      },
    };
    return query;
  }};
  return { access: {admin: db, sb: db, user: {id: 'user-1'}} as any, messages };
}

test('messages for both roles persist and retries do not duplicate a turn', async () => {
  const {access, messages} = store();
  await workspace.message(access, thread(), 'request-1', 'user', 'Study loops');
  await workspace.message(access, thread(), 'request-1', 'assistant', 'Let us start.');
  await workspace.message(access, thread(), 'request-1', 'user', 'Study loops');
  assert.equal(messages.length, 2);
  // A new access context reads durable records rather than a worker-local cache.
  const snap = await workspace.snapshot({...access});
  assert.deepEqual(snap.messages.map((m: any) => m.content), ['Study loops', 'Let us start.']);
});

test('failed message writes are reported instead of being kept only in memory', async () => {
  const {access} = store();
  access.admin = {from: () => ({upsert: async () => ({error: {message: 'table missing'}})})};
  await assert.rejects(workspace.message(access, thread(), 'request-1', 'user', 'Hello'), /Could not save this message/);
  await assert.rejects(workspace.threadFor(access), /Could not load your saved conversation/);
});

test('failed history reads do not return an empty conversation', async () => {
  const {access} = store();
  const from = access.sb.from;
  access.sb = {from: (table: string) => {
    const q = from(table);
    if (table === 'curve_workspace_messages') q.limit = async () => ({data: null, error: {message: 'unavailable'}});
    return q;
  }};
  await assert.rejects(workspace.snapshot(access), /Could not load your saved conversation/);
});

test('request reservation errors cannot bypass the durable lock', async () => {
  const {access} = store();
  access.admin.rpc = async () => ({data: null, error: {message: 'An action is still running. Please retry shortly.'}});
  await assert.rejects(workspace.claim(access, thread(), 'request-1', 'message'), /still running/);
});

test('failed state writes preserve the previously saved state', async () => {
  const {access} = store();
  const t = thread(); const original = t.state;
  const q = {eq: () => q, then: (resolve: any) => resolve({error: {message: 'offline'}})};
  access.admin = {from: () => ({update: () => q})};
  await assert.rejects(workspace.saveState(access, t, {...original, activeId: 'new'}), /Could not save your workspace/);
  assert.equal(t.state, original);
});

function assessmentStore(topics = ['Algebra','Geometry'], confirmed = true) {
  const rows = new Map<string, any>(); let generated = 0;
  const material={id:'00000000-0000-4000-8000-000000000001',title:'Systems',metadata:{topics,confirmed,confirmed_topics:[] as string[],pages:[{page:1,text:'Teaching notes'}]}};
  const db = {from(table: string) {
    let id: string | undefined;
    const q:any = {select:()=>q,eq:(key:string,value:string)=>{if(key==='id')id=value;return q;},contains:()=>q,order:()=>q,
      limit:async()=>({data:table==='materials'?[{id:material.id,title:material.title,...material.metadata}]:[],error:null}),
      single:async()=>({data:table==='materials' ? material : rows.get(id!),error:null}),maybeSingle:async()=>({data:null,error:null}),
      upsert:async()=>({error:null}),update:(value:any)=>{if(table==='materials' && value.metadata)material.metadata=value.metadata;return q;},then:(resolve:any)=>resolve({error:null}),
    };return q;
  },functions:{invoke:async(_name:string,{body}:any)=>{
    generated++;
    const row={id:body.session_id,material_id:body.material_id,topic:body.topic,mode:body.mode,questions:[],answers:{},completed_at:null,results:null};
    rows.set(row.id,row);return {data:row,error:null};
  }}};
  return {access:{sb:db,admin:db,user:{id:'user'}} as any,rows,material,generated:()=>generated};
}
test('assessment workflow checks each topic before creating a measured recovery plan',async()=>{
  const f=assessmentStore(), t:any=thread(), emit=()=>{};
  const materialId='00000000-0000-4000-8000-000000000001';
  const opened:any=await workspace.execute(f.access,t,{name:'open_assessment',args:{goal:'Exam tomorrow',mode:'exam'}},'open',emit);
  await workspace.execute(f.access,t,{name:'begin_assessment',args:{artifactId:opened.id,minutes:60,examDate:'2026-10-15',targets:[{materialId,topic:'Algebra'},{materialId,topic:'Geometry'}]}},'begin',emit);
  const first=f.rows.get(t.state.checkpointId);assert.equal(first.mode,'checkpoint');
  await assert.rejects(workspace.execute(f.access,t,{name:'complete_assessment',args:{artifactId:opened.id}},'too-early',emit));
  first.completed_at='now';first.results=[{correct:true,explanation:'Known'}];
  const next:any=await workspace.execute(f.access,t,{name:'complete_assessment',args:{artifactId:opened.id}},'next',emit);
  assert.equal(next.status,'assessing');assert.equal(next.sessionIds.length,2);assert.equal(f.generated(),2);
  const second=f.rows.get(t.state.checkpointId);second.completed_at='now';second.results=[{correct:false,explanation:'Review angles'}];
  const ready:any=await workspace.execute(f.access,t,{name:'complete_assessment',args:{artifactId:opened.id}},'finish',emit);
  assert.equal(ready.status,'ready');assert.equal(ready.steps[0].topic,'Geometry');
  assert.equal(ready.steps.reduce((n:number,s:any)=>n+s.minutes,0),60);assert.equal(t.state.checkpointId,null);
});

test('saved ten-topic scope plus yes pls starts one check and confirms only the agreed topics',async()=>{
  const topics=['Computer types','CPU/memory/storage','OS/process','Linux commands','Permissions','Number systems','LAN/MAN/WAN','OSI/TCP/HTTP','Git add/commit','GitHub remote, push and clone','HTML','CSS'];
  const f=assessmentStore(topics,false),t:any=thread(),emit=()=>{};
  const opened:any=await workspace.execute(f.access,t,{name:'open_assessment',args:{goal:'Exam tomorrow',mode:'exam',localDate:'2026-10-15 Asia/Calcutta'}},'open',emit);
  const targets=topics.slice(0,10).map(topic=>({materialId:f.material.id,topic}));
  const saved:any=await workspace.execute(f.access,t,{name:'configure_assessment',args:{artifactId:opened.id,targets}},'scope',emit);
  assert.equal(saved.status,'setup');assert.deepEqual(saved.targets,targets);assert.equal(saved.examDate,'2026-10-16');
  assert.equal(saved.minutes,60);assert.equal(f.generated(),0);assert.deepEqual(f.material.metadata.confirmed_topics,[]);
  await assert.rejects(workspace.execute(f.access,t,{name:'begin_assessment',args:{artifactId:opened.id}},'unconfirmed',emit),/Confirm the selected/);
  const tool=assessmentConfirmation('yes pls',t.state.artifacts,t.state.activeId)!;
  const started:any=await workspace.execute(f.access,t,tool,'yes',emit);
  assert.equal(started.status,'assessing');assert.deepEqual(started.targets,targets);
  assert.equal(started.targets.at(-1).topic,'GitHub remote, push and clone');
  assert.equal(f.generated(),1);assert.equal(f.rows.get(t.state.checkpointId).topic,'Computer types');
  assert.deepEqual(f.material.metadata.confirmed_topics,topics.slice(0,10));
  assert.equal(f.material.metadata.confirmed,false);assert.deepEqual(f.material.metadata.topics,topics);
  assert.equal(assessmentConfirmation('yes pls',t.state.artifacts,t.state.activeId),null);
});
test('invalid chat scope is rejected before changing material confirmation or workspace',async()=>{
  const f=assessmentStore(['Git','CSS'],false),t:any=thread(),emit=()=>{};
  const opened:any=await workspace.execute(f.access,t,{name:'open_assessment',args:{goal:'Revise'}},'open',emit);
  const prior=t.state;
  await assert.rejects(workspace.execute(f.access,t,{name:'begin_assessment',args:{artifactId:opened.id,targets:[{materialId:f.material.id,topic:'Invented'}],confirmTopics:true}},'invalid',emit),/library/);
  assert.equal(t.state,prior);assert.deepEqual(f.material.metadata.confirmed_topics,[]);assert.equal(f.generated(),0);
});

test('restarting a flawed diagnostic preserves scope and uses fresh sessions for every topic',async()=>{
  const f=assessmentStore(),t:any=thread(),emit=()=>{};
  const materialId=f.material.id;
  const opened:any=await workspace.execute(f.access,t,{name:'open_assessment',args:{goal:'Assess me'}},'open',emit);
  await workspace.execute(f.access,t,{name:'begin_assessment',args:{artifactId:opened.id,minutes:60,targets:[{materialId,topic:'Algebra'},{materialId,topic:'Geometry'}]}},'begin',emit);
  const oldFirst=t.state.checkpointId;f.rows.get(oldFirst).completed_at='now';f.rows.get(oldFirst).results=[{correct:true,explanation:'Outline trivia'}];
  await workspace.execute(f.access,t,{name:'complete_assessment',args:{artifactId:opened.id}},'next',emit);
  const oldSecond=t.state.checkpointId;
  const restarted:any=await workspace.execute(f.access,t,{name:'restart_assessment',args:{artifactId:opened.id}},'restart',emit);
  assert.equal(restarted.targets.length,2);assert.equal(restarted.sessionIds.length,1);
  assert.notEqual(t.state.checkpointId,oldFirst);assert.notEqual(t.state.checkpointId,oldSecond);
  assert.ok(f.rows.has(oldFirst));assert.ok(f.rows.has(oldSecond));
  const newFirst=f.rows.get(t.state.checkpointId);newFirst.completed_at='now';newFirst.results=[{correct:false,explanation:'Actual concept gap'}];
  await workspace.execute(f.access,t,{name:'complete_assessment',args:{artifactId:opened.id}},'next-new',emit);
  assert.notEqual(t.state.checkpointId,oldSecond);
  const newSecond=f.rows.get(t.state.checkpointId);newSecond.completed_at='now';newSecond.results=[{correct:true,explanation:'Known concept'}];
  const ready:any=await workspace.execute(f.access,t,{name:'complete_assessment',args:{artifactId:opened.id}},'finish-new',emit);
  assert.equal(ready.steps.find((s:any)=>s.topic==='Algebra').accuracy,0);
  assert.ok(ready.steps.every((s:any)=>!s.gaps.includes('Outline trivia')));
});

test('chat context labels in-app checks and keeps exam preparation separate from external result drafts',async()=>{
  const t:any=thread();
  const prep={id:'prep',kind:'assessment',title:'Exam tomorrow',goal:'Revise',mode:'exam',status:'ready',targets:[],sessionIds:['check']};
  t.state.artifacts=[{...prep,id:'old-review',mode:'results',status:'setup',sessionIds:[]},prep];t.state.activeId='prep';
  const db={from(table:string){
    const q:any={select:()=>q,eq:()=>q,not:()=>q,contains:()=>q,order:()=>q,
      limit:async()=>({data:table==='curve_material_sessions'?[{id:'check',material_id:'systems',topic:'Git',mode:'checkpoint',completed_at:'2026-10-15',results:[{correct:true}]}]:[],error:null}),
      maybeSingle:async()=>({data:null,error:null})};return q;
  }};
  const context:any=await workspace.contextFor({sb:db,admin:db,user:{id:'student'}} as any,t);
  assert.equal(context.sessions[0].source,'in_app');assert.equal(context.sessions[0].activityType,'diagnostic');
  assert.equal(context.activeAssessment.id,'prep');assert.equal(context.activeAssessment.title,'Exam preparation');
  assert.equal(context.state.artifacts[0].activityType,'external_exam_review');
  assert.equal(context.state.artifacts[0].title,'External exam review');
  assert.equal(t.state.artifacts[1].title,'Exam tomorrow');
});

test('saved onboarding preferences reach the first coordinator context without becoming measured mastery',async()=>{
  const selected:string[]=[];
  const db={from(table:string){
    const q:any={select:(columns:string)=>{if(table==='curve_study_preferences')selected.push(columns);return q;},eq:()=>q,not:()=>q,contains:()=>q,order:()=>q,
      limit:async()=>({data:[],error:null}),
      maybeSingle:async()=>({data:table==='curve_study_preferences'?{courses:['Math'],onboarding_answers:{daily_minutes:'20',days:'4',focus:'10',explanation:'steps',feedback:'gentle'}}:null,error:null})};return q;
  }};
  const context:any=await workspace.contextFor({sb:db,admin:db,user:{id:'student'}} as any,thread() as any);
  assert.ok(selected[0].includes('onboarding_answers'));
  assert.equal(context.initialAdaptation.source,'self_reported_onboarding');
  assert.equal(context.initialAdaptation.weeklyMinutes,80);
  assert.equal(context.initialAdaptation.focusMinutes,10);
  assert.equal(context.initialAdaptation.explanation,'steps');
  assert.equal(context.initialAdaptation.feedback,'gentle');
  assert.deepEqual(context.performancePatterns,[]);
});


test('workspace authorization requires paid access and fails closed on billing errors', async () => {
  const state = globalThis as typeof globalThis & { __workspaceAuthClient: unknown };
  const req = new Request('https://project.supabase.co/functions/v1/workspace-agent', { headers: { Authorization: 'Bearer test' } });
  for (const [paid, error, status] of [[false, null, 402], [null, { message: 'unavailable' }, 503], [null, null, 402]] as const) {
    state.__workspaceAuthClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'student' } }, error: null }) },
      rpc: async () => ({ data: paid, error }),
    };
    await assert.rejects(workspace.authorize(req), (e: any) => e.status === status);
  }
  state.__workspaceAuthClient = {
    auth: { getUser: async () => ({ data: { user: { id: 'student' } }, error: null }) },
    rpc: async () => ({ data: true, error: null }),
  };
  assert.equal((await workspace.authorize(req)).user.id, 'student');
});
