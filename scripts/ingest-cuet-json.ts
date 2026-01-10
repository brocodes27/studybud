import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JSON_FILE = path.resolve(__dirname, '../cuet_all_mcqs_text.clean.json');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_API_KEY) {
    console.error('Missing env variables. Check .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function ingest() {
    const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
    console.log(`Loading ${data.length} questions from JSON...`);

    for (let i = 0; i < data.length; i++) {
        const q = data[i];
        console.log(`[${i + 1}/${data.length}] Processing: ${q.question.slice(0, 50)}...`);

        try {
            // Generate embedding
            const embeddingResp = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: `${q.subject} ${q.topic || ''} ${q.question}`
            });
            const embedding = embeddingResp.data[0].embedding;

            const { error } = await supabase.from('cuet_question_bank').insert({
                question: q.question,
                options: q.options,
                correct_index: q.answer_index,
                subject: q.subject,
                topic: q.topic,
                difficulty: q.difficulty,
                source: q.source,
                embedding: embedding,
                qid: q.id || `json-${Date.now()}-${i}`,
                metadata: {
                    section: q.section,
                    type: q.type,
                    passage: q.passage,
                    tags: q.tags
                }
            });

            if (error) {
                console.error('Supabase insert error:', error.message);
            }
        } catch (e: any) {
            console.error('Failed to process question:', e.message);
            if (e.message.includes('429')) {
                console.log('Rate limited. Waiting 5s...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                i--; // Retry this one
            }
        }

        // Small delay to avoid aggressive rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('Ingestion complete!');
}

ingest();
