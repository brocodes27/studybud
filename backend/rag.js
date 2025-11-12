// --- [0] MOCK DATABASES ---
// In a real app, this data would come from MongoDB or another database.

// A sample of the 70k questions database
const allQuestions = [
    {"_id": "690a1b000000000000000011", "subject": "Physics", "chapter": "Current Electricity", "question_text": "Plot a graph showing the variation of voltage with current drawn from the cell. ...", "metadata": {"difficulty": "Easy", "concept_tags": ["EMF", "Internal Resistance"]}},
    {"_id": "690a1b000000000000000012", "subject": "Physics", "chapter": "Electrostatics", "question_text": "Define electric flux. Write its S.I. unit.", "metadata": {"difficulty": "Easy", "concept_tags": ["Electric Flux"]}},
    {"_id": "690a1b000000000000000013", "subject": "Physics", "chapter": "Electrostatics", "question_text": "State Gauss's law in electrostatics.", "metadata": {"difficulty": "Easy", "concept_tags": ["Gauss's Law"]}},
    {"_id": "690a1b000000000000000014", "subject": "Physics", "chapter": "Electrostatics", "question_text": "Why do the electrostatic field lines not form closed loops?", "metadata": {"difficulty": "Easy", "concept_tags": ["Electric Field Lines"]}},
    {"_id": "690a1b000000000000000015", "subject": "Physics", "chapter": "Electrostatics", "question_text": "What is an equipotential surface? Draw equipotential surfaces for a uniform electric field.", "metadata": {"difficulty": "Medium", "concept_tags": ["Equipotential Surface"]}},
    {"_id": "690a1b000000000000000016", "subject": "Physics", "chapter": "Electrostatics", "question_text": "Derive an expression for the electric field at a point on the axial line of an electric dipole.", "metadata": {"difficulty": "Medium", "concept_tags": ["Electric Dipole", "Derivation"]}},
    {"_id": "690a1b000000000000000017", "subject": "Physics", "chapter": "Electrostatics", "question_text": "Two point charges ‘q1’ and ‘q2’ are placed at a distance ‘d’ apart. ...", "metadata": {"difficulty": "Medium", "concept_tags": ["Electric Field", "Point Charge"]}},
    {"_id": "690a1b000000000000000018", "subject": "Physics", "chapter": "Electrostatics", "question_text": "A 4µF capacitor is charged to 200V. It is then disconnected from the supply and connected to another uncharged 2µF capacitor. ...", "metadata": {"difficulty": "Medium", "concept_tags": ["Capacitance", "Energy Stored"]}},
    {"_id": "690a1b000000000000000019", "subject": "Physics", "chapter": "Electrostatics", "question_text": "Define capacitance. Derive the expression for the capacitance of a parallel plate capacitor.", "metadata": {"difficulty": "Medium", "concept_tags": ["Capacitance", "Derivation"]}},
    {"_id": "690a1b000000000000000020", "subject": "Physics", "chapter": "Electrostatics", "question_text": "State Coulomb's law and express it in vector form.", "metadata": {"difficulty": "Easy", "concept_tags": ["Coulomb's Law"]}},
    {"_id": "690a1b000000000000000021", "subject": "Physics", "chapter": "Electrostatics", "question_text": "Derive an expression for the torque experienced by an electric dipole kept in a uniform electric field.", "metadata": {"difficulty": "Hard", "concept_tags": ["Electric Dipole", "Torque"]}},
    {"_id": "690a1b000000000000000022", "subject": "Physics", "chapter": "Electrostatics", "question_text": "Find the electric field at a point on the equatorial line of an electric dipole.", "metadata": {"difficulty": "Medium", "concept_tags": ["Electric Dipole", "Electric Field"]}},
];

// The user database
const allUsers = [
    {"_id": "69097f71b3df82ac2d37c38b", "auth_user_id": "U012", "display_name": "Ananya Shah", "class": "12", "board": "CBSE", "subjects": ["Physics", "Chemistry", "Mathematics"], "performance_summary": {"overall_accuracy": 0.67, "by_subject": {"Physics": {"average_score": 0.63, "by_chapter": {"Electrostatics": {"average_score": 0.55, "strength_level": "weak"}, "Ray Optics": {"average_score": 0.7, "strength_level": "moderate"}}}, "Chemistry": {"average_score": 0.7, "strength_level": "moderate"}, "Mathematics": {"average_score": 0.68, "strength_level": "moderate"}}}}
];

// --- [1] THE ORCHESTRATION FUNCTION ---

