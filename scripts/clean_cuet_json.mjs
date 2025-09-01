#!/usr/bin/env node
/*
Usage:
  node scripts/clean_cuet_json.mjs cuet_all_mcqs_text.json cuet_clean.json cuet_rejects.json
*/

import fs from 'fs';

const [,, inPath, outCleanPath, outRejectsPath] = process.argv;
if (!inPath) {
  console.error('Usage: node scripts/clean_cuet_json.mjs <input.json> [clean_out.json] [rejects_out.json]');
  process.exit(1);
}
const CLEAN_OUT = outCleanPath || inPath.replace(/\.json$/i, '.clean.json');
const REJECTS_OUT = outRejectsPath || inPath.replace(/\.json$/i, '.rejects.json');

function normalizeWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function fixOCROptionsArtifacts(s) {
  // Fix common OCR misreads for option markers/content seen in provided file
  return s
    .replace(/Blectricity/gi, 'Electricity')
    .replace(/satel+ite/gi, 'satellite')
    .replace(/westher/gi, 'weather')
    .replace(/monitaring/gi, 'monitoring')
    .replace(/calamiies/gi, 'calamities')
    .replace(/telecommunicarion/gi, 'telecommunication')
    .replace(/obsenation/gi, 'observation')
    .replace(/Vaikanour/gi, 'Baikonur')
    .replace(/1SRO/g, 'ISRO')
    .replace(/8\)/g, 'B)')
    .replace(/\(8\)/g, '(B)')
    .replace(/©/g, 'C')
    .replace(/®/g, 'B')
    .replace(/\(0\)/g, '(D)')
    .replace(/\b0\)/g, 'D)')
    .replace(/\bO\)/g, 'D)')
    .replace(/\(Q\)/g, '(D)')
    .replace(/\(V\)/g, '(IV)')
    .replace(/\(1\b/g, '(I')
    .replace(/\b1\)/g, 'I)');
}

function fixOCRQuestionArtifacts(s) {
  let out = s;
  out = out.replace(/^Options\s*1\s*2\s*3\s*4\s*/i, '');
  out = out.replace(/^Q\.?\s*/i, '');
  out = fixOCROptionsArtifacts(out);
  return normalizeWhitespace(out);
}

function standardizeOptionsArray(opts) {
  if (!Array.isArray(opts)) return [];
  // Join and attempt to re-split if items look merged
  const flat = opts.map(o => (o ?? '').toString()).join(' ').trim();
  const cleanedFlat = fixOCROptionsArtifacts(flat);

  // Try to split by labeled markers A) B) C) D)
  const labeled = [];
  const re = /(?:\(|\b)([A-D])(?:\)|\.|\:|\))\s*([^A-D]*)/gi; // captures after A) up to next letter
  let m;
  while ((m = re.exec(cleanedFlat)) !== null) {
    const text = m[2].trim();
    if (text) labeled.push(text);
  }
  if (labeled.length === 4) {
    return labeled.map(x => normalizeWhitespace(x));
  }

  // Fallback: split by common separators if we already had 4 entries
  if (opts.length === 4) {
    return opts.map(o => normalizeWhitespace(fixOCROptionsArtifacts((o ?? '').toString())));
  }

  // Try splitting by two-or-more spaces or ' | '
  const splitGuess = cleanedFlat.split(/\s{2,}|\s\|\s|\s+\d\.?\s+/).map(s => s.trim()).filter(Boolean);
  if (splitGuess.length === 4) {
    return splitGuess.map(x => normalizeWhitespace(x));
  }

  // Give up; return normalized original array
  return opts.map(o => normalizeWhitespace(fixOCROptionsArtifacts((o ?? '').toString()))).filter(Boolean);
}

function deriveAnswerIndex(item) {
  if (Number.isInteger(item.answer_index) && item.answer_index >= 0 && item.answer_index <= 3) return item.answer_index;
  const chosen = item._chosen_option_index;
  if (Number.isInteger(chosen) && chosen >= 0 && chosen <= 3) return chosen;
  return null;
}

function cleanItem(raw) {
  const original = JSON.parse(JSON.stringify(raw));
  const item = { ...raw };

  // Normalize fields
  item.question = item.question ? fixOCRQuestionArtifacts(item.question) : '';
  item.subject = item.subject ? normalizeWhitespace(item.subject) : null;
  item.section = item.section ? normalizeWhitespace(item.section) : null;
  item.type = 'MCQ';
  item.source = item.source ? normalizeWhitespace(item.source) : null;
  item.passage = item.passage === '' ? null : (item.passage ? normalizeWhitespace(fixOCROptionsArtifacts(item.passage)) : null);

  // Options
  let options = standardizeOptionsArray(item.options || []);
  // Deduplicate identical options, keep order
  const seen = new Set();
  options = options.filter(o => {
    const k = o.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (options.length > 4) options = options.slice(0,4);
  item.options = options;

  // Answer
  item.answer_index = deriveAnswerIndex(item);

  // Tags
  item.tags = Array.isArray(item.tags) ? Array.from(new Set([...item.tags, 'cleaned_v1'])) : ['cleaned_v1'];

  // Remove internals
  delete item._question_id;
  delete item._option_ids;
  delete item._chosen_option_index;

  // Validation
  const rejects = [];
  if (!item.question || item.question.length < 5) rejects.push('empty_or_short_question');
  if (!Array.isArray(item.options) || item.options.length !== 4) rejects.push('bad_options_count');
  if (item.answer_index != null && (item.answer_index < 0 || item.answer_index > 3)) rejects.push('bad_answer_index');

  const valid = rejects.length === 0;
  return { valid, item, reason: rejects.join('|'), original };
}

function run() {
  const raw = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
  if (!Array.isArray(raw)) {
    console.error('Input must be a JSON array.');
    process.exit(1);
  }

  const clean = [];
  const rejects = [];

  for (const rec of raw) {
    const { valid, item, reason, original } = cleanItem(rec);
    if (valid) clean.push(item);
    else rejects.push({ id: rec.id, reason, original });
  }

  fs.writeFileSync(CLEAN_OUT, JSON.stringify(clean, null, 2), 'utf-8');
  fs.writeFileSync(REJECTS_OUT, JSON.stringify(rejects, null, 2), 'utf-8');
  console.log(`Cleaned: ${clean.length} | Rejected: ${rejects.length}`);
  console.log(`Wrote ${CLEAN_OUT}`);
  console.log(`Wrote ${REJECTS_OUT}`);
}

run();
