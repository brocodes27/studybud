import { safeSourceUrl } from './learning-workflows.ts';

type ObjectValue = Record<string, any>;
export type ResearchBrief = {text: string; sources: {title: string; url: string}[]};

/** Narrow, server-configured A2A 1.0 JSON-RPC client. Never accepts a student-supplied endpoint. */
export async function researchViaA2A(
  config: {cardUrl: string; token?: string},
  input: {course: string; topic: string},
  transport: typeof fetch = fetch,
): Promise<ResearchBrief> {
  const cardUrl = new URL(config.cardUrl);
  if (!safeSourceUrl(cardUrl.href)) throw new Error('A2A requires HTTPS without URL credentials.');
  const signal = AbortSignal.timeout(45000);
  const headers: Record<string,string> = {'Content-Type':'application/json','A2A-Version':'1.0'};
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  const read = async (url: string, init: RequestInit): Promise<ObjectValue> => {
    const response = await transport(url, {...init, headers, signal, redirect:'error'});
    if (!response.ok) throw new Error('A2A research agent unavailable.');
    // Bound untrusted response size before parsing, including chunked responses.
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty A2A response.');
    const decoder = new TextDecoder(); let text = '', size = 0;
    try {
      while (true) {
        const {done,value} = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > 128000) { await reader.cancel(); throw new Error('A2A response too large.'); }
        text += decoder.decode(value,{stream:true});
      }
    } finally { reader.releaseLock(); }
    const data = JSON.parse(text + decoder.decode());
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid A2A response.');
    return data;
  };
  const card = await read(cardUrl.href, {method:'GET'});
  const iface = Array.isArray(card.supportedInterfaces) && card.supportedInterfaces.find((i: ObjectValue) => i.protocolBinding === 'JSONRPC' && i.protocolVersion === '1.0');
  if (!iface) throw new Error('Research agent must support A2A 1.0 JSONRPC.');
  // Card discovery must never redirect bearer credentials to another origin.
  const endpoint = new URL(iface.url);
  if (!safeSourceUrl(endpoint.href) || endpoint.origin !== cardUrl.origin) throw new Error('A2A endpoint must share the configured card origin.');
  const rpc = async (method: string, params: ObjectValue) => {
    const id = crypto.randomUUID();
    const data = await read(endpoint.href, {method:'POST',body:JSON.stringify({jsonrpc:'2.0',id,method,params:{...params,...(iface.tenant ? {tenant:iface.tenant} : {})}})});
    if (data.jsonrpc !== '2.0' || data.id !== id || data.error || !data.result) throw new Error('A2A request failed.');
    return data.result;
  };
  const result = await rpc('SendMessage', {
    message:{messageId:crypto.randomUUID(),role:'ROLE_USER',parts:[{text:JSON.stringify({
      task:'Research this study topic using reliable sources. Return only JSON {text:string,sources:[{title:string,url:string}]}, with a concise explanation, a supported worked example and a practice question. Cite numbered sources inline. Do not invent sources.',
      course:input.course.slice(0,150),topic:input.topic.slice(0,200),
    })}]},configuration:{acceptedOutputModes:['application/json'],historyLength:0,returnImmediately:false},
  });
  let task = result.task;
  if (!!task === !!result.message) throw new Error('Invalid A2A result.');
  // Support agents that return an asynchronous task despite a blocking preference.
  for (let attempt=0; task && ['TASK_STATE_SUBMITTED','TASK_STATE_WORKING'].includes(task.status?.state) && attempt<8; attempt++) {
    if (typeof task.id !== 'string' || !task.id) throw new Error('Invalid A2A task.');
    await new Promise(resolve=>setTimeout(resolve,1000));
    const next = await rpc('GetTask',{id:task.id,historyLength:0});
    if (next.id !== task.id) throw new Error('A2A task identity changed.');
    task = next;
  }
  if (task && task.status?.state !== 'TASK_STATE_COMPLETED') throw new Error('A2A research did not complete.');
  const parts = task ? (task.artifacts || []).flatMap((a:ObjectValue)=>a.parts || []) : result.message.parts;
  if (!Array.isArray(parts)) throw new Error('Missing A2A research artifact.');
  const part = parts.find((p:ObjectValue)=>p.data || typeof p.text === 'string');
  const brief = part?.data || JSON.parse(part?.text || 'null');
  if (!brief || typeof brief.text !== 'string' || !brief.text.trim() || brief.text.length>10000 || !Array.isArray(brief.sources) || !brief.sources.length || brief.sources.length>8) throw new Error('Invalid A2A research brief.');
  const sources = brief.sources.map((s:ObjectValue)=>{
    const url = safeSourceUrl(s?.url);
    if (!url || typeof s.title !== 'string' || !s.title.trim() || s.title.length>200) throw new Error('Invalid A2A source.');
    return {title:s.title,url};
  });
  return {text:brief.text,sources};
}
