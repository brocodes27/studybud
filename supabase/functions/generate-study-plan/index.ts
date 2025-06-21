const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface StudyPlanRequest {
  class: string;
  subject: string;
  chapters: string;
  exam_date: string;
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

    // Extract JWT token
    const token = authHeader.replace("Bearer ", "");
    
    // Verify token and get user ID using Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    // Verify the JWT token
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

    const { class: studentClass, subject, chapters, exam_date }: StudyPlanRequest = await req.json();

    // Calculate days until exam
    const examDate = new Date(exam_date);
    const today = new Date();
    const timeDiff = examDate.getTime() - today.getTime();
    const daysUntilExam = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysUntilExam <= 0) {
      return new Response(
        JSON.stringify({ error: "Exam date must be in the future" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    const prompt = `Create a comprehensive personalized study plan for a Class ${studentClass} student preparing for a ${subject} exam. 

Details:
- Subject: ${subject}
- Chapters: ${chapters}
- Days until exam: ${daysUntilExam}

Generate a detailed daily study schedule that covers all chapters systematically. For each day, provide:

1. **Topics to Study**: Specific concepts, formulas, theories, or chapters to focus on
2. **Practice Questions**: 3-5 specific practice questions related to the day's topics (include the actual questions, not just question types)
3. **Question Types**: Types of questions to practice (MCQs, Short Answer, Numericals, Long Answer, Case Studies, etc.)
4. **Study Description**: Brief description of what to study and how to approach it

Requirements:
- Include actual practice questions with varying difficulty levels
- Questions should be relevant to Class ${studentClass} ${subject} curriculum
- Distribute chapters evenly across available days
- Reserve last 2-3 days for comprehensive revision and mock tests
- Make questions progressively challenging as exam approaches

Return the response in this exact JSON format:
{
  "days_until_exam": ${daysUntilExam},
  "daily_schedule": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "topic": "Chapter name and specific topics to study",
      "question_type": "Types of questions to practice",
      "description": "Study approach and key points to focus on",
      "practice_questions": [
        "Question 1: [Actual question text]",
        "Question 2: [Actual question text]",
        "Question 3: [Actual question text]"
      ]
    }
  ]
}

Make sure to include actual, specific practice questions that are appropriate for the subject and class level.`;

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
    let studyPlan;
    try {
      // Extract JSON from the response (in case there's additional text)
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        studyPlan = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", generatedText);
      throw new Error("Failed to parse AI response");
    }

    // Add dates to the schedule
    studyPlan.daily_schedule = studyPlan.daily_schedule.map((day: any, index: number) => {
      const studyDate = new Date(today);
      studyDate.setDate(today.getDate() + index);
      return {
        ...day,
        date: studyDate.toISOString().split('T')[0],
      };
    });

    // Save to Supabase with user_id
    const supabaseResponse = await fetch(`${supabaseUrl}/rest/v1/exam_plans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
      },
      body: JSON.stringify({
        user_id: userId,
        class: studentClass,
        subject,
        chapters,
        exam_date,
        plan: studyPlan,
      }),
    });

    if (!supabaseResponse.ok) {
      const errorText = await supabaseResponse.text();
      console.error("Supabase error:", errorText);
      throw new Error(`Supabase error: ${supabaseResponse.status}`);
    }

    return new Response(
      JSON.stringify(studyPlan),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating study plan:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to generate study plan", 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});