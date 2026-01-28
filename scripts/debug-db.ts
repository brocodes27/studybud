import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function debug() {
    console.log('--- DEBUGGING QUESTION BANK ---');

    const { data: samples, error } = await supabase
        .from('question_bank')
        .select('*')
        .eq('class_level', '12')
        .eq('subject', 'Physics')
        .limit(1);

    if (error) {
        console.error('Error fetching samples:', error);
        return;
    }

    if (!samples || samples.length === 0) {
        console.log('No Class 12 Physics questions found.');
        return;
    }

    console.log('Class 12 Physics Sample Row:', JSON.stringify(samples[0], null, 2));

    const { data: stats, error: statsError } = await supabase
        .from('question_bank')
        .select('class_level, subject, difficulty, chapter')
        .eq('class_level', '12')
        .eq('subject', 'Physics');

    if (statsError) {
        console.error('Error fetching stats:', statsError);
    } else {
        const chapters = [...new Set(stats.map(s => s.chapter))];
        const difficulties = [...new Set(stats.map(s => s.difficulty))];

        console.log('\n--- DATA FOR CLASS 12 PHYSICS ---');
        console.log('Unique Difficulties:', difficulties);
        console.log('Unique Chapters:', chapters);
    }
}

debug();
