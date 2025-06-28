import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface FlashcardRequest {
  topic: string;
  subject: string;
  class?: string;
  chapters?: string;

  count: number;
  plan_id?: string;
}

serve(async (req: Request) => {
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

    // Log and parse the raw request body for debugging
    const rawBody = await req.text();
    console.log("Raw request body:", rawBody);
    let parsedBody;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (e) {
      console.error("Failed to parse body as JSON:", e);
    }
    console.log("Parsed body:", parsedBody);

    // Use parsedBody instead of await req.json()
    const { topic, subject, class: studentClass, chapters, count }: FlashcardRequest = parsedBody || {};

    // Log incoming request for debugging
    console.log("Flashcard request received:", { topic, subject, studentClass, chapters, count });

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
  `Focus ONLY on the topic: "${topic}". Do NOT include questions from other topics or chapters.`
}

For each flashcard, provide:
- A clear question about the topic
- A detailed answer
- Difficulty level (easy/medium/hard)
- **A required 'topic' field**: For each flashcard, include a "topic" field with the topic name (e.g., "Algebra", "Trigonometry", etc.).

Return the response in this exact JSON format (do NOT include markdown/code fences or extra commentary):
{
  "flashcards": [
    {
      "topic": "Topic Name",
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
      console.error("Failed to parse Gemini response:", {
        error: parseError.message,
        responseLength: generatedText.length,
        responsePreview: generatedText.substring(0, 500) + "...",
        responseEnd: generatedText.substring(Math.max(0, generatedText.length - 200))
      });
      
      if (parseError.message.includes("Unexpected end of JSON input")) {
        throw new Error("AI response was truncated. Please try again with fewer flashcards or a more specific topic.");
      } else {
        throw new Error("Failed to parse AI response");
      }
    }

    // Save flashcards to Supabase
    const flashcardsToInsert = flashcardsData.flashcards.map((card: any) => ({
      user_id: userId,
      topic: card.topic && card.topic.trim()
        ? card.topic.trim()
        : (topic === 'all_chapters'
            ? `${subject} - All Chapters`
            : (topic && topic.trim() ? topic.trim() : 'General')),
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