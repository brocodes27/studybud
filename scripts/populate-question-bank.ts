import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
config();

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Subject definitions
const SUBJECTS = {
    '10': ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi'],
    '12': [
        'Physics',
        'Chemistry',
        'Mathematics',
        'Biology',
        'Accountancy',
        'Business Studies',
        'Economics',
        'Computer Science',
        'Political Science',
        'History',
        'Geography',
        'Psychology',
        'Sociology'
    ]
};

// Configuration
const TARGET_QUESTIONS_PER_SUBJECT = 200;
const DELAY_BETWEEN_CALLS_MS = 2000;
const DRY_RUN = process.argv.includes('--dry-run');
const TEST_MODE = process.argv.includes('--test');
const SPECIFIC_CLASS = process.argv.find(arg => arg.startsWith('--class='))?.split('=')[1];
const SPECIFIC_SUBJECT = process.argv.find(arg => arg.startsWith('--subject='))?.split('=')[1];

// Helper functions
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const formatSubject = (subject: string) => subject.replace(/\s+/g, '_');

async function checkExistingQuestions(classLevel: string, subject: string): Promise<number> {
    const { count, error } = await supabase
        .from('question_bank')
        .select('id', { count: 'exact', head: true })
        .eq('class_level', classLevel)
        .eq('subject', subject);

    if (error) {
        console.warn(`  ⚠️  Could not check existing questions: ${error.message}`);
        return 0;
    }

    return count || 0;
}

async function generateQuestionsForSubject(
    classLevel: string,
    subject: string,
    targetCount: number
): Promise<{ success: boolean; generated: number; error?: string }> {
    try {
        console.log(`\n📚 Class ${classLevel} - ${subject}`);

        // Check existing questions
        const existing = await checkExistingQuestions(classLevel, subject);
        console.log(`  Current: ${existing} questions`);

        if (existing >= targetCount) {
            console.log(`  ✅ Already has ${existing} questions (target: ${targetCount}). Skipping.`);
            return { success: true, generated: 0 };
        }

        const needed = targetCount - existing;
        console.log(`  🎯 Need to generate: ${needed} questions`);

        if (DRY_RUN) {
            console.log(`  🔍 DRY RUN: Would call Edge Function with target_count=${needed}`);
            return { success: true, generated: 0 };
        }

        // Call the Edge Function
        console.log(`  ⚙️  Calling build-question-pool Edge Function...`);
        const startTime = Date.now();

        const { data, error } = await supabase.functions.invoke('build-question-pool', {
            body: {
                class_level: classLevel,
                subject: subject,
                target_count: needed
            }
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        if (error) {
            throw new Error(error.message || 'Edge Function error');
        }

        if (!data?.ok) {
            throw new Error(data?.error || 'Unknown error from Edge Function');
        }

        console.log(`  ✅ Generated ${data.total_questions} questions in ${duration}s`);
        console.log(`  📦 Pool ID: ${data.pool_id}`);

        return { success: true, generated: data.total_questions };

    } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}`);
        return { success: false, generated: 0, error: error.message };
    }
}

async function main() {
    console.log('🚀 CBSE Question Bank Population Script\n');
    console.log('Configuration:');
    console.log(`  Target per subject: ${TARGET_QUESTIONS_PER_SUBJECT} questions`);
    console.log(`  Delay between calls: ${DELAY_BETWEEN_CALLS_MS}ms`);
    console.log(`  Dry run: ${DRY_RUN ? 'YES' : 'NO'}`);
    console.log(`  Test mode: ${TEST_MODE ? 'YES (Class 12 Physics only)' : 'NO'}`);
    if (SPECIFIC_CLASS) console.log(`  Filter: Class ${SPECIFIC_CLASS} only`);
    if (SPECIFIC_SUBJECT) console.log(`  Filter: Subject "${SPECIFIC_SUBJECT}" only`);
    console.log('');

    const results: Array<{
        class: string;
        subject: string;
        success: boolean;
        generated: number;
        error?: string;
    }> = [];

    // Test mode: Only Class 12 Physics
    if (TEST_MODE) {
        console.log('🧪 TEST MODE: Generating for Class 12 Physics only\n');
        const result = await generateQuestionsForSubject('12', 'Physics', TARGET_QUESTIONS_PER_SUBJECT);
        results.push({ class: '12', subject: 'Physics', ...result });
    } else {
        // Full run
        for (const [classLevel, subjects] of Object.entries(SUBJECTS)) {
            if (SPECIFIC_CLASS && classLevel !== SPECIFIC_CLASS) continue;

            console.log(`\n${'='.repeat(60)}`);
            console.log(`CLASS ${classLevel}`);
            console.log('='.repeat(60));

            for (const subject of subjects) {
                if (SPECIFIC_SUBJECT && subject !== SPECIFIC_SUBJECT) continue;

                const result = await generateQuestionsForSubject(
                    classLevel,
                    subject,
                    TARGET_QUESTIONS_PER_SUBJECT
                );

                results.push({ class: classLevel, subject, ...result });

                // Rate limiting
                if (!DRY_RUN && result.success) {
                    console.log(`  ⏱️  Waiting ${DELAY_BETWEEN_CALLS_MS}ms before next call...`);
                    await sleep(DELAY_BETWEEN_CALLS_MS);
                }
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalGenerated = results.reduce((sum, r) => sum + r.generated, 0);

    console.log(`\nTotal subjects processed: ${results.length}`);
    console.log(`  ✅ Successful: ${successful}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📝 Total questions generated: ${totalGenerated}`);

    if (failed > 0) {
        console.log('\n❌ Failed subjects:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`  - Class ${r.class} ${r.subject}: ${r.error}`);
        });
    }

    console.log('\n✨ Done!\n');

    // Exit with error code if any failed
    process.exit(failed > 0 ? 1 : 0);
}

// Run
main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
