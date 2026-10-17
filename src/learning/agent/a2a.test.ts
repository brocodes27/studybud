import assert from 'node:assert/strict';
import {test} from 'node:test';
import {researchViaA2A} from '../../../supabase/functions/_shared/a2a-research';
const brief={text:'Review linear equations [1].',sources:[{title:'Algebra',url:'https://example.com/algebra'}]};
const card={supportedInterfaces:[{protocolBinding:'JSONRPC',protocolVersion:'1.0',url:'https://agent.example/rpc',tenant:'research'}]};
function fixture(result:unknown, selectedCard=card) {
  const calls:{url:string;init:RequestInit;body:any}[]=[];
  const transport=async(url:any,init:any)=>{
    const body=init.body ? JSON.parse(init.body):null;calls.push({url,init,body});
    return Response.json(body ? {jsonrpc:'2.0',id:body.id,result}:selectedCard);
  };
  return {calls,transport:transport as typeof fetch};
}
test('A2A discovers a pinned interface and returns a cited task artifact',async()=>{
  const f=fixture({task:{id:'task',status:{state:'TASK_STATE_COMPLETED'},artifacts:[{parts:[{text:JSON.stringify(brief)}]}]}});
  assert.deepEqual(await researchViaA2A({cardUrl:'https://agent.example/card',token:'test'},{course:'Math',topic:'Algebra'},f.transport),brief);
  assert.equal(f.calls[1].body.method,'SendMessage');
  assert.equal(f.calls[1].body.params.tenant,'research');
  assert.equal(f.calls[1].body.params.message.role,'ROLE_USER');
  assert.equal((f.calls[1].init.headers as any)['A2A-Version'],'1.0');
  assert.equal(f.calls[1].init.redirect,'error');
  assert.deepEqual(Object.keys(JSON.parse(f.calls[1].body.params.message.parts[0].text)).sort(),['course','task','topic']);
});
test('A2A rejects cross-origin credential forwarding before sending a message',async()=>{
  const f=fixture({}, {supportedInterfaces:[{...card.supportedInterfaces[0],url:'https://evil.example/rpc'}]});
  await assert.rejects(researchViaA2A({cardUrl:'https://agent.example/card',token:'secret'},{course:'Math',topic:'Algebra'},f.transport),/origin/);
  assert.equal(f.calls.length,1);
});
test('A2A preserves interactive briefs and drops invalid visuals without losing the report', async () => {
  const ui = { html: '<button>Reveal example</button>', css: 'button{color:green}', js: '' };
  for (const payload of [ui, { ...ui, html: '' }]) {
    const f = fixture({ message: { parts: [{ data: { ...brief, ui: payload } }] } });
    const result = await researchViaA2A({ cardUrl: 'https://agent.example/card' }, { course: 'Math', topic: 'Algebra' }, f.transport);
    assert.deepEqual(result, { ...brief, ...(payload.html ? { ui } : {}) });
    assert.match(JSON.parse(f.calls[1].body.params.message.parts[0].text).task, /Always include an interactive activity/);
  }
});
test('A2A handles direct messages but rejects failed tasks and unsafe citations',async()=>{
  const invoke=(result:any)=>researchViaA2A({cardUrl:'https://agent.example/card'},{course:'Math',topic:'Algebra'},fixture(result).transport);
  assert.deepEqual(await invoke({message:{role:'ROLE_AGENT',parts:[{data:brief}]}}),brief);
  await assert.rejects(invoke({task:{id:'task',status:{state:'TASK_STATE_FAILED'}}}),/complete/);
  await assert.rejects(invoke({message:{parts:[{data:{...brief,sources:[{title:'bad',url:'javascript:alert(1)'}]}}]}}),/source/);
  await assert.rejects(invoke({message:{parts:[{text:'No sources'}]}}));
});
test('A2A polls unfinished tasks using GetTask and validates RPC correlation',async()=>{
  const calls:string[]=[];
  const transport=(async(_url:any,init:any)=>{
    if(!init.body)return Response.json(card);
    const body=JSON.parse(init.body); calls.push(body.method);
    const task={id:'task',status:{state:body.method==='SendMessage'?'TASK_STATE_WORKING':'TASK_STATE_COMPLETED'},artifacts:[{parts:[{data:brief}]}]};
    return Response.json({jsonrpc:'2.0',id:body.id,result:body.method==='SendMessage'?{task}:task});
  }) as typeof fetch;
  assert.deepEqual(await researchViaA2A({cardUrl:'https://agent.example/card'},{course:'Math',topic:'Algebra'},transport),brief);
  assert.deepEqual(calls,['SendMessage','GetTask']);
  const wrong=(async(_url:any,init:any)=>Response.json(init.body?{jsonrpc:'2.0',id:'wrong',result:{message:{parts:[{data:brief}]}}}:card)) as typeof fetch;
  await assert.rejects(researchViaA2A({cardUrl:'https://agent.example/card'},{course:'Math',topic:'Algebra'},wrong),/request failed/);
});

import {specialistHandler} from '../../../supabase/functions/_shared/a2a-specialist';
test('hosted specialist round-trips through the A2A client and requires its private key',async()=>{
  let calls=0;
  const handler=specialistHandler({url:'https://agent.example/rpc',token:'private'},async(course,topic)=>{assert.equal(course,'Math');assert.equal(topic,'Algebra');calls++;return brief;});
  const transport=((url:any,init:any)=>handler(new Request(url,init))) as typeof fetch;
  assert.deepEqual(await researchViaA2A({cardUrl:'https://agent.example/.well-known/agent-card.json',token:'private'},{course:'Math',topic:'Algebra'},transport),brief);
  assert.equal(calls,1);
  const denied=await handler(new Request('https://agent.example/rpc',{method:'POST',body:'{}'}));assert.equal(denied.status,401);
  const malformed=await handler(new Request('https://agent.example/rpc',{method:'POST',headers:{Authorization:'Bearer private','A2A-Version':'1.0'},body:'null'}));assert.equal((await malformed.json()).error.code,-32600);
  assert.equal(calls,1);
});
