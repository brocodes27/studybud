import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

if (!OPENAI_API_KEY) {
    console.error('❌ Missing OpenAI API key (VITE_OPENAI_API_KEY)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: text
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
}

async function main() {
    console.log('🧠 Generating Embeddings for Question Bank...\n');

    // Fetch questions without embeddings
    // Note: We check for null embedding. 
    // Since we can't easily filter by "embedding is null" with standard PostgREST without specific setup sometimes,
    // we'll fetch a batch and check client side or use a specific filter if possible.
    // Actually, Supabase JS supports .is('embedding', null)

    let processed = 0;
    const BATCH_SIZE = 50;

    while (true) {
        const { data: questions, error } = await supabase
            .from('question_bank')
            .select('id, question, class_level, subject, chapter')
            .is('embedding', null)
            .limit(BATCH_SIZE);

        if (error) {
            console.error('❌ Error fetching questions:', error.message);
            process.exit(1);
        }

        if (!questions || questions.length === 0) {
            console.log('✅ No more questions to process.');
            break;
        }

        console.log(`🔄 Processing batch of ${questions.length} questions...`);

        for (const q of questions) {
            try {
                // Create a rich text representation for embedding
                const textToEmbed = `Class: ${q.class_level}, Subject: ${q.subject}, Chapter: ${q.chapter || 'Unknown'}\nQuestion: ${q.question}`;

                const embedding = await generateEmbedding(textToEmbed);

                const { error: updateError } = await supabase
                    .from('question_bank')
                    .update({ embedding })
                    .eq('id', q.id);

                if (updateError) {
                    console.error(`  ❌ Failed to update question ${q.id}:`, updateError.message);
                } else {
                    // console.log(`  ✅ Embedded question ${q.id}`);
                    process.stdout.write('.');
                }
            } catch (err: any) {
                console.error(`  ❌ Failed to generate embedding for ${q.id}:`, err.message);
            }
        }

        processed += questions.length;
        console.log(`\n✨ Processed ${processed} questions so far.`);

        // Rate limiting pause
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n🎉 Embedding generation complete!');
}

main();
