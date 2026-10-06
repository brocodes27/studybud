import { supabase } from '../../lib/supabase';
import type {
  WorkspaceSnapshot,
  WorkspaceEvent,
  WorkspaceTool,
} from './contracts';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function getAuthHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return {
    Authorization: `Bearer ${token || anonKey}`,
    apikey: anonKey,
    'Content-Type': 'application/json',
  };
}

export async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const headers = await getAuthHeader();
  const res = await fetch(`${FUNCTION_URL}/workspace-agent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ operation: 'load' }),
  });

  if (!res.ok) {
    let errMessage = 'Could not load workspace.';
    try {
      const err = await res.json();
      if (err?.error) errMessage = err.error;
    } catch {
      /* fallback */
    }
    throw new Error(errMessage);
  }

  return (await res.json()) as WorkspaceSnapshot;
}

export async function streamAgentRequest(
  body: Record<string, unknown>,
  onEvent: (event: WorkspaceEvent) => void,
  signal?: AbortSignal
): Promise<WorkspaceSnapshot | null> {
  const headers = await getAuthHeader();
  const res = await fetch(`${FUNCTION_URL}/workspace-agent`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
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

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const ev = JSON.parse(trimmed) as WorkspaceEvent;
        onEvent(ev);
        if (ev.type === 'done' && ev.snapshot) {
          finalSnapshot = ev.snapshot;
        } else if (ev.type === 'error') {
          throw new Error(ev.error);
        }
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
          throw e;
        }
      }
    }

    if (done) break;
  }

  return finalSnapshot;
}

export async function sendWorkspaceMessage(
  text: string,
  onEvent: (event: WorkspaceEvent) => void,
  signal?: AbortSignal
): Promise<WorkspaceSnapshot | null> {
  const requestId = crypto.randomUUID();
  const localDate = new Date().toISOString();
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
  const requestId = crypto.randomUUID();
  return streamAgentRequest(
    {
      operation: 'tool',
      requestId,
      tool,
    },
    onEvent,
    signal
  );
}

export async function activateWorkspaceArtifact(
  artifactId: string
): Promise<void> {
  const requestId = crypto.randomUUID();
  const headers = await getAuthHeader();
  const res = await fetch(`${FUNCTION_URL}/workspace-agent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      operation: 'activate',
      requestId,
      artifactId,
    }),
  });

  if (!res.ok) {
    let errMessage = 'Could not activate artifact.';
    try {
      const err = await res.json();
      if (err?.error) errMessage = err.error;
    } catch {
      /* fallback */
    }
    throw new Error(errMessage);
  }
}

export async function recordWorkspaceTranscript(
  text: string,
  role: 'user' | 'assistant'
): Promise<void> {
  const requestId = crypto.randomUUID();
  const headers = await getAuthHeader();
  await fetch(`${FUNCTION_URL}/workspace-agent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      operation: 'transcript',
      requestId,
      text,
      role,
    }),
  });
}

export async function requestVoiceSession(): Promise<{
  token: string;
  model: string;
  config: unknown;
  checkpointId: string | null;
}> {
  const requestId = crypto.randomUUID();
  const headers = await getAuthHeader();
  const res = await fetch(`${FUNCTION_URL}/workspace-voice-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ requestId }),
  });

  if (!res.ok) {
    let errMessage = 'Voice is unavailable right now.';
    try {
      const err = await res.json();
      if (err?.error) errMessage = err.error;
    } catch {
      /* fallback */
    }
    throw new Error(errMessage);
  }

  return (await res.json()) as {
    token: string;
    model: string;
    config: unknown;
    checkpointId: string | null;
  };
}
