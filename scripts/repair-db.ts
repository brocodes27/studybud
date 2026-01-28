import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;
if (!serviceKey) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY. Cannot update database without service role permissions.');
    process.exit(1);
}

const supabase = createClient(process.env.VITE_SUPABASE_URL!, serviceKey);

async function repair() {
    console.log('--- REPAIRING QUESTION BANK ---');
    console.log('Setting difficulty to "easy" for all rows where it is null...');

    const { data, error, count } = await supabase
        .from('question_bank')
        .update({ difficulty: 'easy' })
        .is('difficulty', null)
        .select('id', { count: 'exact' });

    if (error) {
        console.error('Error repairing rows:', error);
        return;
    }

    console.log(`Successfully repaired ${count || 0} rows.`);
}

repair();
