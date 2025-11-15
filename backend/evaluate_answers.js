// evaluate_answers.js
import { ObjectId } from 'mongodb';
import fetch from 'node-fetch';
import assert from 'assert';
import { getDb, USER_COLLECTION, QUESTION_COLLECTION, GEMINI_API_URL } from './generate-questions.js';

// Temporary collection for session answers
const SESSION_COLLECTION = 'answer_sessions';

/**
 * Evaluate a single student answer for one question using Gemini + deterministic keyword logic.
 *
 * @param {string} userId - MongoDB ObjectId string
 * @param {Object} questionObj - a question object from generate-questions output (must have _id, question_text, metadata)
 * @param {Object} studentAnswerObj - { answer: string, steps?: string, timeTakenSeconds?: number, selectedOptionIndex?: number }
 * @param {string} sessionId - a client-generated session id (string). Use same sessionId across the student run.
 * @returns {Promise<Object>} - per-question evaluation record
 */
export async function evaluateSingleAnswer(userId, questionObj, studentAnswerObj, sessionId) {
    const db = await getDb();
    const usersCol = db.collection(USER_COLLECTION);
    const sessionsCol = db.collection(SESSION_COLLECTION);

    // Verify user exists
    const user = await usersCol.findOne({ _id: new ObjectId(userId) });
    if (!user) throw new Error(`User not found: ${userId}`);

    // Normalize question info
    const questionId = questionObj._id ? String(questionObj._id) : (`temp_${Math.random().toString(36).slice(2,9)}`);
    const questionText = String(questionObj.question_text || questionObj.question || '');
    const qType = questionObj.question_type || 'Short Answer';
    const maxMarks = Number(questionObj.metadata?.maxMarks ?? (qType === 'MCQ' ? 1 : 4));

    // Build Gemini prompt for single question
    const geminiPrompt = `
You are an expert CBSE/NCERT grader for Class 12. RETURN ONLY valid JSON (no commentary).
Evaluate this single student response per NCERT canonical answer and CBSE marking rules.
Return a JSON object exactly with:
{
  "question_id": "<id>",
  "maxMarks": <number>,
  "gemini_awardedMarks": <number>,
  "semanticMatch": <true|false>,
  "canonicalImportantKeywords": ["k1","k2",...],  // 2-6 items
  "matched_keywords": ["..."],
  "missing_keywords": ["..."],
  "canonicalAnswer": "short canonical answer/steps",
  "feedback": "short actionable feedback"
}

INPUT:
Student: ${user.display_name}, class ${user.class}, board ${user.board}
Question (type: ${qType}, maxMarks: ${maxMarks}):
${questionText}

StudentAnswer:
${JSON.stringify(studentAnswerObj, null, 2)}

NOTES:
- semanticMatch true when student's answer meaning matches NCERT canonical meaning (synonyms allowed).
- For MCQ: semanticMatch true if student's selected option text equals canonical answer.
- gemini_awardedMarks should reflect partial credit (decimal allowed).
- canonicalImportantKeywords should contain essential terms/phrases (2-6).
Keep canonicalAnswer concise (one-two lines).
`;

    // Call Gemini
    let geminiText;
    try {
        const payload = {
            contents: [{ role: "user", parts: [{ text: geminiPrompt }] }],
            generationConfig: { temperature: 0.0, topP: 0.0, maxOutputTokens: 1024 },
            safetySettings: []
        };

        const res = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errTxt = await res.text();
            throw new Error(`Gemini error ${res.status}: ${errTxt}`);
        }

        const data = await res.json();
        geminiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!geminiText) throw new Error('Gemini returned no text.');
    } catch (err) {
        console.error('Gemini call failed:', err);
        // Fallback minimal record (so frontend gets a response)
        const fallback = {
            question_id: questionId,
            maxMarks,
            gemini_awardedMarks: 0,
            semanticMatch: false,
            canonicalImportantKeywords: [],
            matched_keywords: [],
            missing_keywords: [],
            canonicalAnswer: '',
            feedback: 'Grader unavailable; please retry.'
        };
        await sessionsCol.updateOne(
            { sessionId, userId, question_id: questionId },
            { $set: { ...fallback, studentAnswerObj, createdAt: Date.now() } },
            { upsert: true }
        );
        return fallback;
    }

    // Parse Gemini response
    let geminiObj;
    try {
        const cleaned = geminiText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        geminiObj = JSON.parse(cleaned);
        assert(geminiObj.question_id);
    } catch (err) {
        console.error('Failed to parse Gemini JSON:', err);
        const fallback = {
            question_id: questionId,
            maxMarks,
            gemini_awardedMarks: 0,
            semanticMatch: false,
            canonicalImportantKeywords: [],
            matched_keywords: [],
            missing_keywords: [],
            canonicalAnswer: '',
            feedback: 'Invalid grader output; please retry.'
        };
        await sessionsCol.updateOne(
            { sessionId, userId, question_id: questionId },
            { $set: { ...fallback, rawGemini: geminiText, studentAnswerObj, createdAt: Date.now() } },
            { upsert: true }
        );
        return fallback;
    }

    // Normalize geminiObj fields
    geminiObj.maxMarks = Number(geminiObj.maxMarks ?? maxMarks);
    geminiObj.gemini_awardedMarks = Number(geminiObj.gemini_awardedMarks ?? 0);
    geminiObj.canonicalImportantKeywords = Array.isArray(geminiObj.canonicalImportantKeywords) ? geminiObj.canonicalImportantKeywords : [];
    geminiObj.matched_keywords = Array.isArray(geminiObj.matched_keywords) ? geminiObj.matched_keywords : [];
    geminiObj.missing_keywords = Array.isArray(geminiObj.missing_keywords) ? geminiObj.missing_keywords : [];
    geminiObj.semanticMatch = !!geminiObj.semanticMatch;

    // Deterministic scoring: semantic override + keyword deduction
    let awardedMarks;
    if (geminiObj.semanticMatch === true) {
        awardedMarks = geminiObj.maxMarks;
    } else {
        const base = geminiObj.gemini_awardedMarks;
        const canonicalCount = Math.max(1, geminiObj.canonicalImportantKeywords.length);
        const missingCount = geminiObj.missing_keywords.length;
        const deduction = base * (missingCount / canonicalCount);
        awardedMarks = Math.max(0, Math.min(geminiObj.maxMarks, base - deduction));
        awardedMarks = Math.round(awardedMarks * 100) / 100;
    }

    const perQuestionRecord = {
        sessionId,
        userId,
        question_id: questionId,
        question_text: questionText,
        question_type: qType,
        maxMarks: geminiObj.maxMarks,
        gemini_awardedMarks: geminiObj.gemini_awardedMarks,
        semanticMatch: geminiObj.semanticMatch,
        canonicalImportantKeywords: geminiObj.canonicalImportantKeywords,
        matched_keywords: geminiObj.matched_keywords,
        missing_keywords: geminiObj.missing_keywords,
        canonicalAnswer: geminiObj.canonicalAnswer,
        awardedMarks,
        feedback: geminiObj.feedback,
        studentAnswer: studentAnswerObj,
        createdAt: Date.now()
    };

    // Save per-question result (upsert)
    await sessionsCol.updateOne(
        { sessionId, userId, question_id: questionId },
        { $set: perQuestionRecord },
        { upsert: true }
    );

    return perQuestionRecord;
}

