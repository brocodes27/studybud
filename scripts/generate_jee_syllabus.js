import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the API key is passed or available
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("Please export VITE_GEMINI_API_KEY before running this script.");
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
    console.log("Calling Gemini API to generate JEE Syllabus...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.2, // low temp for structured output
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${await response.text()}`);
        }

        const data = await response.json();
        let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!rawText) throw new Error("Empty response from Gemini");

        // Clean up markdown if explicitly returned despite responseMimeType
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
