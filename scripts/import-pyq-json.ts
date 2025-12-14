import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load environment variables
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const jsonPath = process.argv[2];
const DRY_RUN = process.argv.includes('--dry-run');

async function importFromJSON(filePath: string) {
    console.log('📥 Importing PYQ questions from JSON\n');
    console.log(`File: ${filePath}`);
    console.log(`Dry run: ${DRY_RUN ? 'YES' : 'NO'}\n`);

    try {
        // Read JSON file
        const fileContent = readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        const { metadata, questions } = data;

        console.log('📋 Metadata:');
        console.log(`  Class: ${metadata.class_level}`);
        console.log(`  Subject: ${metadata.subject}`);
        console.log(`  Year: ${metadata.year}`);
        console.log(`  Total questions: ${metadata.total_questions}\n`);

        if (DRY_RUN) {
            console.log('🔍 DRY RUN: Would import', questions.length, 'questions');
            return;
        }

        // Create or get pool
        // Try to find existing pool
        let { data: poolData, error: poolError } = await supabase
            .from('question_pools')
            .select('id')
            .eq('class_level', metadata.class_level)
            .eq('subject', metadata.subject)
            .eq('cycle_start', new Date().toISOString().slice(0, 10))
            .maybeSingle();

        if (!poolData) {
            console.log('  Pool not found, creating new one...');
            const { data: newPool, error: createError } = await supabase
                .from('question_pools')
                .insert({
                    class_level: metadata.class_level,
                    subject: metadata.subject,
                    cycle_start: new Date().toISOString().slice(0, 10),
                    cycle_end: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                    status: 'active'
                })
                .select('id')
                .single();

            if (createError) {
                throw new Error(`Failed to create pool: ${createError.message}`);
            }
            poolData = newPool;
        }

        const pool_id = poolData.id;
        console.log(`✅ Pool created/found: ${pool_id}\n`);

        // Prepare rows
        const rows = questions.map((q: any) => ({
            pool_id: pool_id,
            class_level: metadata.class_level,
            subject: metadata.subject,
            chapter: q.chapter || null,
            difficulty: q.difficulty || null,
            qtype: q.type === 'mcq' ? 'mcq' : q.type === 'short' ? 'short' : 'long',
            question: q.question,
            options: q.type === 'mcq' ? q.options : null,
            correct_index: q.type === 'mcq' ? (q.correct_index ?? null) : null,
            answer_text: q.type !== 'mcq' ? (q.answer_text || null) : null,
            explanation: q.explanation || null,
            year: metadata.year !== 'unknown' ? metadata.year : null,
            question_number: q.question_number || null
        }));

        // Insert in batches
        console.log('📤 Importing to database...');
        const batchSize = 100;
        let imported = 0;

        for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const { error } = await supabase.from('question_bank').insert(batch);

            if (error) {
                console.error(`  ❌ Batch ${i / batchSize + 1} failed: ${error.message}`);
            } else {
                imported += batch.length;
                console.log(`  ✅ Imported ${imported}/${rows.length} questions`);
            }
        }

        // Update pool count
        await supabase
            .from('question_pools')
            .update({ total_questions: imported })
            .eq('id', pool_id);

        console.log(`\n✅ Import complete!`);
        console.log(`  ${imported} questions added to database`);
        console.log(`  Pool ID: ${pool_id}\n`);

    } catch (error: any) {
        console.error('💥 Error:', error.message);
        process.exit(1);
    }
}

if (!jsonPath) {
    console.error('❌ Error: JSON file path required');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/import-pyq-json.ts <path-to-json> [--dry-run]');
    console.log('\nExample:');
    console.log('  npx tsx scripts/import-pyq-json.ts pyq-extracted/class10-Mathematics-2024.json');
    process.exit(1);
}

importFromJSON(jsonPath);
