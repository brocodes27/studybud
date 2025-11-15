// generate-questions.js
// Import necessary libraries
// Make sure to install these: npm install mongodb node-fetch dotenv
import { MongoClient, ObjectId } from 'mongodb';
import fetch from 'node-fetch'; // For making API calls to Gemini
import 'dotenv/config'; // For managing API keys securely

// --- 1. Configuration ---

// MongoDB Configuration
// Store your actual connection string in a .env file
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'ncert_rag'; // Change this to your DB name
const USER_COLLECTION = 'users';
const QUESTION_COLLECTION = 'Questions';

// Gemini API Configuration
// Store your actual API key in a .env file
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY;

// Constants for question generation
const TOTAL_QUESTIONS_TO_GENERATE = 20;
const EXISTING_QUESTIONS_TO_FETCH = 6; // You wanted 5-7
const NEW_QUESTIONS_TO_GENERATE = TOTAL_QUESTIONS_TO_GENERATE - EXISTING_QUESTIONS_TO_FETCH;

// --- 2. Database Connection ---

let dbClient;

/**
 * Connects to MongoDB and returns the database instance.
 * Manages a singleton connection.
 */
async function getDb() {
    if (!dbClient) {
        try {
            const client = new MongoClient(MONGO_URI);
            await client.connect();
            console.log('Successfully connected to MongoDB.');
            dbClient = client.db(DB_NAME);
        } catch (error) {
            console.error('Failed to connect to MongoDB:', error);
            throw error;
        }
    }
    return dbClient;
}

// --- 3. Core Logic ---

/**
 * Main function to generate a personalized question set for a user.
 * @param {string} userId - The $oid of the user (e.g., "69097f71b3df82ac2d37c38b")
 * @param {string} subject - The subject (e.g., "Physics")
 * @param {string} chapter - The chapter (e.g., "Electrostatics")
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of 20 questions.
 */
export async function getPersonalizedQuestionSet(userId, subject, chapter) {
    let db;
    try {
        db = await getDb();

        // Step 1: Fetch user data
        const user = await db.collection(USER_COLLECTION).findOne({
            _id: new ObjectId(userId)
        });

        if (!user) {
            throw new Error(`User not found with ID: ${userId}`);
        }

        // Step 2: Determine user's strength level
        const { strength, difficulty } = determineUserStrength(user, subject, chapter);
        console.log(`User: ${user.display_name}, Subject: ${subject}, Chapter: ${chapter}`);
        console.log(`Determined user strength: ${strength} (Targeting ${difficulty} questions)`);

        // Step 3: Fetch existing questions from MongoDB
        const existingQuestions = await fetchExistingQuestions(db, subject, chapter, difficulty);
        console.log(`Fetched ${existingQuestions.length} existing questions from DB.`);

        // Step 4: Generate new questions using Gemini (RAG)
        const newQuestions = await generateNewQuestions(user, subject, chapter, strength, existingQuestions);
        console.log(`Generated ${newQuestions.length} new questions from Gemini.`);

        // Step 5: Combine and return
        const finalQuestionSet = [...existingQuestions, ...newQuestions];

        // Ensure we always return the exact total number, even if Gemini returns more/less
        return finalQuestionSet.slice(0, TOTAL_QUESTIONS_TO_GENERATE); 

    } catch (error) {
        console.error('Error in getPersonalizedQuestionSet:', error);
        throw error;
    }
    // Note: In a real app, you might not want to close the client after every call.
    // For this script, we assume it runs and finishes.
}

/**
 * Analyzes user data to find the most specific strength level available.
 * @param {Object} user - The user document from MongoDB.
 * @param {string} subject - The subject requested.
 * @param {string} chapter - The chapter requested.
 * @returns {Object} - An object { strength: string, difficulty: string }
 */
