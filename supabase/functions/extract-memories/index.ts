// ============================================================================
// extract-memories
// ----------------------------------------------------------------------------
// Mines any chat exchange (or single utterance) for long-term memories about
// the student: communication style, preferences, factual details, emotional
// signals, current state, and "where I left off" bookmarks.
//
// Call this fire-and-forget after every student turn. It's intentionally
// cheap: a single Gemini call + batched embedding + upsert.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callGeminiJSON, callGeminiEmbedding, GeminiMessage } from '../_shared/gemini.ts';
import { getCors } from '../_shared/cors.ts';

// CORS handled per-request via getCors()

interface ChatTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ExtractBody {
  messages: ChatTurn[];
  source?: string;         // chat | task_output | briefing | atlas
  source_id?: string;      // conversation id or similar
  bookmark_hint?: string;  // optional explicit bookmark ("left off on Rotational Q3")
}

interface MemoryCandidate {
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
  context?: string;
  confidence?: number;
}

const EXTRACTION_SYSTEM_PROMPT = `You are a long-term memory extractor for a JEE/CBSE study assistant.
Given a short conversation (possibly just one student message), extract any durable facts about THE STUDENT.

Extract aggressively but factually — even smallest hints count:
- Communication style: language mix (Hinglish/English), formality, humor, emoji use, verbosity, reading level.
- Preferences: study times, durations, formats (video/notes/practice), session length.
- Factual: target exam, target score, class, school, coaching institute, city, equipment, family context.
- Emotional: confidence, anxiety, frustration, motivation level — any phrase revealing mood.
- Skill: strengths/weaknesses mentioned in specific topics/subjects.
- Goal: explicit aims ("want to crack JEE Advanced", "improve Physics to 90%").
- Bookmark: "where the student left off" — the last concrete thing they were working on or asked about that a future mentor should resume from.

Rules:
- Only extract what is clearly implied. No guessing identity, diagnoses, or personal info not stated.
- Prefer durable, reusable facts over one-off questions.
- Each memory must have a SHORT stable \`key\` (snake_case, <= 40 chars) so future extractions collapse duplicates. E.g., "preferred_study_time", "target_exam", "weak_subject__physics", "tone_hinglish".
- \`value\` is the concrete content ("evening", "JEE 2027", "weak in kinematics", "prefers Hinglish with emojis").
- \`context\` (optional) is the ≤120-char excerpt that grounded the memory.
- \`confidence\` is 0..1 — be conservative.

Return ONLY valid JSON:
{
  "memories": [ { "memory_type": "...", "key": "...", "value": "...", "context": "...", "confidence": 0.0 } ]
}
If nothing extractable, return: { "memories": [] }`;

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

    const body = (await req.json()) as ExtractBody;
    const turns = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    if (turns.length === 0) {
      return new Response(JSON.stringify({ success: true, extracted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transcript = turns
      .map((t) => `${t.role === 'user' ? 'STUDENT' : t.role === 'assistant' ? 'MENTOR' : 'SYSTEM'}: ${t.content}`)
      .join('\n');

    // 1. Extract memories with Gemini
    const messages: GeminiMessage[] = [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Transcript:\n${transcript}\n\nExtract memories as JSON.`,
      },
    ];

    let result: { memories: MemoryCandidate[] } = { memories: [] };
    try {
      result = await callGeminiJSON<{ memories: MemoryCandidate[] }>(messages, {
        temperature: 0.15,
        maxOutputTokens: 1200,
      });
    } catch (err) {
      console.error('extract-memories: Gemini extract failed:', err);
      return new Response(
        JSON.stringify({ success: false, error: `extraction failed: ${err instanceof Error ? err.message : String(err)}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const candidates = Array.isArray(result?.memories) ? result.memories : [];

    // 2. If caller gave an explicit bookmark hint, add it
    if (body.bookmark_hint) {
      candidates.push({
        memory_type: 'bookmark',
        key: 'last_left_off',
        value: body.bookmark_hint.slice(0, 300),
        context: body.bookmark_hint.slice(0, 300),
        confidence: 0.95,
      });
    } else {
      // Auto-bookmark: the last student message is the most recent point of activity
      const lastStudent = [...turns].reverse().find((t) => t.role === 'user');
      if (lastStudent?.content && lastStudent.content.length > 8) {
        candidates.push({
          memory_type: 'bookmark',
          key: 'last_left_off',
          value: lastStudent.content.slice(0, 300),
          context: `Last said by student at ${new Date().toISOString()}`,
          confidence: 0.7,
        });
      }
    }

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ success: true, extracted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Generate embeddings in parallel (fail soft)
    const withEmbeddings = await Promise.all(
      candidates.map(async (m) => {
        try {
          const emb = await callGeminiEmbedding(`${m.key}: ${m.value}`, { taskType: 'RETRIEVAL_DOCUMENT' });
          return { ...m, embedding: emb };
        } catch (e) {
          console.warn('Embedding failed for memory:', m.key, e);
          return { ...m, embedding: null as number[] | null };
        }
      }),
    );

    // 4. Upsert via RPC (collapses duplicates on (user_id, memory_type, key))
    let saved = 0;
    for (const m of withEmbeddings) {
      try {
        const { error } = await supabaseClient.rpc('upsert_user_memory', {
          p_user_id: user.id,
          p_memory_type: m.memory_type,
          p_key: (m.key || 'misc').slice(0, 40),
          p_value: m.value,
          p_context: m.context || null,
          p_confidence: typeof m.confidence === 'number' ? Math.max(0, Math.min(1, m.confidence)) : 0.6,
          p_source: body.source || 'chat',
          p_source_id: body.source_id || null,
          p_extracted_from: transcript.slice(0, 500),
          p_embedding: m.embedding ?? null,
        });
        if (error) {
          console.error('upsert_user_memory error:', error);
        } else {
          saved += 1;
        }
      } catch (e) {
        console.error('upsert_user_memory crashed:', e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, extracted: saved, candidates: withEmbeddings.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('extract-memories fatal:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
