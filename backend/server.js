// server.js
import express from 'express';
import { randomUUID } from 'crypto'; // For generating session IDs
import { getPersonalizedQuestionSet } from './generate-questions.js';
import { registerRoutes } from './evaluate_answers.js'; // We'll use the routes you already defined

// --- Basic Server Setup ---
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares to parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API Endpoints ---

/**
 * NEW ENDPOINT: /api/startTest
 * This endpoint kicks off the entire flow.
 * It generates the questions and creates a session ID.
 */
app.post('/api/startTest', async (req, res) => {
    try {
        const { userId, subject, chapter } = req.body;

        if (!userId || !subject || !chapter) {
            return res.status(400).json({ status: 'error', message: 'Missing userId, subject, or chapter' });
        }

        // 1. Generate the personalized set of questions
        const questionSet = await getPersonalizedQuestionSet(userId, subject, chapter);

        // 2. Generate a new, unique session ID
        const sessionId = randomUUID();

        // 3. Send the questions and session ID to the client
        res.json({
            status: 'ok',
            sessionId: sessionId,
            questions: questionSet
        });

    } catch (err) {
        console.error('/api/startTest error', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/**
 * REGISTER EXISTING ROUTES:
 * This function, which you provided in evaluate_answers.js,
 * automatically creates:
 * - POST /api/submitAnswer
 * - POST /api/finalizeSession
 */
registerRoutes(app);

// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});