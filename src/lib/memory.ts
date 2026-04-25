// ============================================================================
// Persistent user memory client SDK.
// Wraps the `extract-memories` / `recall-memories` edge functions with a
// simple, fire-and-forget friendly API for every chat surface.
// ============================================================================

import { supabase } from './supabase';

export interface ChatTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface UserMemory {
  id: string;
  memory_type:
    | 'preference'
    | 'communication_style'
    | 'factual'
    | 'emotional'
    | 'skill'
    | 'bookmark'
    | 'goal'
    | 'other';
  key: string;
  value: string;
  context?: string | null;
  confidence?: number;
  seen_count?: number;
  last_seen_at?: string;
  similarity?: number;
}

/**
 * Fire-and-forget memory extraction.
 * Call after every student turn. Never throws to the caller.
 *
 * Includes a short debounce + dedupe key so rapid-fire callers don't spam
 * the edge function (e.g., several tasks completed in a row).
 */
const pending = new Map<string, number>();

export function remember(
  messages: ChatTurn[],
  opts?: { source?: string; sourceId?: string; bookmarkHint?: string; debounceMs?: number },
): void {
  if (!messages || messages.length === 0) return;

  // Only look at last ~12 turns
  const payload = {
    messages: messages.slice(-12),
    source: opts?.source || 'chat',
    source_id: opts?.sourceId,
    bookmark_hint: opts?.bookmarkHint,
  };

  // Debounce identical consecutive payloads per source
  const key = `${payload.source}:${payload.source_id || 'none'}`;
  const last = pending.get(key);
  const now = Date.now();
  const debounce = opts?.debounceMs ?? 1500;
  if (last && now - last < debounce) return;
  pending.set(key, now);

  // Fire-and-forget
  void (async () => {
    try {
      await supabase.functions.invoke('extract-memories', { body: payload });
    } catch (err) {
      console.warn('remember() failed (non-fatal):', err);
    }
  })();
}

/**
 * Semantic + recency recall of memories relevant to `query`.
 * Safe to call before any AI response; returns [] and empty prompt_block on failure.
 */
export async function recall(
  query?: string,
  opts?: { limit?: number; types?: string[]; includeBaseline?: boolean },
): Promise<{ memories: UserMemory[]; promptBlock: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('recall-memories', {
      body: {
        query,
        limit: opts?.limit ?? 12,
        types: opts?.types,
        include_baseline: opts?.includeBaseline ?? true,
      },
    });
    if (error) {
      console.warn('recall() edge error:', error);
      return { memories: [], promptBlock: '' };
    }
    return {
      memories: (data?.memories || []) as UserMemory[],
      promptBlock: (data?.prompt_block || '') as string,
    };
  } catch (err) {
    console.warn('recall() failed:', err);
    return { memories: [], promptBlock: '' };
  }
}

/**
 * Synchronous read of cached memories straight from Supabase (no edge fn).
 * Useful for rendering a "What Ranjan Sir remembers" panel without hitting
 * the extraction/embedding pipeline.
 */
export async function listMemories(userId: string, limit = 50): Promise<UserMemory[]> {
  const { data, error } = await supabase
    .from('user_memory')
    .select('id, memory_type, key, value, context, confidence, seen_count, last_seen_at')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('listMemories failed:', error);
    return [];
  }
  return (data || []) as UserMemory[];
}

export async function forgetMemory(memoryId: string): Promise<boolean> {
  const { error } = await supabase.from('user_memory').delete().eq('id', memoryId);
  return !error;
}
