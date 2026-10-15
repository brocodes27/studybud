import assert from "node:assert/strict";
import { before, afterEach, test, mock } from "node:test";
import { build } from "esbuild";

let handler: (req: Request) => Promise<Response>;
const state = globalThis as typeof globalThis & {
  __studyHandler: typeof handler;
  __studyClient: unknown;
  __studyEnv: (key: string) => string;
};

before(async () => {
  state.__studyEnv = () => "test-only";
  const bundle = await build({
    entryPoints: [new URL("./index.ts", import.meta.url).pathname],
    bundle: true, write: false, platform: "node", format: "esm",
    define: { "Deno.env.get": "globalThis.__studyEnv" },
    plugins: [{ name: "fake-edge-services", setup(build) {
      build.onResolve({ filter: /^https:\/\// }, (args) => ({ path: args.path, namespace: "edge-test" }));
      build.onLoad({ filter: /.*/, namespace: "edge-test" }, (args) => ({ contents:
        args.path.includes("http/server")
          ? "export const serve = (handler) => { globalThis.__studyHandler = handler; };"
          : "export const createClient = () => globalThis.__studyClient;",
      }));
    } }],
  });
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
  handler = state.__studyHandler;
});
afterEach(() => mock.restoreAll());

function materialStore(paid = true, claimed = true) {
  const writes: Record<string, unknown>[] = [];
  const reservations: unknown[] = [];
  const material = {
    id: "python-material", title: "Python Programming", owner_user_id: "test-user",
    metadata: { workspace: "curve", course: "CS201", semester: "Semester 3", topics: [] as string[],
      pages: [{ page: 12, text: "Module 1: Variables, data types, decision-making structures and loops. Module 2: Tuples, dictionaries and sets." }],
    },
  };
  state.__studyClient = {
    auth: { getUser: async () => ({ data: { user: { id: "test-user" } } }) },
    rpc: async (name: string, args: unknown) => {
      if (name === "reserve_material_analysis") reservations.push(args);
      return { data: name === "curve_has_paid_access" ? paid : true, error: null };
    },
    from: () => {
      let updating = false;
      const query = {
        select: () => query,
        eq: () => updating ? Promise.resolve({ error: null }) : query,
        single: async () => ({ data: material, error: null }),
        maybeSingle: async () => ({ data: claimed ? { material_id: material.id } : null, error: null }),
        update: (body: Record<string, unknown>) => { updating = true; writes.push(body); return query; },
      };
      return query;
    },
  };
  return { writes, reservations, material };
}

function analyze() {
  return handler(new Request("https://project.supabase.co/functions/v1/material-study", {
    method: "POST", headers: { Origin: "https://www.curveapp.tech", Authorization: "Bearer test-only" },
    body: JSON.stringify({ action: "analyze", material_id: "python-material" }),
  }));
}

test("topic analysis recovers from truncated Meta JSON and saves only the complete reply", async () => {
  const store = materialStore();
  let calls = 0;
  mock.method(globalThis, "fetch", async (url: unknown, init: RequestInit) => {
    assert.equal(url, "https://api.meta.ai/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    const input = JSON.parse(body.messages.find((m: { role: string }) => m.role === "user").content);
    assert.equal(input.semester, "Semester 3");
    assert.equal(body.model, "muse-spark-1.3-contributor");
    assert.equal(body.reasoning_effort, "minimal");
    assert.deepEqual(body.response_format.json_schema.schema.required, ["topics", "summary"]);
    assert.equal(body.max_completion_tokens, calls === 0 ? 4096 : 8192);
    calls++;
    assert.equal(store.writes.length, 0);
    return new Response(JSON.stringify({ choices: [{
      finish_reason: calls === 1 ? "length" : "stop",
      message: { content: calls === 1 ? '{"topics":["Decision-making structures and Loops'
        : JSON.stringify({ topics: ["Loops", "Dictionaries"], summary: "Planned course coverage." }) },
    }] }));
  });
  const response = await analyze();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).topics, ["Loops", "Dictionaries"]);
  assert.equal(calls, 2);
  assert.equal(store.reservations.length, 1);
  assert.equal(store.writes.length, 1);
  assert.deepEqual(store.writes[0].metadata, { ...store.material.metadata,
    topics: ["Loops", "Dictionaries"], summary: "Planned course coverage.", confirmed: false,
  });
});

test("repeated invalid replies leave the saved material intact and return a readable retry message", async () => {
  const store = materialStore();
  mock.method(console, "error", () => {});
  mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ choices: [{
    finish_reason: "stop", message: { content: '{"topics":["Private curriculum' },
  }] })));
  const response = await analyze();
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /Your material is saved; please retry/);
  assert.doesNotMatch(body.error, /JSON|Private curriculum/);
  assert.equal(store.writes.length, 0);
});