/**
 * Finalize a session: aggregate saved per-question records, compute aggregates by subject/chapter,
 * update user's performance_summary in MongoDB, and return final report.
 *
 * @param {string} userId
 * @param {string} sessionId
 * @param {Object} options - { keepSession: boolean } (default true)
 * @returns {Promise<Object>} - final report and updated performance_summary
 */
export async function finalizeSession(userId, sessionId, options = { keepSession: true }) {
    const db = await getDb();
    const usersCol = db.collection(USER_COLLECTION);
    const sessionsCol = db.collection(SESSION_COLLECTION);
    const questionsCol = db.collection(QUESTION_COLLECTION);

    const user = await usersCol.findOne({ _id: new ObjectId(userId) });
    if (!user) throw new Error(`User not found: ${userId}`);

    // Fetch per-question records
    const records = await sessionsCol.find({ sessionId, userId }).toArray();
    if (!records || records.length === 0) {
        throw new Error('No answers found for this session.');
    }

    // Totals + map question -> subject/chapter (best-effort)
    let totalAwarded = 0;
    let totalMax = 0;
    const perQuestion = [];

    for (const rec of records) {
        const awarded = Number(rec.awardedMarks ?? 0);
        const maxM = Number(rec.maxMarks ?? 0);
        totalAwarded += awarded;
        totalMax += maxM;

        let subject = rec.question_subject || null;
        let chapter = rec.question_chapter || null;
        if (!subject || !chapter) {
            try {
                const qDoc = await questionsCol.findOne({ question_text: rec.question_text });
                if (qDoc) {
                    subject = subject || qDoc.subject;
                    chapter = chapter || qDoc.chapter;
                }
            } catch (e) {
                // ignore
            }
        }
        perQuestion.push({ ...rec, subject, chapter });
    }

    // Aggregate by subject -> chapter
    const aggregates = {};
    for (const pq of perQuestion) {
        const subj = pq.subject || 'Unknown';
        const chap = pq.chapter || 'Unknown';
        aggregates[subj] = aggregates[subj] || {};
        aggregates[subj][chap] = aggregates[subj][chap] || { totalAttempted: 0, totalCorrectMarks: 0, totalMaxMarks: 0 };
        aggregates[subj][chap].totalAttempted += 1;
        aggregates[subj][chap].totalCorrectMarks += Number(pq.awardedMarks ?? 0);
        aggregates[subj][chap].totalMaxMarks += Number(pq.maxMarks ?? 0);
    }

    // compute accuracy per chapter
    for (const s of Object.keys(aggregates)) {
        for (const c of Object.keys(aggregates[s])) {
            const a = aggregates[s][c];
            a.accuracy = a.totalMaxMarks > 0 ? (a.totalCorrectMarks / a.totalMaxMarks) : 0;
        }
    }

    // Prepare performance_update_suggestions
    const performance_update_suggestions = {};
    for (const s of Object.keys(aggregates)) {
        performance_update_suggestions[s] = {};
        for (const c of Object.keys(aggregates[s])) {
            performance_update_suggestions[s][c] = {
                totalAttempted: aggregates[s][c].totalAttempted,
                totalCorrectMarks: aggregates[s][c].totalCorrectMarks,
                totalMaxMarks: aggregates[s][c].totalMaxMarks,
                new_accuracy: aggregates[s][c].accuracy
            };
        }
    }

    // Update user.performance_summary (merging logic)
    const perf = user.performance_summary || {};
    if (!perf.by_subject) perf.by_subject = {};

    function accuracyToStrength(acc) {
        if (acc < 0.6) return 'weak';
        if (acc > 0.8) return 'strong';
        return 'moderate';
    }

    for (const subjectName of Object.keys(performance_update_suggestions)) {
        if (!perf.by_subject[subjectName]) {
            perf.by_subject[subjectName] = { average_score: { "$numberDouble": "0.0" }, total_attempts: 0, strength_level: 'moderate', by_chapter: {} };
        }
        const chaptersObj = performance_update_suggestions[subjectName];
        for (const chapterName of Object.keys(chaptersObj)) {
            const chapterSuggestion = chaptersObj[chapterName];
            const newAcc = Number(chapterSuggestion.new_accuracy);
            const existingChapter = perf.by_subject[subjectName].by_chapter?.[chapterName];
            let existingAttempts = 0, existingAcc = 0;
            if (existingChapter) {
                existingAttempts = Number(existingChapter.total_attempts?.['$numberInt'] ?? existingChapter.total_attempts ?? 0);
                existingAcc = Number(existingChapter.accuracy?.['$numberDouble'] ?? existingChapter.accuracy ?? 0);
            }
            const attemptsFromEval = Number(chapterSuggestion.totalAttempted ?? 0);
            const totalAttempts = existingAttempts + attemptsFromEval;
            const combinedAcc = totalAttempts > 0 ? ((existingAcc * existingAttempts) + (newAcc * attemptsFromEval)) / totalAttempts : newAcc;

            perf.by_subject[subjectName].by_chapter = perf.by_subject[subjectName].by_chapter || {};
            perf.by_subject[subjectName].by_chapter[chapterName] = {
                average_score: { "$numberDouble": String(combinedAcc) },
                total_attempts: { "$numberInt": String(totalAttempts) },
                accuracy: { "$numberDouble": String(combinedAcc) },
                strength_level: accuracyToStrength(combinedAcc),
                last_tested: { "$date": { "$numberLong": String(Date.now()) } }
            };
        }

        // Recompute subject-level aggregated accuracy
        const chapterEntries = Object.values(perf.by_subject[subjectName].by_chapter || {});
        const chapterAccSum = chapterEntries.reduce((s, c) => s + Number(c.accuracy?.['$numberDouble'] ?? c.accuracy ?? 0), 0);
        const subjectAcc = chapterEntries.length > 0 ? (chapterAccSum / chapterEntries.length) : (Number(perf.by_subject[subjectName].average_score?.['$numberDouble'] ?? perf.by_subject[subjectName].average_score ?? 0));
        perf.by_subject[subjectName].average_score = { "$numberDouble": String(subjectAcc) };
        perf.by_subject[subjectName].strength_level = accuracyToStrength(subjectAcc);
    }

    // Recompute overall_accuracy
    const subjectAccs = Object.values(perf.by_subject).map(s => Number(s.average_score?.['$numberDouble'] ?? 0));
    const overallAcc = subjectAccs.length > 0 ? (subjectAccs.reduce((a, b) => a + b, 0) / subjectAccs.length) : Number(perf.overall_accuracy?.['$numberDouble'] ?? perf.overall_accuracy ?? 0);
    perf.overall_accuracy = { "$numberDouble": String(overallAcc) };
    perf.consistency_score = perf.consistency_score || { "$numberDouble": "0.0" };

    // Update user in DB
    await usersCol.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { performance_summary: perf, 'metadata.updated_at': { $date: { $numberLong: String(Date.now()) } } } }
    );

    // Optionally delete session records
    if (!options.keepSession) {
        await sessionsCol.deleteMany({ sessionId, userId });
    }

    // Final score summary
    const finalScore = {
        totalAwarded,
        totalMax,
        percent: totalMax > 0 ? Math.round((totalAwarded / totalMax) * 10000) / 100 : 0
    };

    return {
        finalScore,
        per_question: perQuestion,
        by_subject_chapter_aggregates: aggregates,
        performance_update_suggestions,
        updated_performance_summary: perf
    };
}

/**
 * Optional Express route helpers: paste into your server to expose endpoints.
 */
export function registerRoutes(app) {
    app.post('/api/submitAnswer', async (req, res) => {
        try {
            const { userId, sessionId, questionObj, studentAnswerObj } = req.body;
            const result = await evaluateSingleAnswer(userId, questionObj, studentAnswerObj, sessionId);
            res.json({ status: 'ok', evaluation: result });
        } catch (err) {
            console.error('/api/submitAnswer error', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });

    app.post('/api/finalizeSession', async (req, res) => {
        try {
            const { userId, sessionId, keepSession } = req.body;
            const report = await finalizeSession(userId, sessionId, { keepSession: keepSession ?? true });
            res.json({ status: 'ok', report });
        } catch (err) {
            console.error('/api/finalizeSession error', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    });
}
