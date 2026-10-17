import { agentInput, workspaceEvents } from './ag-ui';
import { supabase } from '../../lib/supabase';
import {
  type WorkspaceSnapshot,
  type WorkspaceEvent,
  type WorkspaceTool,
} from './contracts';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeader(): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return null;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return {
    Authorization: `Bearer ${token}`,
    apikey: anonKey,
    'Content-Type': 'application/json',
  };
}

export async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const headers = await getAuthHeader();
  if (!headers) throw new Error('Sign in to load your saved conversation.');
  const res = await fetch(`${FUNCTION_URL}/workspace-agent`, {
    method: 'POST', headers, body: JSON.stringify({ operation: 'load' }),
  });
  if (!res.ok) throw new Error('Could not load your saved conversation. Please retry.');
  return (await res.json()) as WorkspaceSnapshot;
}

export async function streamAgentRequest(
  body: Record<string, unknown>,
  onEvent: (event: WorkspaceEvent) => void,
  signal?: AbortSignal
): Promise<WorkspaceSnapshot | null> {
  const headers = await getAuthHeader();
  if (!headers) {
    throw new Error('Sign in to interact with your study workspace.');
  }

  const res = await fetch(`${FUNCTION_URL}/workspace-agent`, {
    method: 'POST',
    headers: {...headers, Accept:'text/event-stream'},
    body: JSON.stringify(agentInput(body)),
    signal,
  });

  if (!res.ok) {
    let errMessage = 'Could not complete agent action.';
    try {
      const err = await res.json();
      if (err?.error) errMessage = err.error;
    } catch {
      /* fallback */
    }
    throw new Error(errMessage);
  }

  // Handle cached response (application/json)
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (data?.snapshot) {
      onEvent({ type: 'done', snapshot: data.snapshot, result: data.result });
      return data.snapshot as WorkspaceSnapshot;
    }
    return null;
  }

  if (!res.body) {
    throw new Error('No stream body returned by workspace agent.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalSnapshot: WorkspaceSnapshot | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      if (done && buffer.trim()) lines.push(buffer);
      for (const line of lines) {
        if (!line.trim()) continue;
        if (contentType.includes('text/event-stream') && !line.startsWith('data:')) continue;
        const events = contentType.includes('text/event-stream') ? workspaceEvents(JSON.parse(line.slice(5).trim())) : [JSON.parse(line) as WorkspaceEvent];
        for (const ev of events) {
          onEvent(ev);
          if (ev.type === 'done' && ev.snapshot) finalSnapshot = ev.snapshot;
          if (ev.type === 'error') throw new Error(ev.error);
        }
      }
      if (done) break;
    }
    if (!finalSnapshot) throw new Error('The connection ended before your conversation finished saving. Please retry.');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  return finalSnapshot;
}

export async function sendWorkspaceMessage(
  text: string,
  onEvent: (event: WorkspaceEvent) => void,
  signal?: AbortSignal,
  requestId: string = crypto.randomUUID()
): Promise<WorkspaceSnapshot | null> {
  const localDate = new Date().toLocaleDateString('en-CA') + ' ' + Intl.DateTimeFormat().resolvedOptions().timeZone;
  return streamAgentRequest(
    {
      operation: 'message',
      requestId,
      text,
      localDate,
    },
    onEvent,
    signal
  );
}

export async function executeWorkspaceTool(
  tool: WorkspaceTool,
  onEvent: (event: WorkspaceEvent) => void,
  signal?: AbortSignal
): Promise<WorkspaceSnapshot | null> {
  const requestId: string = crypto.randomUUID();
  return streamAgentRequest(
    {
      operation: 'tool',
      localDate: new Date().toLocaleDateString('en-CA') + ' ' + Intl.DateTimeFormat().resolvedOptions().timeZone,
      requestId,
      tool,
    },
    onEvent,
    signal
  );
}

export async function activateWorkspaceArtifact(
  artifactId: string | null,
  onEvent: (event: WorkspaceEvent) => void = () => {},
  clearCheckpoint = artifactId === null
) {
  return streamAgentRequest({ operation: 'activate', requestId: crypto.randomUUID(), artifactId, clearCheckpoint }, onEvent);
}

let transcriptQueue: Promise<unknown> = Promise.resolve();
export async function recordWorkspaceTranscript(
  text: string,
  role: 'user' | 'assistant',
  requestId: string = crypto.randomUUID()
): Promise<void> {
  const saving = transcriptQueue.then(() => streamAgentRequest({operation: 'transcript', requestId, text, role}, () => {}));
  transcriptQueue = saving.catch(() => {});
  await saving;
}

async function voiceRequest(operation: 'status' | 'transcribe' | 'speak', body?: BodyInit, signal?: AbortSignal): Promise<Response> {
  const headers = await getAuthHeader();
  if (!headers) throw new Error('Sign in to use voice.');
  const response = await fetch(`${FUNCTION_URL}/workspace-voice?operation=${operation}`, {
    method: 'POST', headers: {...headers, 'Content-Type': operation === 'transcribe' ? 'audio/wav' : 'application/json'}, body, signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Voice is unavailable. You can keep typing.');
  }
  return response;
}

export async function checkVoiceAvailability(signal?: AbortSignal): Promise<void> {
  await voiceRequest('status', undefined, signal);
}
export async function transcribeVoiceAudio(audio: Blob, signal?: AbortSignal): Promise<string> {
  const response = await voiceRequest('transcribe', audio, signal);
  const data = await response.json();
  if (typeof data?.text !== 'string') throw new Error('Could not read the speech transcript.');
  return data.text;
}

export async function requestVoiceSpeech(text: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const response = await voiceRequest('speak', JSON.stringify({text}), signal);
  if (!response.headers.get('Content-Type')?.startsWith('audio/')) throw new Error('Could not play the spoken reply.');
  return response.arrayBuffer();
}