function determineUserStrength(user, subject, chapter) {
    const performance = user.performance_summary;
    let strength = 'moderate'; // Default
    let difficulty = 'Medium'; // Default

    try {
        // 1. Try Chapter-level strength
        if (performance.by_subject[subject]?.by_chapter[chapter]) {
            strength = performance.by_subject[subject].by_chapter[chapter].strength_level;
        }
        // 2. Fallback to Subject-level strength
        else if (performance.by_subject[subject]) {
            strength = performance.by_subject[subject].strength_level;
        }
        // 3. Fallback to Overall strength
        else if (performance.overall_accuracy) {
            // Convert accuracy to a strength level
            const acc = performance.overall_accuracy['$numberDouble'];
            if (acc < 0.6) strength = 'weak';
            else if (acc > 0.8) strength = 'strong';
            else strength = 'moderate';
        }
    } catch (e) {
        console.warn('Could not determine specific strength, defaulting to moderate.', e.message);
        strength = 'moderate';
    }

    // Map strength to a difficulty target for fetching questions
    // If weak, target Easy. If strong, target Hard. If moderate, target Medium.
    switch (strength) {
        case 'weak':
            difficulty = 'Easy';
            break;
        case 'strong':
            difficulty = 'Hard';
            break;
        case 'moderate':
        default:
            difficulty = 'Medium';
            break;
    }

    return { strength, difficulty };
}

/**
 * Fetches existing questions from the database based on criteria.
 * @param {Object} db - The MongoDB database instance.
 * @param {string} subject - The subject.
 * @param {string} chapter - The chapter.
 * @param {string} difficulty - The target difficulty ('Easy', 'Medium', 'Hard').
 * @returns {Promise<Array<Object>>} - An array of questions.
 */
async function fetchExistingQuestions(db, subject, chapter, difficulty) {
    const query = {
        subject: subject,
        chapter: chapter,
        board: 'CBSE',
        'metadata.difficulty': difficulty
    };

    try {
        // Use $sample for random selection, fallback to find().limit()
        const questions = await db.collection(QUESTION_COLLECTION).aggregate([
            { $match: query },
            { $sample: { size: EXISTING_QUESTIONS_TO_FETCH } }
        ]).toArray();

        // If $sample returns fewer than needed (or 0), try fetching any difficulty
        if (questions.length < EXISTING_QUESTIONS_TO_FETCH) {
            console.log(`Only found ${questions.length} ${difficulty} questions. Fetching other difficulties...`);
            const fallbackQuery = { subject: subject, chapter: chapter, board: 'CBSE' };
            const fallbackQuestions = await db.collection(QUESTION_COLLECTION).aggregate([
                { $match: fallbackQuery },
                { $sample: { size: EXISTING_QUESTIONS_TO_FETCH } }
            ]).toArray();
            return fallbackQuestions;
        }

        return questions;
    } catch (error) {
        console.error('Error fetching existing questions:', error);
        return []; // Return empty array on error
    }
}

/**
 * Calls the Gemini API to generate new questions.
 * @param {Object} user - The user document.
 * @param {string} subject - The subject.
 * @param {string} chapter - The chapter.
 * @param {string} strength - The user's determined strength ('weak', 'moderate', 'strong').
 * @param {Array<Object>} existingQuestions - Questions already fetched (to avoid duplicates).
 * @returns {Promise<Array<Object>>} - An array of newly generated question objects.
 */
