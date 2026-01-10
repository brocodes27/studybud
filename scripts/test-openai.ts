import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY });

async function test() {
    try {
        const resp = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: "test"
        });
        console.log('Success:', resp.data[0].embedding.length);
    } catch (e: any) {
        console.error('Error:', e.message);
        console.error('Key hint:', process.env.VITE_OPENAI_API_KEY?.slice(0, 7));
    }
}
test();
