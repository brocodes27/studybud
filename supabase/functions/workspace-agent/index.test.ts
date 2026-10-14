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
          ? 'export const callMetaJSON = (...args) => globalThis.__assessmentChat.decide(...args); export async function* streamMeta(){ yield "Topics saved. Ready to start?"; }'
          : `export const toolGuide = '';
             export const authorize = async () => ({});
             export const threadFor = async () => globalThis.__assessmentChat.thread;
             export const snapshot = async () => ({thread:globalThis.__assessmentChat.thread,messages:[]});
             export const claim = async () => ({}); export const finish = async () => {};
             export const message = async () => {};
             export const checkpointFor = async () => globalThis.__assessmentChat.checkpoint;
             export const contextFor = async () => ({state:globalThis.__assessmentChat.thread.state});
             export const execute = (...args) => globalThis.__assessmentChat.execute(...args);
             export const saveState = async () => {}; export const publicError = e => e.message;`,
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
