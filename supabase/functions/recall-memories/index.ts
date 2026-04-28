// ============================================================================
// recall-memories
// ----------------------------------------------------------------------------
// Returns relevant memories for a given query. Used by any agent surface
// (Atlas, Conversational Briefing, study buddy) to prime its response with
// persistent context about the student.
//
// Strategy:
//   1. Always fetch a baseline: top bookmarks + top recent memories by type.
//   2. If a `query` is provided, do semantic recall via pgvector.
//   3. Merge + dedupe and return.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callGeminiEmbedding } from '../_shared/gemini.ts';
import { getCors } from '../_shared/cors.ts';

// CORS handled per-request via getCors()

interface RecallBody {
  query?: string;
  limit?: number;
  types?: string[];
  include_baseline?: boolean; // default true — always pull bookmark + style
}

serve(async (req: Request) => {
  const cors = getCors(req);
  const corsHeaders = cors.headers;
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as RecallBody;
    const limit = Math.min(Math.max(body.limit ?? 12, 1), 30);
    const includeBaseline = body.include_baseline !== false;

    const byId = new Map<string, any>();

    // 1. Baseline: always grab the freshest bookmark + communication style + goals
    if (includeBaseline) {
      const { data: baseline } = await supabaseClient
        .from('user_memory')
        .select('id, memory_type, key, value, context, confidence, seen_count, last_seen_at')
        .eq('user_id', user.id)
        .in('memory_type', ['bookmark', 'communication_style', 'goal', 'factual'])
        .order('last_seen_at', { ascending: false })
        .limit(10);
      for (const row of baseline || []) {
        byId.set(row.id, { ...row, similarity: 1 });
      }
    }

    // 2. Semantic recall if query provided
    if (body.query && body.query.trim().length > 2) {
      try {
        const emb = await callGeminiEmbedding(body.query, { taskType: 'RETRIEVAL_QUERY' });
        const { data: matches, error: matchErr } = await supabaseClient.rpc('match_user_memory', {
          p_user_id: user.id,
          p_query_embedding: emb,
          p_match_count: limit,
          p_min_similarity: 0.35,
          p_types: body.types && body.types.length ? body.types : null,
        });
        if (!matchErr && matches) {
          for (const row of matches) byId.set(row.id, row);
        }
      } catch (e) {
        console.warn('Semantic recall failed, falling back to recency:', e);
      }
    }

    // 3. If we still have nothing, just return recent-by-type
    if (byId.size === 0) {
      const { data: recent } = await supabaseClient
        .from('user_memory')
        .select('id, memory_type, key, value, context, confidence, seen_count, last_seen_at')
        .eq('user_id', user.id)
        .order('last_seen_at', { ascending: false })
        .limit(limit);
      for (const row of recent || []) byId.set(row.id, { ...row, similarity: 0.5 });
    }

    const memories = Array.from(byId.values())
      .sort((a, b) => {
        // Prioritise bookmarks, then similarity, then recency
        if (a.memory_type === 'bookmark' && b.memory_type !== 'bookmark') return -1;
        if (b.memory_type === 'bookmark' && a.memory_type !== 'bookmark') return 1;
        const simDiff = (b.similarity || 0) - (a.similarity || 0);
        if (simDiff !== 0) return simDiff;
        return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
      })
      .slice(0, limit);

    // 4. Build a compact prompt block the caller can paste into a system message
    const promptBlock = buildPromptBlock(memories);

    return new Response(
      JSON.stringify({ success: true, memories, prompt_block: promptBlock }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('recall-memories fatal:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildPromptBlock(memories: any[]): string {
  if (!memories.length) return '';
  const byType: Record<string, string[]> = {};
  for (const m of memories) {
    const line = `- ${m.value}${m.context ? ` (${m.context.slice(0, 80)})` : ''}`;
    (byType[m.memory_type] ||= []).push(line);
  }
  const order = ['bookmark', 'communication_style', 'preference', 'goal', 'factual', 'emotional', 'skill', 'other'];
  const sections: string[] = [];
  for (const t of order) {
    if (byType[t]?.length) {
      sections.push(`${labelFor(t)}:\n${byType[t].join('\n')}`);
    }
  }
  return `What I remember about this student:\n\n${sections.join('\n\n')}`;
}

function labelFor(t: string): string {
  return {
    bookmark: 'Where they left off',
    communication_style: 'How they talk',
    preference: 'Preferences',
    goal: 'Goals',
    factual: 'Facts',
    emotional: 'Emotional state',
    skill: 'Skill signals',
    other: 'Other',
  }[t] || t;
}