test("practice and checkpoint generation use Meta and keep answer keys private", async () => {
  for (const mode of ["practice", "checkpoint"]) {
    const quote = "A loop repeats a block of instructions until its stopping condition is met.";
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const keyWrites: unknown[] = [];
    let saved: Record<string, unknown> = {};
    state.__studyClient = {
      auth: { getUser: async () => ({ data: { user: { id: "test-user" } } }) },
      rpc: async () => ({ data: true, error: null }),
      from: (table: string) => {
        const query = {
          select: () => query, eq: () => query, order: () => query,
          maybeSingle: async () => ({ data: table === 'curve_workspace_threads' ? {state:{learningMemory:{observations:[{key:'example_style',kind:'preference',statement:'Prefers short examples.',adjustment:'Use short concrete examples.',evidence:[{requestId:'m',sessionId:'s',quote:'I prefer short examples',at:new Date().toISOString()}]}]}}} : null }),
          limit: async () => ({ data: [] }),
          insert: async (data: unknown) => { keyWrites.push(data); return { error: null }; },
          update: (data: Record<string, unknown>) => { saved = data; return query; },
          single: async () => ({ error: null, data: table === "materials" ? {
            id: "material", title: "Loops", owner_user_id: "test-user",
            metadata: { workspace: "curve", confirmed: mode === "practice", confirmed_topics: ["Loops"], topics: ["Loops","Dictionaries"], pages: [{ page: 1, text: quote }] },
          } : { id: sessionId, mode, ...saved } }),
        };
        return query;
      },
    };
    mock.method(globalThis, "fetch", async (url: unknown, init: RequestInit) => {
      assert.equal(url, "https://api.meta.ai/v1/chat/completions");
      const body = JSON.parse(String(init.body));
      assert.equal(body.model, "muse-spark-1.3-contributor");
      assert.equal(body.reasoning_effort, "low");
      const context = JSON.parse(body.messages.find((m: {role:string}) => m.role === 'user').content);
      if(mode === 'practice') assert.equal(context.learningAdaptation.patterns[0].key,'example_style');
      else { assert.equal(context.learningAdaptation,undefined);assert.equal(context.performancePatterns,undefined); }
      assert.equal(body.response_format.json_schema.schema.properties.questions.items.properties.options.minItems, 4);
      return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
        source_kind: 'teaching',
        questions: Array.from({ length: 5 }, (_, i) => ({
          topic: "Loops", question: `What does a loop repeat, example ${i + 1}?`,
          options: ["Instructions", "Files", "Programs", "Names"], correct_index: 0,
          explanation: quote, hint: "Think of the loop body.", quote, page: 1,
        })),
      }) } }] }));
    });
    const response = await handler(new Request("https://project.supabase.co/functions/v1/material-study", {
      method: "POST", headers: { Origin: "https://www.curveapp.tech", Authorization: "Bearer test-only" },
      body: JSON.stringify({ action: "generate", material_id: "material", session_id: sessionId, topic: "Loops", mode }),
    }));
    assert.equal(response.status, 200);
    const session = await response.json();
    assert.equal(session.questions.length, 5);
    assert.equal(keyWrites.length, 1);
    assert.ok(session.questions.every((q: Record<string, unknown>) => !('correct_index' in q) && !('explanation' in q)));
  }
});

