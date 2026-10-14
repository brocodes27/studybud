import { EventType, type RunAgentInput } from '@ag-ui/core';
import { EventSchema, RunAgentInputSchema } from '@ag-ui/core/schemas';
import type { AgentAction, WorkspaceEvent, WorkspaceSnapshot, WorkspaceThread } from './contracts';

export function agentInput(body: Record<string, unknown>): RunAgentInput {
  return RunAgentInputSchema.parse({threadId:'workspace',runId:body.requestId,protocolVersion:'1.0',messages:body.operation === 'message' ? [{id:body.requestId,role:'user',content:body.text}] : [],tools:[],context:[],forwardedProps:body});
}

export function workspaceEvents(raw: unknown): WorkspaceEvent[] {
  const event = EventSchema.parse(raw);
  switch (event.type) {
    case EventType.TEXT_MESSAGE_CONTENT: return [{type:'text',text:event.delta}];
    case EventType.TOOL_CALL_START: return [{type:'action',action:{id:event.toolCallId,name:event.toolCallName,status:'running'}}];
    case EventType.TOOL_CALL_RESULT: {
      const action = JSON.parse(String(event.content)) as AgentAction;
      if (!action.id || !['completed','failed'].includes(action.status)) throw new Error('Invalid action result.');
      return [{type:'action',action}];
    }
    case EventType.STATE_SNAPSHOT: {
      const state = event.snapshot as {thread?: WorkspaceThread};
      return state?.thread ? [{type:'state',thread:state.thread}] : [];
    }
    case EventType.RUN_FINISHED: {
      const data = event.result as {snapshot?: WorkspaceSnapshot;result?:unknown} | undefined;
      if (!data?.snapshot?.thread || !Array.isArray(data.snapshot.messages)) throw new Error('The conversation did not finish saving.');
      return [{type:'done',snapshot:data.snapshot,result:data.result}];
    }
    case EventType.RUN_ERROR: return [{type:'error',error:event.message}];
    default: return [];
  }
}
