import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StudyBuddyRequest {
  message: string;
  studyContext?: string;
  subject?: string;
  class?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    // Verify token and get user ID using Supabase
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

    const { message, studyContext, subject, class: studentClass }: StudyBuddyRequest = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length < 3) {
      return new Response(JSON.stringify({ error: 'Please provide a valid question (at least 3 characters).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // Build context-aware prompt
    let contextInfo = '';
    if (studyContext) {
      contextInfo += `\n\nSTUDY CONTEXT:\n${studyContext}`;
    }
    if (subject) {
      contextInfo += `\nSubject: ${subject}`;
    }
    if (studentClass) {
      contextInfo += `\nClass/Grade: ${studentClass}`;
    }

    const prompt = `You are an AI Study Buddy, a helpful and encouraging learning assistant for students. Your role is to:

1. **Provide clear, educational explanations** that are appropriate for the student's level
2. **Give step-by-step solutions** when asked for help with problems
3. **Explain complex concepts in simple terms** using analogies and examples
4. **Encourage active learning** by asking follow-up questions
5. **Provide practice questions** when requested
6. **Be supportive and motivating** while maintaining academic rigor

${contextInfo ? `STUDENT CONTEXT:${contextInfo}` : ''}

STUDENT QUESTION: ${message}

Please respond in a helpful, encouraging, and educational manner. If the student is working on a specific subject or topic, tailor your response accordingly. Use clear language, provide examples when helpful, and encourage the student to think critically.

If the student asks for practice questions, provide 2-3 relevant questions with brief explanations of the answers.

Keep your response concise but comprehensive, and always maintain a supportive and educational tone.`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiApiKey}`,
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
    const response = geminiData.candidates[0].content.parts[0].text;

    // Save chat history to Supabase (optional - for analytics)
    try {
      await fetch(`${supabaseUrl}/rest/v1/chat_history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
        body: JSON.stringify({
          user_id: userId,
          message: message,
          response: response,
          subject: subject || 'General',
          class: studentClass || '',
          created_at: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.warn('Failed to save chat history:', error);
      // Don't fail the request if chat history saving fails
    }

    return new Response(JSON.stringify({ response }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error("Error in AI Study Buddy:", err);
    return new Response(JSON.stringify({ 
      error: 'Failed to get AI response', 
      details: err.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 