async function generateNewQuestions(user, subject, chapter, strength, existingQuestions) {
    // RAG: Create a list of existing questions to provide as context
    const contextQuestions = existingQuestions.map(q => `- ${q.question_text}`).join('\n');

    // Create a dynamic prompt based on user data
    const systemPrompt = `
You are an expert question generator for Indian CBSE Class 12 students.
Your task is to generate ${NEW_QUESTIONS_TO_GENERATE} high-quality questions.

RULES:
1.  **Subject:** ${subject}
2.  **Chapter:** ${chapter}
3.  **Board:** CBSE
4.  **Source:** Strictly base all questions on the official NCERT textbook for this subject.
5.  **User Profile:** The student is "${user.display_name}". Their performance level in this area is **${strength}**.
    * If "weak", generate 'Easy' questions (conceptual, direct formulas).
    * If "moderate", generate 'Medium' questions (application-based, multi-step).
    * If "strong", generate 'Hard' questions (complex, analytical, multi-concept).
6.  **Avoid Duplicates:** Do NOT generate questions similar to these already selected:
    ${contextQuestions.length > 0 ? contextQuestions : "N/A"}
7.  **Output Format:** Respond with ONLY a valid JSON array of objects. Do not include \`\`\`json or any other text.
    Each object must follow this exact structure:
    {
      "question_text": "The text of the question...",
      "question_type": "MCQ" | "Numerical" | "Short Answer",
      "metadata": {
        "difficulty": "Easy" | "Medium" | "Hard",
        "concept_tags": ["Tag1", "Tag2"]
      },
      "options": [ // Only for MCQ type
        {"text": "Option A", "isCorrect": true},
        {"text": "Option B", "isCorrect": false},
        {"text": "Option C", "isCorrect": false},
        {"text": "Option D", "isCorrect": false}
      ],
      "answer_explanation": "A brief explanation of the correct answer."
    }
`;

    const payload = {
        contents: [
            {
                role: "user",
                parts: [{ text: systemPrompt }]
            }
        ],
        generationConfig: {
            // "responseMimeType": "application/json", // Uncomment if your Gemini version supports this
            temperature: 0.8,
            topP: 0.9,
            maxOutputTokens: 8192,
        },
        safetySettings: [
            // Standard safety settings
            { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
            { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
            { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" },
            { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE" }
        ]
    };

    try {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Gemini API Error: ${response.statusText} - ${errorBody}`);
        }

        const data = await response.json();
        
        // Extract the JSON text from the response
        const jsonText = data.candidates[0].content.parts[0].text;

        // Clean the response (in case it includes markdown ````json ... ````)
        const cleanedJsonText = jsonText
            .replace(/^```json\n/, '')
            .replace(/\n```$/, '');

        // Parse the JSON string into an array of objects
        const generatedQuestions = JSON.parse(cleanedJsonText);
        
        // Add a flag to distinguish generated questions
        return generatedQuestions.map(q => ({
            ...q,
            _id: new ObjectId(), // Give it a temporary new ID
            generated: true, // Flag as AI-generated
            subject: subject, // Add missing top-level fields
            chapter: chapter,
            board: 'CBSE',
            class: 12
        }));

    } catch (error) {
        console.error('Error generating new questions from Gemini:', error);
        return []; // Return empty array on error
    }
}

// --- 4. Example Usage ---

/**
 * IIFE (Immediately Invoked Function Expression) to run the example.
 * To use this, run `node generatePersonalizedQuestions.js` from your terminal.
 */
/*(async () => {
    try {
        // --- Test Case 1: Physics (Electrostatics) ---
        // This user is 'weak' in Electrostatics.
        console.log('--- Running Test Case 1: Physics / Electrostatics ---');
        const userId1 = '69097f71b3df82ac2d37c38b';
        const subject1 = 'Physics';
        const chapter1 = 'Electrostatics';
        
        const questions1 = await getPersonalizedQuestionSet(userId1, subject1, chapter1);
        console.log(`\nSuccessfully generated ${questions1.length} questions for ${subject1} - ${chapter1}:`);
        // console.log(JSON.stringify(questions1, null, 2)); // Uncomment to see full output
        console.log('Sample Question 1 (Existing):', questions1[0]?.question_text);
        console.log('Sample Question 8 (Generated):', questions1[8]?.question_text);


        // --- Test Case 2: Mathematics (3D Geometry) ---
        // This user has no chapter data for Math, so it will fall back to 'moderate' subject strength.
        console.log('\n--- Running Test Case 2: Mathematics / 3D Geometry ---');
        const userId2 = '69097f71b3df82ac2d37c38b';
        const subject2 = 'Mathematics';
        const chapter2 = '3D Geometry'; // Chapter user hasn't been tested on

        const questions2 = await getPersonalizedQuestionSet(userId2, subject2, chapter2);
        console.log(`\nSuccessfully generated ${questions2.length} questions for ${subject2} - ${chapter2}:`);
        // console.log(JSON.stringify(questions2, null, 2)); // Uncomment to see full output
        console.log('Sample Question 1 (Existing):', questions2[0]?.question_text);
        console.log('Sample Question 8 (Generated):', questions2[8]?.question_text);


    } catch (error) {
        console.error('An error occurred during the test run:', error);
    } finally {
        // Close the MongoDB connection
        if (dbClient) {
            // await dbClient.close(); // Need to access client, not db
            // In a real server, you'd keep this open. For a script, we'd close it.
            // For simplicity in this example, we leave it to the script to exit.
            console.log('\nScript finished. (MongoDB connection would be closed in a real app)');
        }
        process.exit(0);
    }
})();*/

// --- Exports for other modules (do NOT change other code above) ---
export { getDb, USER_COLLECTION, QUESTION_COLLECTION, GEMINI_API_URL };
