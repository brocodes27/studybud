import type { WorkspaceEvent } from './workspace-contracts.ts';

/** AG-UI 1.0 SSE adapter. Verified against @ag-ui/core's official event schemas. */
export function agUIStream(threadId: string, runId: string, write: (event: Record<string, unknown>) => void) {
  const messageId = `${runId}:assistant`;
  let textStarted = false;
  const send = (event: Record<string, unknown>) => write({...event,timestamp:Date.now()});
  send({type:'RUN_STARTED',threadId,runId});
  const closeText = () => { if (textStarted) { send({type:'TEXT_MESSAGE_END',messageId}); textStarted=false; } };
  return (event: WorkspaceEvent) => {
    if (event.type === 'text') {
      if (!textStarted) { send({type:'TEXT_MESSAGE_START',messageId,role:'assistant'}); textStarted=true; }
      send({type:'TEXT_MESSAGE_CONTENT',messageId,delta:event.text});
    } else if (event.type === 'action') {
      const a = event.action;
      if (a.status === 'running') {
        send({type:'TOOL_CALL_START',toolCallId:a.id,toolCallName:a.name});
        send({type:'TOOL_CALL_ARGS',toolCallId:a.id,delta:'{}'});
        send({type:'TOOL_CALL_END',toolCallId:a.id});
      } else send({type:'TOOL_CALL_RESULT',toolCallId:a.id,messageId:`${a.id}:result`,role:'tool',content:JSON.stringify(a)});
    } else if (event.type === 'state') {
      send({type:'STATE_SNAPSHOT',snapshot:{thread:event.thread}});
    } else if (event.type === 'done') {
      closeText();
      send({type:'STATE_SNAPSHOT',snapshot:event.snapshot});
      send({type:'MESSAGES_SNAPSHOT',messages:event.snapshot.messages.map(m => ({id:m.id,role:m.role,content:m.content}))});
      send({type:'RUN_FINISHED',threadId,runId,result:{snapshot:event.snapshot,result:event.result}});
    } else {
      closeText();
      send({type:'RUN_ERROR',message:event.error,code:'WORKSPACE_ERROR'});
    }
  };
}

export function normalizeAgentInput(raw: Record<string, any>, threadId: string) {
  if (!raw.runId) return raw; // Existing voice/action clients remain compatible.
  if (raw.threadId !== 'workspace' && raw.threadId !== threadId) throw new Error('Conversation unavailable.');
  const props = raw.forwardedProps || {};
  const last = Array.isArray(raw.messages) ? raw.messages.at(-1) : null;
  // Client history/state/tool definitions never replace authoritative server data.
  return {...props,operation:props.operation || 'message',requestId:raw.runId,text:last?.role === 'user' && typeof last.content === 'string' ? last.content : props.text};
}
