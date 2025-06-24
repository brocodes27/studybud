const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface FlashcardRequest {
  topic: string;
  subject: string;
  class?: string;
  chapters?: string;

  count: number;
  plan_id?: string;
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

    const { topic, subject, class: studentClass, chapters, count }: FlashcardRequest = await req.json();

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
      contextInfo += `\nChapters covered: ${chapters}`;
    }

    const topicText = topic === 'all_chapters' ? `all chapters (${chapters})` : topic;

    const prompt = `Generate ${count} educational flashcards for the topic "${topicText}" based on the following context:

${contextInfo}

Create flashcards that are:
1. Educational and accurate for Class ${studentClass || ''} level
2. Varied in difficulty (easy, medium, hard)
3. Cover different aspects of the topic/chapters
4. Have clear, concise questions
5. Provide comprehensive but concise answers
6. Appropriate for the academic level and curriculum

${topic === 'all_chapters' ? 
  `Since this covers all chapters, create a mix of questions from different chapters: ${chapters}. Ensure good coverage across all topics.` :
  `Focus specifically on the topic: ${topic}`
}

For each flashcard, provide:
- A clear question about the topic
- A detailed answer
- Difficulty level (easy/medium/hard)

Return the response in this exact JSON format:
{
  "flashcards": [
    {
      "question": "Clear, specific question about the topic",
      "answer": "Comprehensive but concise answer",
      "difficulty_level": "easy|medium|hard"
    }
  ]
}

Make sure questions are specific and answers are educational. Include definitions, explanations, examples, and key concepts relevant to Class ${studentClass || ''} ${subject}.`;

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
    let flashcardsData;
    try {
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        flashcardsData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", generatedText);
      throw new Error("Failed to parse AI response");
    }

    // Save flashcards to Supabase
    const flashcardsToInsert = flashcardsData.flashcards.map((card: any) => ({
      user_id: userId,

      topic: topic === 'all_chapters' ? `${subject} - All Chapters` : topic,
      question: card.question,
      answer: card.answer,
      difficulty_level: card.difficulty_level,
      mastery_level: 0,
      next_review_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    }));

    const savedFlashcardsResponse = await fetch(`${supabaseUrl}/rest/v1/flashcards`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
        "Prefer": "return=representation",
      },
      body: JSON.stringify(flashcardsToInsert),
    });

    if (!savedFlashcardsResponse.ok) {
      const errorText = await savedFlashcardsResponse.text();
      console.error("Supabase error:", errorText);
      throw new Error(`Failed to save flashcards: ${savedFlashcardsResponse.status}`);
    }

    const flashcards = await savedFlashcardsResponse.json();

    return new Response(
      JSON.stringify(flashcards),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating flashcards:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to generate flashcards", 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});