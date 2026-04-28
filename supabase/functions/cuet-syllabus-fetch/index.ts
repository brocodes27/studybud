// supabase/functions/cuet-syllabus-fetch/index.ts
// Deno Edge Function: Fetches CUET-UG domain syllabi via Tavily search and normalizes with Gemini
// Env: GEMINI_API_KEY, TAVILY_API_KEY

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { callGemini } from '../_shared/gemini.ts';
import { getCors } from '../_shared/cors.ts';

type FetchPayload = {
  subjects: string[]; // CUET domain subject names
  year?: string; // e.g., "2025"
};

Deno.serve(async (req: Request) => {
  const cors = getCors(req);
  const corsHeaders = cors.headers;
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY');
    if (!TAVILY_API_KEY) throw new Error('TAVILY_API_KEY not set');

    const body = (await req.json()) as FetchPayload;
    const subjects = Array.isArray(body?.subjects) ? body.subjects : [];
    const year = (body?.year || '2025').toString();
    if (subjects.length === 0) {
      return new Response(JSON.stringify({ error: 'subjects array required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Helper: Tavily search for each subject and collect content
    async function searchSubject(subject: string) {
      const query = `${subject} CUET UG syllabus ${year} NCERT Class 12 official PDF`;
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query,
          search_depth: 'advanced',
          max_results: 6,
          include_answer: true,
          include_raw_content: true
        })
      });
      const json = await res.json();
      const items: any[] = json?.results || [];
      const sources: { title: string; url: string; content: string }[] = [];
      for (const it of items) {
        const content = it.content?.slice?.(0, 3000) || it.content || it.snippet || '';
        if (content) sources.push({ title: it.title || '', url: it.url || '', content });
      }
      return { subject, sources };
    }

    // Fetch in parallel but cap concurrency by chunks of 4
    const chunks: string[][] = [];
    for (let i = 0; i < subjects.length; i += 4) chunks.push(subjects.slice(i, i + 4));
    const collected: Array<{ subject: string; sources: { title: string; url: string; content: string }[] }> = [];
    for (const ch of chunks) {
      const part = await Promise.all(ch.map(searchSubject));
      collected.push(...part);
    }

    // Build OpenAI prompts per subject to summarize into structured syllabus topics
    const results: any[] = [];
    for (const entry of collected) {
      const context = entry.sources.map(s => `Title: ${s.title}\nURL: ${s.url}\n${s.content}`).join('\n\n---\n\n');
      const system = `You are an expert educational content curator for CUET-UG. Extract the official syllabus topics for the subject. Return STRICT JSON only.`;
      const user = `Subject: ${entry.subject}\nYear: ${year}\n\nFrom the web context below, extract a clean hierarchical syllabus aligned to NCERT Class 12 and CUET-UG official notices.\n\nReturn this JSON shape only (no markdown):\n{\n  "subject": "${entry.subject}",\n  "year": "${year}",\n  "topics": [\n    { "unit": "string", "subtopics": ["string", "string", "..."] }\n  ],\n  "sources": [ { "title": "string", "url": "string" } ]\n}\n\nWeb context:\n${context}`;

      const text = await callGemini(
        [ { role: 'system', content: system }, { role: 'user', content: user } ],
        { temperature: 0.2, maxOutputTokens: 3000, json: true }
      );
      let payload: any = {};
      try { payload = JSON.parse(text.replace(/```json|```/gi, '').trim()); } catch { payload = {}; }
      // Attach top 5 sources with title/url
      payload.sources = entry.sources.slice(0, 5).map(s => ({ title: s.title, url: s.url }));
      results.push(payload);
    }

    return new Response(JSON.stringify({ items: results }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
