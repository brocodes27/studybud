import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const PDF_DIR = path.resolve(__dirname, '../pyq-pdfs/cuet');
const TEMP_IMG_DIR = path.resolve(__dirname, '../scripts/temp_imgs');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;

if (!fs.existsSync(TEMP_IMG_DIR)) fs.mkdirSync(TEMP_IMG_DIR, { recursive: true });

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_API_KEY) {
    console.error('Missing env variables. Check .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function getPdfPageCount(filePath: string): Promise<number> {
    const info = execSync(`npx pdf-parse info "${filePath}"`).toString();
    const match = info.match(/Total pages:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

async function extractQuestionsFromImage(imagePath: string, sourceFile: string) {
    console.log(`Extracting questions from image: ${path.basename(imagePath)}...`);
    const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are a data extraction assistant. Extract multiple-choice questions from the provided image of an exam paper. Return a JSON array."
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Extract all MCQs from this image. Format as a JSON array where each object has: question, options (array of 4), correct_index (0-3 or null), subject, topic, difficulty." },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/png;base64,${imageBase64}`
                            }
                        }
                    ]
                }
            ],
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        const result = JSON.parse(content || "{}");
        const questions = result.questions || result;

        if (Array.isArray(questions)) {
            console.log(`Found ${questions.length} questions.`);
            for (const q of questions) {
                await ingestQuestion(q, sourceFile);
            }
        }
    } catch (e: any) {
        console.error('Error extracting from image', e.message);
    }
}

async function ingestQuestion(q: any, source: string) {
    try {
        const embeddingResp = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: `${q.subject || ''} ${q.topic || ''} ${q.question || ''}`
        });
        const embedding = embeddingResp.data[0].embedding;

        const { error } = await supabase.from('cuet_question_bank').insert({
            question: q.question,
            options: q.options,
            correct_index: q.correct_index,
            subject: q.subject,
            topic: q.topic,
            difficulty: q.difficulty,
            source: source,
            embedding: embedding,
            qid: `vision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });

        if (error) console.error('Supabase insert error:', error.message);
        else console.log('Successfully ingested 1 question.');
    } catch (e: any) {
        console.error('Ingest failed', e.message);
    }
}

async function processPdf(filePath: string) {
    const fileName = path.basename(filePath);
    console.log(`Processing ${fileName} with Vision...`);

    const pageCount = await getPdfPageCount(filePath);
    console.log(`PDF has ${pageCount} pages.`);

    for (let i = 1; i <= pageCount; i++) {
        console.log(`Capturing page ${i}...`);
        // Use a unique folder for each page to avoid conflicts and handle the EISDIR issue
        const tempOutputDir = path.join(TEMP_IMG_DIR, `temp_p${i}_${Date.now()}`);
        if (!fs.existsSync(tempOutputDir)) fs.mkdirSync(tempOutputDir, { recursive: true });

        try {
            execSync(`npx pdf-parse screenshot "${filePath}" --pages ${i} --output "${tempOutputDir}"`);

            // pdf-parse screenshot creates a directory if multiple pages are involved or if output path is misinterpreted.
            // In our case, it seems to create a directory and put page_X_screenshot.png inside it.
            const files = fs.readdirSync(tempOutputDir);
            const imgFile = files.find(f => f.endsWith('.png'));

            if (imgFile) {
                const imgPath = path.join(tempOutputDir, imgFile);
                await extractQuestionsFromImage(imgPath, fileName);
            } else {
                console.warn(`No screenshot found in ${tempOutputDir}`);
            }

            // Cleanup temp dir
            fs.rmSync(tempOutputDir, { recursive: true, force: true });
        } catch (e: any) {
            console.error(`Failed to process page ${i}`, e.message);
            if (fs.existsSync(tempOutputDir)) fs.rmSync(tempOutputDir, { recursive: true, force: true });
        }
    }
}

async function main() {
    const files = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'));
    for (const f of files) {
        await processPdf(path.join(PDF_DIR, f));
    }
}

main();
