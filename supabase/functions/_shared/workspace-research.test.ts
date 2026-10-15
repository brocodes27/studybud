import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { build } from 'esbuild';

let research: typeof import('./workspace-research.ts');
const globals = globalThis as any;
before(async () => {
  globals.Deno = {env:{get:(name:string)=>name === 'TAVILY_API_KEY' ? 'test-key' : undefined}};
  const bundle = await build({entryPoints:[new URL('./workspace-research.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm',
    plugins:[{name:'research-fixture',setup(build) {
      build.onResolve({filter:/research-topic\.ts$/},()=>({path:'research-topic',namespace:'fixture'}));
      build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const researchTopic = (...args) => globalThis.__researchTopic(...args);'}));
    }}]});
  research=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
});
function database(materials: any[]) {
  const queries: unknown[]=[];
  const db:any={from:(table:string)=>{
    const q:any={select:()=>q,eq:()=>q,not:()=>q,order:()=>q,
      contains:(_field:string,value:unknown)=>{queries.push(value);return q;},
      limit:async()=>({data:table==='materials'?materials:[],error:null})};
    return q;
  }};
  return {db,queries};
}
test('daily research includes individually confirmed topics and excludes unconfirmed topics',async()=>{
  const calls:string[]=[];
  globals.__researchTopic=async (_course:string,topic:string)=>{calls.push(topic);return {text:'Verified brief',sources:[{title:'Notes',url:'https://example.com'}]};};
  const {db,queries}=database([{id:'material',metadata:{topics:['Algebra','Geometry'],confirmed:false,confirmed_topics:['Algebra']}}]);
  const artifacts=await research.buildDailyResearch(db,'student','job');
  assert.deepEqual(queries,[{workspace:'curve'}]);
  assert.deepEqual(calls,['Algebra']);assert.equal(artifacts.length,1);assert.equal(artifacts[0].topic,'Algebra');
});
test('a failed topic does not discard another completed brief',async()=>{
  globals.__researchTopic=async (_course:string,topic:string)=>{if(topic==='Algebra')throw new Error('Provider failed');return {text:'Geometry brief',sources:[]};};
  const {db}=database([{id:'material',metadata:{topics:['Algebra','Geometry'],confirmed:true}}]);
  const artifacts=await research.buildDailyResearch(db,'student','job');
  assert.equal(artifacts.length,1);assert.equal(artifacts[0].topic,'Geometry');
});
test('no confirmed topics produce an actionable error and provider details stay private',async()=>{
  const {db}=database([{id:'material',metadata:{topics:['Algebra'],confirmed:false}}]);
  await assert.rejects(research.buildDailyResearch(db,'student','job'),/Add and confirm/);
  assert.match(research.researchFailure(new Error('Add and confirm course material to start daily research.')),/Add and confirm/);
  assert.doesNotMatch(research.researchFailure(new Error('secret provider data')),/secret/);
  globals.__researchTopic=async()=>{throw new Error('provider failed');};
  const confirmed=database([{id:'material',metadata:{topics:['Algebra'],confirmed:true}}]);
  await assert.rejects(research.buildDailyResearch(confirmed.db,'student','job'),/provider failed/);
});
