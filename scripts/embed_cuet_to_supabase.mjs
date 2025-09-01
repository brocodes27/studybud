#!/usr/bin/env node
/*
Create embeddings for CUET questions/passages and store in Supabase.

Prereq: run SQL in Supabase to create cuet_embeddings (see comments below).

Env:
  $env:SUPABASE_URL="https://<project>.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY="<service_role>"
  $env:OPENAI_API_KEY="sk-..."  (or use compatible key)

Usage:
  node scripts/embed_cuet_to_supabase.mjs [--limit 500] [--subject "Geography and Geology"]

Notes:
- Uses OpenAI embedding model: text-embedding-3-small (1536 dims)
- Batches to reduce API calls; skips rows that already exist by signature
*/

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

function httpsGetJson(urlStr, headers) {
  return new Promise((resolve, reject) => {
    try {
      const url = new NodeURL(urlStr);
      const options = {
        method: 'GET',
        hostname: url.hostname,
        path: url.pathname + (url.search || ''),
        protocol: url.protocol,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        headers: {
          'Accept': 'application/json',
          ...headers,
        },
      };
      const req = https.request(options, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          if (ok) {
            const trimmed = (body || '').trim();
            if (!trimmed) { resolve([]); return; }
            try { resolve(JSON.parse(trimmed)); } catch (e) { reject(new Error(`Invalid JSON: ${e.message}`)); }
          } else {
            resolve({ __error: true, status: res.statusCode, body });
          }
        });
      });
      req.on('error', reject);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}
// OPENAI_API_KEY is required only when not using the proxy path

const args = process.argv.slice(2);
const argMap = Object.fromEntries(args.map((a, i) => a.startsWith('--') ? [a.replace(/^--/, ''), args[i+1] && !args[i+1].startsWith('--') ? args[i+1] : true] : []));
const LIMIT = Number(argMap.limit || 500);
const SUBJECT = typeof argMap.subject === 'string' ? argMap.subject : null;


// Allow overriding model via env (fallback order)
const MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
// Batch size for embedding API calls (smaller reduces Bad Request risk)
const BATCH_SIZE = Number(process.env.OPENAI_EMBED_BATCH || 20);
// Truncate each input text to avoid request size issues
const MAX_TEXT_CHARS = Number(process.env.OPENAI_EMBED_MAX_CHARS || 1500);

function sigFromText(t) {
  const s = (t || '').slice(0, 500);
  return `${s.length}:${s}`;
}

async function fetchBatch(offset) {
  const params = new URLSearchParams();
  params.set('select', 'id,qid,subject,topic,question,answer_index,source');
  params.set('order', 'id.asc');
  params.set('limit', '100');
  params.set('offset', String(offset));
  if (SUBJECT) params.set('subject', `eq.${SUBJECT}`);
  const url = `${SUPABASE_URL}/rest/v1/cuet_questions?${params.toString()}`;
  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Accept': 'application/json',
  };
  const json = await httpsGetJson(url, headers);
  return Array.isArray(json) ? json : [];
}

import https from 'node:https';
import { URL as NodeURL } from 'node:url';

function httpsPostJson(urlStr, headers, payload) {
  return new Promise((resolve, reject) => {
    try {
      const url = new NodeURL(urlStr);
      const data = Buffer.from(payload, 'utf8');
      const options = {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname + (url.search || ''),
        protocol: url.protocol,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          ...headers,
        },
      };
      const req = https.request(options, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
          if (ok) {
            const trimmed = (body || '').trim();
            if (!trimmed) { resolve({ ok: true, status: res.statusCode }); return; }
            try { resolve(JSON.parse(trimmed)); } catch (e) { reject(new Error(`Invalid JSON: ${e.message}`)); }
          } else {
            resolve({ __error: true, status: res.statusCode, body });
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function openaiEmbed(texts) {
  const inputs = texts.map(t => (t || '').slice(0, MAX_TEXT_CHARS));
  const PROXY_URL = process.env.OPENAI_PROXY_URL; // e.g., https://<ref>.functions.supabase.co/openai-embeddings-proxy
  const PROXY_SECRET = process.env.OPENAI_PROXY_SECRET; // must match EMBEDDINGS_SHARED_SECRET on the function

  if (PROXY_URL) {
    const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    const headers = { 'x-embeddings-secret': PROXY_SECRET || '' };
    if (anon) {
      headers['Authorization'] = `Bearer ${anon}`;
      headers['apikey'] = anon;
    }
    const payload = JSON.stringify({ model: MODEL, input: inputs });
    const json = await httpsPostJson(PROXY_URL, headers, payload);
    if (json && json.__error) {
      let detail = json.body;
      try { const j = JSON.parse(json.body); detail = j.error?.message || j.message || json.body; } catch {}
      throw new Error(`Proxy error ${json.status}: ${detail}`);
    }
    return json.data.map(d => d.embedding);
  }

  // Fallback: direct OpenAI via fetch
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL, input: inputs })
  });
  if (!res.ok) {
    const bodyText = await res.text();
    let detail = bodyText;
    try { const j = JSON.parse(bodyText); detail = j.error?.message || j.message || bodyText; } catch {}
    throw new Error(`OpenAI error ${res.status}: ${detail}`);
  }
  const json = await res.json();
  return json.data.map(d => d.embedding);
}

function buildChunk(row) {
  // Build text from question and minimal meta only (no passage join)
  const text = `Subject: ${row.subject || ''}\nTopic: ${row.topic || ''}\nQuestion: ${row.question}`.trim();
  return text;
}

async function upsertEmbeddings(rows, embeddings) {
  const payload = rows.map((r, i) => ({
    question_id: r.id,
    passage_id: null,
    chunk: buildChunk(r),
    embedding: embeddings[i],
    subject: r.subject || null,
    topic: r.topic || null,
    meta: { qid: r.qid, source: r.source },
    sig: sigFromText(buildChunk(r)),
  }));
  const url = `${SUPABASE_URL}/rest/v1/cuet_embeddings?on_conflict=sig`;
  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Prefer': 'resolution=ignore-duplicates,return=minimal',
    'Content-Type': 'application/json',
  };
  const json = await httpsPostJson(url, headers, JSON.stringify(payload));
  if (json && json.__error) {
    throw new Error(`Supabase insert failed ${json.status}: ${json.body}`);
  }
}

// No client-side pre-check; duplicates ignored server-side via on_conflict=sig

async function main() {
  console.log('Embedding CUET questions...', SUBJECT ? `(subject=${SUBJECT})` : '');
  let offset = 0;
  let total = 0, inserted = 0, skipped = 0;

  while (total < LIMIT) {
    const rows = await fetchBatch(offset);
    if (!rows.length) break;
    offset += rows.length;

    // Send in smaller sub-batches to avoid request size errors
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const subRows = rows.slice(i, i + BATCH_SIZE);
      const subTexts = subRows.map(buildChunk);
      const embeddings = await openaiEmbed(subTexts);
      await upsertEmbeddings(subRows, embeddings);
      inserted += subRows.length; // duplicates ignored server-side
    }

    total += rows.length;
    console.log(`Processed ${total} | inserted ${inserted} | skipped ${skipped}`);
    if (total >= LIMIT) break;
  }
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
