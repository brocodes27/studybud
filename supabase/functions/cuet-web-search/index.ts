// supabase/functions/cuet-web-search/index.ts
// Deno Edge Function: Searches the web for CUET-style MCQs and normalizes them via OpenAI
// Env required: OPENAI_API_KEY (string), TAVILY_API_KEY (string)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

type Quota = { domain: string; take: number };

interface Payload {
  domains: string[];
  quotas: Quota[];
  total: number;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
    if (!TAVILY_API_KEY) throw new Error('TAVILY_API_KEY not set');

    const body = (await req.json()) as Payload;
    const { domains, quotas, total } = body || {} as Payload;
    if (!domains?.length || !quotas?.length || !total) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Build search queries per domain
    const queries = quotas.map(q => `${q.domain} CUET MCQ NCERT Class 12 multiple choice questions`).slice(0, 6);

    // Tavily search and aggregate text
    const results: Array<{ query: string; data: any } > = [];
    for (const q of queries) {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: TAVILY_API_KEY, query: q, search_depth: 'advanced', max_results: 5, include_answer: true, include_raw_content: true })
      });
      const json = await res.json();
      results.push({ query: q, data: json });
    }

    // Concatenate snippets and content for LLM
    const sources: string[] = [];
    for (const r of results) {
      const items: any[] = r.data?.results || [];
      for (const it of items) {
        const piece = [it.title, it.url, it.content?.slice?.(0, 1500) || it.content || it.snippet].filter(Boolean).join('\n');
        if (piece) sources.push(piece);
      }
    }

    const context = sources.slice(0, 15).join('\n\n---\n\n');
    const plan = quotas.map(q => `${q.domain}:${q.take}`).join(', ');

    const system = `You are an expert CUET-UG question setter. Extract or compose high-quality MCQs from the provided web context strictly following CUET-UG style.`;
    const user = `Create a mixed paper of exactly ${total} MCQs across these domain subjects with per-domain counts: ${plan}.
From the following web context, extract or compose questions faithful to NCERT Class 12 syllabus.

Return STRICT JSON array only (no extra text). Each item format:
{
  "subject": "<one of: ${domains.join(' | ')}>",
  "topic": "<syllabus topic>",
  "question": "<clear question>",
  "options": ["A","B","C","D"],
  "answer_index": <0..3>
}

Constraints:
- Options must be plausible and unique; exactly 4.
- answer_index must be correct.
- No explanations, no markdown fences; JSON array only.

Web context:
${context}`;

    // Call OpenAI Chat Completions
    const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [ { role: 'system', content: system }, { role: 'user', content: user } ],
        max_tokens: 3000,
        temperature: 0.2
      })
    });

    if (!oaiRes.ok) {
      const t = await oaiRes.text();
      throw new Error(`OpenAI error: ${oaiRes.status} ${t}`);
    }

    const oaiJson = await oaiRes.json();
    const text = oaiJson?.choices?.[0]?.message?.content || '[]';
    // Return raw text as JSON if possible
    let payload: any = [];
    try { payload = JSON.parse(text); } catch { payload = []; }

    return new Response(JSON.stringify({ items: payload }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
