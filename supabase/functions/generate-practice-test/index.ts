const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface PracticeTestRequest {
  subject: string;
  class?: string;
  chapters?: string;
  plan_id?: string;
  question_count: number;
  duration_minutes: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get the authorization header to extract user info
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract JWT token and verify user
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "Authorization": authHeader,
        "apikey": supabaseServiceKey,
      },
    });

    if (!userResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userData = await userResponse.json();
    const userId = userData.id;

    const { subject, class: studentClass, chapters, plan_id, question_count, duration_minutes }: PracticeTestRequest = await req.json();

    // Prepare Gemini API request
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build context-aware prompt
    let contextInfo = `Subject: ${subject}`;
    if (studentClass) {
      contextInfo += `\nClass/Grade: ${studentClass}`;
    }
    if (chapters) {
      contextInfo += `\nChapters to cover: ${chapters}`;
    }

    const prompt = `Generate a comprehensive practice test based on the following context:

${contextInfo}

Create a practice test with ${question_count} multiple-choice questions that:

1. Cover the specified chapters: ${chapters || 'all relevant topics'}
2. Are appropriate for Class ${studentClass || ''} level
3. Test real understanding of ${subject} concepts
4. Include a good mix of difficulty levels
5. Cover different aspects and applications
6. Follow standard academic question patterns

${chapters ? 
  `Distribute questions across these chapters: ${chapters}. Ensure good coverage of all topics.` :
  `Cover fundamental concepts and applications in ${subject}.`
}

Requirements:
- Each question should have 4 options (A, B, C, D)
- Questions should vary in difficulty and cover different aspects
- Include clear explanations for correct answers
- Questions should be educational and test real understanding
- Cover fundamental concepts, applications, and problem-solving

For each question, provide:
- A clear, specific question
- 4 multiple choice options
- The index (0-3) of the correct answer
- A brief explanation of why the answer is correct

Return the response in this exact JSON format:
{
  "title": "Practice Test - ${subject} (Class ${studentClass || ''})",
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": 0,
      "explanation": "Brief explanation of why this answer is correct"
    }
  ]
}

Make sure questions are challenging but fair, and test real understanding of ${subject} concepts at Class ${studentClass || ''} level.`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json();
    const generatedText = geminiData.candidates[0].content.parts[0].text;

    // Parse the JSON response from Gemini
    let testData;
    try {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        testData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", generatedText);
      throw new Error("Failed to parse AI response");
    }

    // Save practice test to Supabase
    const testToInsert = {
      user_id: userId,
      plan_id: plan_id || null,
      title: testData.title,
      subject: subject,
      questions: testData.questions,
      total_questions: testData.questions.length,
      duration_minutes: duration_minutes,
    };

    const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/practice_tests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
        "Prefer": "return=representation",
      },
      body: JSON.stringify(testToInsert),
    });

    if (!supabaseResponse.ok) {
      const errorText = await supabaseResponse.text();
      console.error("Supabase error:", errorText);
      throw new Error(`Failed to save practice test: ${supabaseResponse.status}`);
    }

    const savedTest = await supabaseResponse.json();

    return new Response(
      JSON.stringify(savedTest[0]),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating practice test:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to generate practice test", 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});