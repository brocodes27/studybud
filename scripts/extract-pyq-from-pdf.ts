import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

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

// Configuration
const OUTPUT_DIR = 'pyq-extracted';
const DRY_RUN = process.argv.includes('--dry-run');
const AUTO_IMPORT = process.argv.includes('--auto-import');
const pdfPath = process.argv.find(arg => arg.endsWith('.pdf'));
const classLevel = process.argv.find(arg => arg.startsWith('--class='))?.split('=')[1];
const subject = process.argv.find(arg => arg.startsWith('--subject='))?.split('=')[1];
const year = process.argv.find(arg => arg.startsWith('--year='))?.split('=')[1];

async function extractTextFromPDF(pdfPath: string): Promise<string> {
    const data = new Uint8Array(readFileSync(pdfPath));
    const loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `\n--- Page ${i} ---\n${pageText}`;
    }

    return fullText;
}

async function callOpenAIText(text: string, prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert at extracting structured question data from raw PDF text. You MUST return valid JSON.'
                },
                {
                    role: 'user',
                    content: `${prompt}\n\nRAW PDF TEXT:\n${text.slice(0, 100000)}` // Limit text length
                }
            ],
            max_tokens: 16000,
            temperature: 0.3,
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function extractQuestionsFromPDF(
    pdfFilePath: string,
    classLevel: string,
    subject: string,
    year?: string
): Promise<any[]> {
    console.log('\n🔍 Extracting questions from PDF...');
    console.log(`  File: ${basename(pdfFilePath)}`);
    console.log(`  Class: ${classLevel}`);
    console.log(`  Subject: ${subject}`);
    if (year) console.log(`  Year: ${year}`);

    try {
        // Extract text
        console.log('\n📄 Extracting text from PDF (using pdfjs-dist)...');
        const text = await extractTextFromPDF(pdfFilePath);
        console.log(`  ✅ Extracted ${text.length} characters of text`);

        // Prepare Prompt
        const prompt = `You are extracting questions from a CBSE Class ${classLevel} ${subject} exam paper${year ? ` from ${year}` : ''}.

Extract ALL questions from the raw text and return them as a JSON object with a "questions" key containing the array.
The text may be messy due to PDF extraction. Use your intelligence to reconstruct questions.

For each question:
1. **Question Number**: Extract the exact question number (e.g., "1", "2(a)", "15")
2. **Question Text**: Reconstruct the complete question text.
   - Fix broken words or lines.
   - Use LaTeX for math formulas where appropriate (e.g., $x^2$).
3. **Question Type**: Determine the type:
   - "mcq" (1 mark)
   - "short" (2-3 marks)
   - "long" (4-6 marks)
4. **Marks**: Extract marks allocation (number only)
5. **MCQ Options**: If it's an MCQ, extract options.
6. **Correct Answer**: If visible (e.g. in marking scheme), extract it.
7. **Chapter**: Infer the chapter/topic.

Return ONLY a valid JSON object with this structure:
{
  "questions": [
    {
      "question_number": "1",
      "question": "Question text here...",
      "type": "mcq",
      "marks": 1,
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "chapter": "Topic"
    }
  ]
}

IMPORTANT:
- Return ONLY the JSON object.
- No markdown formatting.
- No explanations.`;

        // Call AI
        console.log('\n🤖 Analyzing text with GPT-4o...');
        console.log('  (This may take 30-60 seconds)');

        const response = await callOpenAIText(text, prompt);

        // Parse response
        let cleanResponse = response.trim();
        // Remove markdown code blocks if present (even with json mode, sometimes they appear)
        cleanResponse = cleanResponse.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

        try {
            const parsed = JSON.parse(cleanResponse);
            // Handle both array and object wrapper
            const questions = Array.isArray(parsed) ? parsed : parsed.questions;

            if (!Array.isArray(questions)) {
                throw new Error('Response is not a valid array or questions object');
            }

            console.log(`  ✅ Extracted ${questions.length} questions`);
            return questions;
        } catch (parseError) {
            // Save raw response for debugging
            const debugPath = join(process.cwd(), 'debug_response.txt');
            writeFileSync(debugPath, cleanResponse);
            console.error(`  ❌ JSON Parse Error. Raw response saved to ${debugPath}`);
            throw parseError;
        }

    } catch (error: any) {
        console.error(`\n❌ Extraction failed: ${error.message}`);
        throw error;
    }
}

