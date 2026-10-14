import type { ResearchBrief } from './a2a-research.ts';

export function specialistHandler(config: {url:string;token:string|undefined}, research:(course:string,topic:string)=>Promise<ResearchBrief>) {
  const json=(body:unknown,status=200)=>Response.json(body,{status});
  return async(req:Request) => {
    const path = new URL(req.url).pathname;
    if (req.method==='GET' && path.endsWith('/.well-known/agent-card.json')) return json({
      name:'Elevenfolks Research Specialist',description:'Cited educational topic research for the adaptive learning workspace.',version:'1.0.0',
      supportedInterfaces:[{url:config.url,protocolBinding:'JSONRPC',protocolVersion:'1.0'}],
      capabilities:{streaming:false,pushNotifications:false},defaultInputModes:['application/json'],defaultOutputModes:['application/json'],
      securitySchemes:{researchToken:{httpAuthSecurityScheme:{scheme:'Bearer'}}},securityRequirements:[{schemes:{researchToken:{list:[]}}}],
      skills:[{id:'topic-research',name:'Topic research',description:'Explain a course topic with cited sources and a practice question.',tags:['education','research']}],
    });
    if (!config.token || req.headers.get('Authorization')!==`Bearer ${config.token}`) return json({error:'Unauthorized'},401);
    if(req.method!=='POST')return json({error:'Method not allowed'},405);
    if(req.headers.get('A2A-Version')!=='1.0')return json({error:'A2A version 1.0 required'},400);
    let id:unknown=null;
    const error=(code:number,message:string)=>json({jsonrpc:'2.0',id,error:{code,message}});
    try {
      const text=await req.text();if(text.length>5000)return error(-32600,'Request too large');
      let body;try{body=JSON.parse(text);}catch{return error(-32700,'Parse error');}
      if(body?.jsonrpc!=='2.0'||!(typeof body.id==='string'||typeof body.id==='number'))return error(-32600,'Invalid request');
      id=body.id;if(body.method!=='SendMessage')return error(-32601,'Method not found');
      const m=body.params?.message;
      if(m?.role!=='ROLE_USER'||typeof m.messageId!=='string'||!Array.isArray(m.parts)||m.parts.length!==1||typeof m.parts[0].text!=='string'||m.taskId||m.contextId)return error(-32602,'Send one new topic request');
      let input;try{input=JSON.parse(m.parts[0].text);}catch{return error(-32602,'Topic request must be JSON');}
      if(typeof input?.topic!=='string'||!input.topic.trim()||input.topic.length>200||typeof input.course!=='string'||input.course.length>150)return error(-32602,'Invalid course or topic');
      const brief=await research(input.course,input.topic);
      return json({jsonrpc:'2.0',id,result:{message:{messageId:crypto.randomUUID(),contextId:crypto.randomUUID(),role:'ROLE_AGENT',parts:[{data:brief,mediaType:'application/json'}]}}});
    } catch{return error(-32603,'Research temporarily unavailable');}
  };
}
