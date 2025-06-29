import { isUserPremium } from '../_utils_subscription.ts';

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

    // Limit study period to prevent overly large responses
    if (daysUntilExam > 30) {
      return new Response(
        JSON.stringify({ error: "Study period cannot exceed 30 days to ensure reliable AI response generation" }),
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

    // Check free vs premium tier
    const { premium } = await isUserPremium(userId);
    if (!premium) {
      // 1. Check if user already generated 7 days of plans this month
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();
      const plansResponse = await fetch(`${supabaseUrl}/rest/v1/exam_plans?user_id=eq.${userId}&created_at=gte.${firstDayOfMonth}&created_at=lte.${lastDayOfMonth}`, {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });
      const plans = await plansResponse.json();
      let totalDays = 0;
      for (const plan of plans) {
        totalDays += plan.plan?.days_until_exam || 0;
      }
      if (totalDays >= 7) {
        return new Response(
          JSON.stringify({ error: 'Free tier limit reached: Upgrade to premium for unlimited plans.' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      // 2. Only 1 subject allowed (subject is a string, so just check if user has other plans with different subject)
      const uniqueSubjects = new Set(plans.map(p => p.subject));
      uniqueSubjects.add(subject);
      if (uniqueSubjects.size > 1) {
        return new Response(
          JSON.stringify({ error: 'Free tier: Only 1 subject allowed. Upgrade for multiple subjects.' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      // 3. Only MCQ and short-answer allowed (enforced in frontend, but double check here if question types are passed)
      // If you add question types to the request, check here as well
    }

    // Function to generate study plan with different prompt strategies
    const generateStudyPlanWithPrompt = async (useShortPrompt = false) => {
      // Determine number of questions based on study period length
      const questionsPerDay = daysUntilExam <= 15 ? 10 : 3;
      
      console.log(`Generating study plan with ${questionsPerDay} questions per day for ${daysUntilExam} days study period`);
      
      const prompt = useShortPrompt 
        ? `Create a study plan for Class ${studentClass} ${subject} exam in ${daysUntilExam} days. Cover chapters: ${chapters}. Return JSON with daily_schedule array, each day having: day, date, topic, question_type, description, and practice_questions (${questionsPerDay} questions max). Keep it concise.`
        : `Create a comprehensive personalized study plan for a Class ${studentClass} student preparing for a ${subject} exam. 

Details:
- Subject: ${subject}
- Chapters: ${chapters}
- Days until exam: ${daysUntilExam}

Generate a detailed daily study schedule that covers all chapters systematically. For each day, provide:

1. **Topics to Study**: Specific concepts, formulas, theories, or chapters to focus on
2. **Practice Questions**: ${questionsPerDay} specific practice questions related to the day's topics (include the actual questions, not just question types)
3. **Question Types**: Types of questions to practice (MCQs, Short Answer, Numericals, Long Answer, Case Studies, etc.)
4. **Study Description**: Brief description of what to study and how to approach it

Requirements:
- Include exactly ${questionsPerDay} practice questions per day with varying difficulty levels
- Questions should be relevant to Class ${studentClass} ${subject} curriculum
- Distribute chapters evenly across available days
- Reserve last 2-3 days for comprehensive revision and mock tests
- Make questions progressively challenging as exam approaches
- Keep descriptions concise but informative

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
        "Question 3: [Actual question text]"${questionsPerDay > 3 ? `,
        "Question 4: [Actual question text]",
        "Question 5: [Actual question text]",
        "Question 6: [Actual question text]",
        "Question 7: [Actual question text]",
        "Question 8: [Actual question text]",
        "Question 9: [Actual question text]",
        "Question 10: [Actual question text]"` : ''}
      ]
    }
  ]
}

Make sure to include actual, specific practice questions that are appropriate for the subject and class level. Keep responses concise to avoid truncation.`;

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

      // Validate response size and content
      if (!generatedText || generatedText.length < 50) {
        throw new Error("Gemini response is too short or empty");
      }

      // Check if response might be truncated (look for incomplete JSON)
      if (generatedText.length > 10000) {
        console.warn("Large Gemini response detected, may be truncated");
      }

      // Parse the JSON response from Gemini with improved error handling
      let studyPlan;
      try {
        // First, try to extract JSON from the response
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in response");
        }

        const jsonString = jsonMatch[0];
        
        // Check if JSON appears to be complete
        const openBraces = (jsonString.match(/\{/g) || []).length;
        const closeBraces = (jsonString.match(/\}/g) || []).length;
        
        if (openBraces !== closeBraces) {
          throw new Error("JSON appears to be incomplete (unmatched braces)");
        }

        // Try to parse the JSON
        studyPlan = JSON.parse(jsonString);
        
        // Validate the parsed structure
        if (!studyPlan || typeof studyPlan !== 'object') {
          throw new Error("Parsed response is not a valid object");
        }
        
        if (!studyPlan.daily_schedule || !Array.isArray(studyPlan.daily_schedule)) {
          throw new Error("Missing or invalid daily_schedule in response");
        }

        if (!studyPlan.days_until_exam || typeof studyPlan.days_until_exam !== 'number') {
          throw new Error("Missing or invalid days_until_exam in response");
        }

        return studyPlan;

      } catch (parseError) {
        console.error("Failed to parse Gemini response:", {
          error: parseError.message,
          responseLength: generatedText.length,
          responsePreview: generatedText.substring(0, 500) + "...",
          responseEnd: generatedText.substring(Math.max(0, generatedText.length - 200)),
          useShortPrompt
        });
        
        throw parseError;
      }
    };

    // Try with full prompt first, then fallback to short prompt
    let studyPlan;
    try {
      studyPlan = await generateStudyPlanWithPrompt(false);
    } catch (error) {
      console.log("Full prompt failed, trying short prompt...");
      try {
        studyPlan = await generateStudyPlanWithPrompt(true);
      } catch (fallbackError) {
        // If both attempts fail, provide a helpful error message
        if (fallbackError.message.includes("Unexpected end of JSON input") || 
            fallbackError.message.includes("unmatched braces")) {
          throw new Error("AI response was truncated. Please try again with a shorter study period (max 30 days) or fewer chapters. For longer periods, we automatically reduce questions to prevent truncation.");
        } else {
          throw new Error(`Failed to generate study plan: ${fallbackError.message}`);
        }
      }
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