import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { build } from 'esbuild';
import type { AssessmentArtifact } from '../../../supabase/functions/_shared/learning-workflows';
import type { AssessmentDraftCache } from './useAssessmentDraft';

let useAssessmentDraft: typeof import('./useAssessmentDraft').useAssessmentDraft;
const globals = globalThis as any;
before(async()=>{
  const bundle=await build({entryPoints:[new URL('./useAssessmentDraft.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'draft-react',setup(build){
    build.onResolve({filter:/^react$/},()=>({path:'react',namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useState=(...args)=>globalThis.__draftReact.useState(...args); export const useRef=(...args)=>globalThis.__draftReact.useRef(...args); export const useEffect=(...args)=>globalThis.__draftReact.useEffect(...args);'}));
  }}]});
  ({useAssessmentDraft}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`));
});
const artifact:AssessmentArtifact={id:'exam',kind:'assessment',title:'Exam tomorrow',goal:'Assess me',mode:'exam',status:'setup',targets:[],sessionIds:[],examDate:'2026-10-16'};
function mount(cache:AssessmentDraftCache) {
  const slots:any[]=[];let cursor=0;let effects:(()=>void)[]=[];
  const react={
    useState(initial:any){
      const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;
      return [slots[i],(next:any)=>{
        // React StrictMode may replay updater functions with the same current state.
        if(typeof next==='function'){next(slots[i]);slots[i]=next(slots[i]);}else slots[i]=next;
      }];
    },
    useRef(initial:any){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
    useEffect(effect:()=>void,deps:any[]){const i=cursor++;if(!slots[i]||deps.some((v,n)=>!Object.is(v,slots[i][n])))effects.push(effect);slots[i]=deps;},
  };
  return (input:AssessmentArtifact)=>{
    function render(){globals.__draftReact=react;cursor=0;effects=[];const state=useAssessmentDraft(input,cache);for(const effect of effects)effect();return state;}
    render();return render();
  };
}
test('focus and polling snapshots preserve selected topics and all unsaved intake',()=>{
  const cache:AssessmentDraftCache=new Map(),render=mount(cache);
  const initial=render(artifact);
  const targets=[{materialId:'systems',topic:'Git'}];
  initial.setField('targets',targets);initial.setField('minutes',90);initial.setField('report','Unsaved feedback');initial.setField('confidence','confident');initial.setField('score','75');initial.setField('total','100');initial.setField('examDate','2026-10-17');
  const before=render(artifact).draft;
  for(let i=0;i<3;i++)assert.deepEqual(render(JSON.parse(JSON.stringify(artifact))).draft,before);
  assert.deepEqual(before.targets,targets);assert.equal(before.minutes,90);assert.equal(before.report,'Unsaved feedback');
});
test('switching assessment tabs restores each draft without mixing topics',()=>{
  const cache:AssessmentDraftCache=new Map();
  const selected=[{materialId:'systems',topic:'Git'}];
  mount(cache)(artifact).setField('targets',selected);
  const other={...artifact,id:'other'};
  mount(cache)(other).setField('minutes',120);
  assert.deepEqual(mount(cache)(JSON.parse(JSON.stringify(artifact))).draft.targets,selected);
  assert.equal(mount(cache)(other).draft.minutes,120);
  assert.deepEqual(mount(cache)(other).draft.targets,[]);
});
test('real saved changes from chat replace only changed fields, including after remount',()=>{
  const cache:AssessmentDraftCache=new Map(),render=mount(cache);
  render(artifact).setField('minutes',90);
  const targets=[{materialId:'systems',topic:'OS'}];
  const updated={...artifact,targets};
  assert.deepEqual(render(updated).draft.targets,targets);
  assert.equal(render(updated).draft.minutes,90);
  assert.deepEqual(mount(cache)({...updated,targets:[{materialId:'systems',topic:'Git'}]}).draft.targets,[{materialId:'systems',topic:'Git'}]);
  assert.equal(mount(cache)({...updated,minutes:45}).draft.minutes,45);
});
