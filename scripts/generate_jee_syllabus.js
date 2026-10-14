import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the API key is passed or available
const MODEL_API_KEY = process.env.MODEL_API_KEY;

if (!MODEL_API_KEY) {
    console.error("Please export MODEL_API_KEY before running this script.");
    process.exit(1);
}

const prompt = `
You are an expert curriculum designer. Please generate a highly detailed JSON array representing the JEE Mains syllabus (Physics, Chemistry, Mathematics) formatted EXACTLY for insertion into our database. 

Only valid JSON array. No markdown blocks.

Format:
[
  {
    "subject": "Physics",
    "topic": "Kinematics",
    "subtopic": "Motion in a straight line, uniform and non-uniform motion",
    "difficulty_tier": 2, // 1 to 5
    "exam_types": ["JEE Mains", "JEE Advanced", "CBSE"],
    "bloom_level": "understand" // ('remember'|'understand'|'apply'|'analyze'|'evaluate'|'create')
  },
  // Generate at least 15 core topics for each of Physics, Chemistry, and Math.
  // Ensure "subject" is Capitalized.
]
`;

async function run() {
    console.log("Calling Meta API to generate JEE Syllabus...");
    const url = 'https://api.meta.ai/v1/chat/completions';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MODEL_API_KEY}`
            },
            body: JSON.stringify({
                model: 'muse-spark-1.3-contributor',
                messages: [{ role: 'user', content: prompt }],
                reasoning_effort: 'low',
                max_completion_tokens: 16384,
                response_format: { type: 'json_schema', json_schema: {
                    name: 'syllabus', schema: { type: 'array', items: { type: 'object' } }
                } }
            })
        });

        if (!response.ok) {
            throw new Error(`Meta API error ${response.status}`);
        }

        const data = await response.json();
        if (data.choices?.[0]?.finish_reason === 'length') throw new Error('Meta output limit reached');
        let rawText = data.choices?.[0]?.message?.content;
        
        if (!rawText) throw new Error("Empty response from Meta");

        // Clean up markdown if explicitly returned despite the requested JSON schema
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        const jsonArray = JSON.parse(rawText);
        console.log(`Generated ${jsonArray.length} knowledge components!`);

        const outPath = path.join(__dirname, 'jee_syllabus_seed.json');
        fs.writeFileSync(outPath, JSON.stringify(jsonArray, null, 2));
        console.log(`Saved to ${outPath}`);

    } catch (e) {
        console.error("Scraping failed:", e);
    }
}

run();