test('syllabus placement questions are replaced with concept questions from teaching sources',async()=>{
  const quote='A process in the runnable state can be selected by the scheduler to execute on the CPU.';
  const outline='Module 3: Permissions & Ownership Process Management';
  const savedKeys:any[]=[];let saved:any={};let modelCalls=0,searchCalls=0;
  state.__studyClient={
    auth:{getUser:async()=>({data:{user:{id:'test-user'}}})},rpc:async()=>({data:true,error:null}),
    from:(table:string)=>{
      const q:any={select:()=>q,eq:()=>q,order:()=>q,maybeSingle:async()=>({data:null}),limit:async()=>({data:[]}),
        insert:async(data:any)=>{savedKeys.push(data);return {error:null};},update:(data:any)=>{saved=data;return q;},delete:()=>q,
        single:async()=>({error:null,data:table==='materials'?{id:'systems',title:'System and Web Essentials curriculum',owner_user_id:'test-user',metadata:{workspace:'curve',confirmed:true,topics:['Process Management'],pages:[{page:7,text:outline}]}}:{id:'11111111-1111-4111-8111-111111111111',...saved}}),
      };return q;
    },
  };
  mock.method(globalThis,'fetch',async(url:unknown,init:RequestInit)=>{
    const body=JSON.parse(String(init.body));
    if(url==='https://api.tavily.com/search'){
      searchCalls++;assert.match(body.query,/Process Management/);
      return new Response(JSON.stringify({results:[{title:'Linux scheduling',url:'https://man7.org/linux/man-pages/man7/sched.7.html',content:quote}]}));
    }
    assert.equal(url,'https://api.meta.ai/v1/chat/completions');modelCalls++;
    const prompt=body.messages.find((m:any)=>m.role==='system' && m.content.includes('multiple-choice')).content;
    assert.match(prompt,/Never test module numbers/);
    const context=JSON.parse(body.messages.find((m:any)=>m.role==='user').content);
    const raw=modelCalls===1?{source_kind:'teaching',questions:Array.from({length:3},()=>({topic:'Process Management',question:'According to the Module 3 outline, in which context does Process Management reappear?',options:['Version control','HTML','Number systems','Permissions & Ownership Process Management'],correct_index:3,explanation:outline,hint:'Look at Module 3',quote:outline,page:7}))}
      :{source_kind:'teaching',questions:['What does the scheduler select for CPU execution?','Which process state is eligible to execute on the CPU?','What resource does a runnable process need to execute?'].map(question=>({topic:'Process Management',question,options:['A runnable process','An unrelated file','A directory entry','The course module'],correct_index:0,explanation:quote,hint:'Think about runnable processes.',quote,page:1}))};
    if(modelCalls===2){assert.equal(context.sources[0].text,quote);assert.ok(!JSON.stringify(context.sources).includes('Module 3'));}
    return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(raw)}}]}));
  });
  const response=await handler(new Request('https://project.supabase.co/functions/v1/material-study',{method:'POST',headers:{Origin:'https://www.curveapp.tech',Authorization:'Bearer test-only'},body:JSON.stringify({action:'generate',material_id:'systems',session_id:'11111111-1111-4111-8111-111111111111',topic:'Process Management',mode:'checkpoint'})}));
  assert.equal(response.status,200);const session=await response.json();
  assert.equal(modelCalls,2);assert.equal(searchCalls,1);assert.equal(savedKeys.length,1);
  assert.ok(session.questions.every((q:any)=>!q.question.includes('Module 3') && !('correct_index' in q)));
  assert.equal(session.questions[0].source.url,'https://man7.org/linux/man-pages/man7/sched.7.html');
  assert.equal(savedKeys[0].keys[0].quote,quote);
});


test("unpaid student can analyze only their claimed free syllabus", async () => {
  const store = materialStore(false);
  store.material.metadata.topics = ["Loops"];
  const response = await analyze();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).topics, ["Loops"]);
  materialStore(false, false);
  assert.equal((await analyze()).status, 402);
});

test("unpaid students cannot generate dynamic assessments even for the free syllabus", async () => {
  const store = materialStore(false);
  const response = await handler(new Request("https://project.supabase.co/functions/v1/material-study", {
    method: "POST", headers: { Origin: "https://www.curveapp.tech", Authorization: "Bearer test-only" },
    body: JSON.stringify({ action: "generate", material_id: store.material.id }),
  }));
  assert.equal(response.status, 402);
  assert.equal(store.reservations.length, 0);
  assert.equal(store.writes.length, 0);
});
