#!/usr/bin/env node
/*
Usage:
  $env:SUPABASE_URL="https://<project>.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="<service_role>"
  node scripts/import_cuet_to_supabase.mjs cuet_all_mcqs_text.clean.json

Notes:
- Run the SQL schema (below) in Supabase SQL Editor before importing.
- SERVICE_ROLE is required to insert server-side; keep it local only.
*/

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const [,, inPath] = process.argv;
if (!inPath) {
  console.error('Usage: node scripts/import_cuet_to_supabase.mjs <clean.json>');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function upsertPassage(text, source) {
  if (!text) return null;
  // Simple de-dup by hash of content length+first50
  const sig = `${text.length}:${text.slice(0,50)}`;
  const { data: existing, error: e1 } = await sb
    .from('cuet_passages')
    .select('id, sig')
    .eq('sig', sig)
    .limit(1)
    .maybeSingle();
  if (e1) throw e1;
  if (existing) return existing.id;
  const { data, error } = await sb
    .from('cuet_passages')
    .insert({ content: text, source, sig })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function importOne(item) {
  const passage_id = await upsertPassage(item.passage, item.source);

  const questionRow = {
    qid: item.id,
    subject: item.subject || null,
    section: item.section || null,
    type: item.type || 'MCQ',
    question: item.question,
    passage_id,
    answer_index: item.answer_index,
    solution: item.solution || null,
    difficulty: item.difficulty || null,
    topic: item.topic || null,
    source: item.source || null,
    tags: Array.isArray(item.tags) ? item.tags : [],
  };

  const { data: qData, error: qErr } = await sb
    .from('cuet_questions')
    .upsert(questionRow, { onConflict: 'qid' })
    .select('id')
    .single();
  if (qErr) throw qErr;
  const question_id = qData.id;

  // Clear existing options for this question_id then insert fresh
  const { error: delErr } = await sb.from('cuet_options').delete().eq('question_id', question_id);
  if (delErr) throw delErr;

  const options = (item.options || []).slice(0,4).map((text, idx) => ({ question_id, idx, text }));
  if (options.length) {
    const { error: optErr } = await sb.from('cuet_options').insert(options);
    if (optErr) throw optErr;
  }
}

async function main() {
  const items = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
  if (!Array.isArray(items)) throw new Error('Input must be an array');

  let ok = 0, fail = 0;
  // Process in small batches to avoid rate limits
  const batches = chunk(items, 50);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Batch ${i+1}/${batches.length} (size ${batch.length})`);
    for (const item of batch) {
      try {
        // Basic validation
        if (!item.question || !Array.isArray(item.options) || item.options.length !== 4) {
          fail++; continue;
        }
        await importOne(item);
        ok++;
      } catch (e) {
        fail++;
        console.error('Failed for', item.id, e.message);
      }
    }
  }
  console.log(`Imported OK: ${ok}, Failed: ${fail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