/**
 * Main function to generate a personalized practice set.
 * @param {string} userId - The _id of the user.
 * @param {string} subject - The subject (e.g., "Physics").
 * @param {string} chapter - The chapter (e.g., "Electrostatics").
 * @param {number} totalQuestions - The final number of questions desired (e.g., 15).
 * @returns {Promise<Object>} An object containing the final question set and strategy.
 */
async function getPersonalizedPracticeSet(userId, subject, chapter, totalQuestions = 15) {
    console.log(`Starting process for user ${userId} in ${subject} -> ${chapter}...`);

    // --- STEP 1: ANALYZE (User Profile) ---
    const user = allUsers.find(u => u.auth_user_id === userId);
    if (!user) {
        throw new Error(`User with ID ${userId} not found.`);
    }

    const chapterPerformance = user.performance_summary?.by_subject?.[subject]?.by_chapter?.[chapter];
    const performance = {
        level: chapterPerformance?.strength_level || "unknown",
        score: chapterPerformance?.average_score || null
    };

    // --- STEP 2: RETRIEVE (Your DB) ---
    
    // Define pedagogical strategy based on performance
    let retrievalStrategy;
    let pedagogicalGoal;
    
    if (performance.level === "weak") {
        retrievalStrategy = { difficulty: ["Easy", "Medium"], bias: "Easy", count: 10 };
        pedagogicalGoal = `The student's performance is **weak** (${performance.score * 100}% avg). The goal is to **reinforce foundational concepts** and build confidence. The test must focus on core definitions, basic formulas, and simple applications.`;
    } else if (performance.level === "moderate") {
        retrievalStrategy = { difficulty: ["Easy", "Medium", "Hard"], bias: "Medium", count: 10 };
        pedagogicalGoal = `The student's performance is **moderate** (${performance.score * 100}% avg). The goal is to **solidify understanding and challenge them slightly**. The test should have a mix of medium-difficulty problems and a few hard ones.`;
    } else if (performance.level === "strong") {
        retrievalStrategy = { difficulty: ["Medium", "Hard"], bias: "Hard", count: 10 };
        pedagogicalGoal = `The student's performance is **strong** (${performance.score * 100}% avg). The goal is to **challenge their mastery** with complex, multi-step problems and advanced conceptual questions.`;
    } else {
        // Default for unknown users/chapters
        retrievalStrategy = { difficulty: ["Easy", "Medium"], bias: "Easy", count: 10 };
        pedagogicalGoal = `No prior performance data exists. Start with a baseline test focusing on foundational "Easy" and "Medium" questions.`;
    }

    // Execute the retrieval
    const retrievedQuestions = allQuestions
        .filter(q => 
            q.subject === subject && 
            q.chapter === chapter && 
            retrievalStrategy.difficulty.includes(q.metadata.difficulty)
        )
        // Simple bias sorting (in a real app, this would be more complex)
        .sort((a, b) => {
            if (retrievalStrategy.bias === "Easy") {
                return (a.metadata.difficulty === "Easy" ? -1 : 1) - (b.metadata.difficulty === "Easy" ? -1 : 1);
            }
            if (retrievalStrategy.bias === "Hard") {
                return (a.metadata.difficulty === "Hard" ? -1 : 1) - (b.metadata.difficulty === "Hard" ? -1 : 1);
            }
            return 0; // Default medium bias
        })
        .slice(0, retrievalStrategy.count); // Get the top N questions

    console.log(`Retrieved ${retrievedQuestions.length} base questions.`);

    // --- STEP 3: AUGMENT & GENERATE (Gemini) ---

    // Build the dynamic prompt for Gemini
    const questionsToGenerate = totalQuestions - retrievedQuestions.length;
    const prompt = buildGeminiPrompt(user, subject, chapter, performance, pedagogicalGoal, retrievedQuestions, totalQuestions, questionsToGenerate);
    
    // Call the Gemini API
    console.log("Calling Gemini API for augmentation...");
    try {
        const geminiResponse = await callGeminiAPI(prompt);
        
        console.log("Successfully received personalized set from Gemini.");
        return {
            strategy: pedagogicalGoal,
            student: user.display_name,
            topic: `${subject} - ${chapter}`,
            performance: performance,
            totalQuestions: totalQuestions,
            finalQuestionSet: geminiResponse, // This is the final list from the API
        };

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to generate personalized set.");
    }
}

/**
 * Helper function to construct the detailed prompt for the Gemini API.
 */