function saveExtractedQuestions(
    questions: any[],
    classLevel: string,
    subject: string,
    year?: string
): string {
    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const filename = year
        ? `class${classLevel}-${subject.replace(/\s+/g, '_')}-${year}.json`
        : `class${classLevel}-${subject.replace(/\s+/g, '_')}.json`;

    const filepath = join(OUTPUT_DIR, filename);

    const output = {
        metadata: {
            class_level: classLevel,
            subject: subject,
            year: year || 'unknown',
            extracted_at: new Date().toISOString(),
            total_questions: questions.length
        },
        questions: questions
    };

    writeFileSync(filepath, JSON.stringify(output, null, 2));
    console.log(`\n💾 Saved to: ${filepath}`);
    return filepath;
}

async function importToDatabase(questions: any[], classLevel: string, subject: string) {
    console.log('\n📤 Importing to database...');

    if (DRY_RUN) {
        console.log('  🔍 DRY RUN: Skipping actual import');
        return;
    }

    // Try to find existing pool
    let { data: poolData, error: poolError } = await supabase
        .from('question_pools')
        .select('id')
        .eq('class_level', classLevel)
        .eq('subject', subject)
        .eq('cycle_start', new Date().toISOString().slice(0, 10))
        .maybeSingle();

    if (!poolData) {
        console.log('  Pool not found, creating new one...');
        const { data: newPool, error: createError } = await supabase
            .from('question_pools')
            .insert({
                class_level: classLevel,
                subject: subject,
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

    const rows = questions.map(q => ({
        pool_id: pool_id,
        class_level: classLevel,
        subject: subject,
        chapter: q.chapter || null,
        difficulty: q.difficulty || null,
        qtype: q.type === 'mcq' ? 'mcq' : q.type === 'short' ? 'short' : 'long',
        question: q.question,
        options: q.type === 'mcq' ? q.options : null,
        correct_index: q.type === 'mcq' ? q.correct_index : null,
        answer_text: q.type !== 'mcq' ? q.answer_text : null,
        explanation: q.explanation || null,
        year: year || null,
        question_number: q.question_number || null
    }));

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

    await supabase
        .from('question_pools')
        .update({ total_questions: imported })
        .eq('id', pool_id);

    console.log(`\n✅ Import complete: ${imported} questions added to database`);
}

async function main() {
    console.log('🎓 CBSE PYQ Extraction Tool (Text-based)\n');

    if (!pdfPath || !existsSync(pdfPath)) {
        console.error('❌ Error: PDF file not found');
        console.log('\nUsage:');
        console.log('  npx tsx scripts/extract-pyq-from-pdf.ts <path-to-pdf> --class=<10|12> --subject=<subject> [--year=2024] [--auto-import] [--dry-run]');
        console.log('\nExample:');
        console.log('  npx tsx scripts/extract-pyq-from-pdf.ts ./pyq-pdfs/math-2024.pdf --class=10 --subject=Mathematics --year=2024');
        process.exit(1);
    }

    if (!classLevel || !subject) {
        console.error('❌ Error: --class and --subject are required');
        process.exit(1);
    }

    console.log('Configuration:');
    console.log(`  Auto-import: ${AUTO_IMPORT ? 'YES' : 'NO'}`);
    console.log(`  Dry run: ${DRY_RUN ? 'YES' : 'NO'}`);

    try {
        const questions = await extractQuestionsFromPDF(pdfPath, classLevel, subject, year);
        const savedPath = saveExtractedQuestions(questions, classLevel, subject, year);

        console.log('\n📊 Summary:');
        console.log(`  Total questions: ${questions.length}`);
        const mcqs = questions.filter(q => q.type === 'mcq').length;
        const shorts = questions.filter(q => q.type === 'short').length;
        const longs = questions.filter(q => q.type === 'long').length;
        console.log(`  MCQs: ${mcqs}`);
        console.log(`  Short answers: ${shorts}`);
        console.log(`  Long answers: ${longs}`);

        if (AUTO_IMPORT) {
            await importToDatabase(questions, classLevel, subject);
        } else {
            console.log('\n💡 Next steps:');
            console.log(`  1. Review: ${savedPath}`);
            console.log(`  2. Import: npx tsx scripts/import-pyq-json.ts ${savedPath}`);
        }

        console.log('\n✨ Done!\n');

    } catch (error: any) {
        console.error('\n💥 Fatal error:', error.message);
        process.exit(1);
    }
}

main();
