import { MongoClient } from 'mongodb';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Hardcoded MongoDB URI (make sure to include your password!)
const uri = "mongodb+srv://<username>:pswd@cluster0.fj57vdo.mongodb.net/studybud?appName=Cluster0";
const client = new MongoClient(uri);

async function connectDB() {
    try {
        await client.connect();
        console.log("✅ Connected successfully to MongoDB");
        return client.db('ncert_rag');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        throw new Error('Failed to connect to the database.');
    }
}

async function getUserData(auth_user_id) {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ auth_user_id });
    if (!user) {
        throw new Error('User not found.');
    }
    return user;
}

// ✅ Fixed Gemini API call
async function callRAGModel(prompt) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY in environment");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }]
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("Gemini API error:", data);
        throw new Error(`Failed to call Gemini API: ${data.error?.message || response.statusText}`);
    }

    // ✅ Extract model output correctly
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
    return { text: generatedText };
}

async function generateTimetable(auth_user_id, requestBody) {
    const userData = await getUserData(auth_user_id);
    const { class: userClass, subjects, performance_summary } = userData;

    const prompt = `
    Generate a personalized study timetable for a student in class ${userClass} studying the following subjects: ${subjects.join(', ')}.
    The student's overall accuracy is ${performance_summary.overall_accuracy} and their consistency score is ${performance_summary.consistency_score}.
    Consider their strengths and weaknesses in each subject when creating the timetable.
    Format the response as JSON with this structure:
    {
        "days_until_exam": number,
        "daily_schedule": [{
            "day": number,
            "date": "YYYY-MM-DD",
            "topics": [{
                "subject": string,
                "topic": string,
                "duration_minutes": number,
                "difficulty": string
            }]
        }]
    }
    `;

    const response = await callRAGModel(prompt);
    return response;
}

app.post('/generate-timetable', async (req, res) => {
    try {
        const auth_user_id = req.headers.authorization?.split(' ')[1];
        if (!auth_user_id) {
            return res.status(401).json({ error: 'Authorization required' });
        }

        const timetable = await generateTimetable(auth_user_id, req.body);
        res.json(timetable);
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(400).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