function buildGeminiPrompt(user, subject, chapter, performance, pedagogicalGoal, retrievedQuestions, totalQuestions, questionsToGenerate) {
    // Format the retrieved questions for the prompt
    const retrievedQuestionsText = retrievedQuestions.map(q => {
        return JSON.stringify({
            question_text: q.question_text,
            difficulty: q.metadata.difficulty,
            concept_tags: q.metadata.concept_tags
        });
    }).join(",\n");

    return `
You are an expert AI tutor for a Class 12 CBSE student. Your goal is to create a highly personalized practice test.

---
### 1. STUDENT PROFILE & CONTEXT
- **Name:** ${user.display_name}
- **Subject:** ${subject}
- **Chapter:** ${chapter}
- **Performance:** ${performance.level} (Score: ${performance.score ? (performance.score * 100).toFixed(0) + '%' : 'N/A'})
- **Pedagogical Goal:** ${pedagogicalGoal}

---
### 2. RETRIEVED QUESTIONS FROM DATABASE
Here is a set of ${retrievedQuestions.length} questions I have already retrieved from our database. You MUST use most of these in the final set, as they are approved questions.

[
  ${retrievedQuestionsText}
]

---
### 3. YOUR TASK

Create a final, consolidated practice set of **${totalQuestions} questions** for ${user.display_name}.

1.  **Integrate:** Include at least ${retrievedQuestions.length - 2} of the "RETRIEVED QUESTIONS" provided above.
2.  **Generate New Questions:** Generate **${questionsToGenerate} NEW, ORIGINAL questions** to complete the set of ${totalQuestions}.
3.  **Personalize (CRITICAL):**
    * The **new** questions you generate must be **highly personalized** for this student.
    * They must match the **Pedagogical Goal** (e.g., if "weak", generate "Easy" foundational questions).
    * Focus on **conceptual gaps** not covered by the retrieved questions.
4.  **Format:** Present the final ${totalQuestions} questions as a clean, numbered list. Do not label them "Easy" or "Medium". Just provide the question text.
5.  **Order:** Start with the easier, foundational questions first to build confidence, then move to more complex ones.

Begin the list now.
`;
}

/**
 * --- [2] MOCK GEMINI API CALL ---
 * !! IMPORTANT !!
 * Replace this with your actual call to the Google AI SDK.
 * (e.g., using @google/generative-ai)
 *
 * async function callGeminiAPI(prompt) {
 * const { GoogleGenerativeAI } = require("@google/generative-ai");
 * const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
 * const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // or "gemini-2.0-flash" when available
 * * const result = await model.generateContent(prompt);
 * const response = await result.response;
 * return response.text();
 * }
 */
async function callGeminiAPI(prompt) {
    console.log("--- MOCK GEMINI PROMPT (to be sent) ---");
    console.log(prompt.substring(0, 1000) + "\n... (prompt truncated) ...");
    console.log("--- END MOCK PROMPT ---");

    // This is a MOCK response. The real Gemini API will generate this list.
    const mockApiResponse = `
1. State Coulomb's law and express it in vector form.
2. Define electric flux. Write its S.I. unit.
3. What is the S.I. unit of electric field intensity?
4. State Gauss's law in electrostatics.
5. Why do the electrostatic field lines not form closed loops?
6. What is an equipotential surface?
7. Draw equipotential surfaces for a uniform electric field.
8. What is the relationship between electric field and electric potential?
9. Define capacitance. What is its S.I. unit?
10. Two point charges ‘q1’ and ‘q2’ are placed at a distance ‘d’ apart. ...
11. What happens to the capacitance of a parallel plate capacitor when a dielectric slab is inserted between its plates?
12. Write the formula for the energy stored in a capacitor.
13. Derive an expression for the electric field at a point on the axial line of an electric dipole.
14. Find the electric field at a point on the equatorial line of an electric dipole.
15. A 4µF capacitor is charged to 200V. It is then disconnected from the supply and connected to another uncharged 2µF capacitor. ...
    `;
    
    // Simulate network delay
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(mockApiResponse);
        }, 1500);
    });
}


// --- [3] EXAMPLE USAGE ---

async function run() {
    try {
        const personalizedSet = await getPersonalizedPracticeSet(
            "U012",             // Ananya Shah's User ID
            "Physics",          
            "Electrostatics",
            15                  // Total questions desired
        );
        
        console.log("\n\n✅ --- FINAL PERSONALIZED PRACTICE SET --- ✅");
        console.log(`\nStudent: ${personalizedSet.student}`);
        console.log(`Topic: ${personalizedSet.topic}`);
        console.log(`Performance: ${personalizedSet.performance.level} (Score: ${personalizedSet.performance.score * 100}%)`);
        console.log(`Strategy: ${personalizedSet.strategy}`);
        console.log("\n--- Questions ---");
        console.log(personalizedSet.finalQuestionSet);
        console.log("----------------------------------------------");

    } catch (error) {
        console.error("Failed to generate practice set:", error.message);
    }
}

// Run the example
run();