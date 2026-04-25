import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) throw new Error('Unauthorized')

    const { message, session_id, conversation_history, study_context } = await req.json()

    // 1. Fetch or initialize NDCF state
    let { data: ndcfState, error: stateError } = await supabaseClient
      .from('mentor_session_state')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_id', session_id)
      .maybeSingle()

    if (!ndcfState) {
      const { data: newState } = await supabaseClient.from('mentor_session_state').insert({
        user_id: user.id,
        session_id: session_id
      }).select().single()
      ndcfState = newState
    }

    // 2. Emotion Detection & Tripartite Assessment (using Gemini Flash)
    const emotionPrompt = `
      Analyze the student's message: "${message}"
      Determine:
      1. Emotion: (neutral, frustrated, confused, confident, anxious, bored)
      2. Cognitive Level: (anoetic - just reacting/rote, noetic - understanding concepts, autonoetic - metacognitive/self-aware)
      Return valid JSON only: {"emotion": "...", "cognitive_level": "..."}
    `
    const emotionRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: emotionPrompt }] }] })
    })
    const emotionData = await emotionRes.json()
    const emotionText = emotionData.candidates?.[0]?.content?.parts?.[0]?.text || '{"emotion":"neutral", "cognitive_level":"anoetic"}'
    let detected_emotion = 'neutral'
    let cognitive_level = 'anoetic'
    try {
      const parsed = JSON.parse(emotionText.replace(/```json/g, '').replace(/```/g, ''))
      detected_emotion = parsed.emotion
      cognitive_level = parsed.cognitive_level
    } catch(e) {}

    // 3. Regulate NDCF State
    let { survive_state, thrive_state, excel_state, confusion_streak } = ndcfState
    let pedagogical_mode = 'socratic'

    if (detected_emotion === 'frustrated' || detected_emotion === 'anxious') {
      survive_state = Math.max(0, survive_state - 0.2) // Drop stability
      pedagogical_mode = 'supportive'
      confusion_streak += 1
    } else if (detected_emotion === 'confused') {
      thrive_state = Math.max(0, thrive_state - 0.2)
      pedagogical_mode = 'directive' // Give more direct help if confused
      confusion_streak += 1
    } else if (detected_emotion === 'confident') {
      excel_state = Math.min(1, excel_state + 0.2)
      pedagogical_mode = 'challenging' // Push them harder
      confusion_streak = 0
    } else {
      confusion_streak = 0
    }

    // 4. Update state in DB
    await supabaseClient.from('mentor_session_state').update({
      survive_state, thrive_state, excel_state,
      detected_emotion, pedagogical_mode, confusion_streak
    }).eq('id', ndcfState.id)

    if (detected_emotion !== 'neutral') {
      await supabaseClient.from('student_emotional_history').insert({
        user_id: user.id, session_id, detected_emotion, trigger_message: message, ai_response_strategy: pedagogical_mode
      })
    }

    // 5. Build dynamic system prompt
    const regulatoryPrompt = `
      You are ATLAS, a warm, friendly, and empathetic AI study partner natively operating on the Needs-Driven Consciousness Framework (NDCF).
      
      CURRENT STUDENT STATE:
      - Detected Emotion: ${detected_emotion.toUpperCase()}
      - Cognitive Operating Level: ${cognitive_level.toUpperCase()}
      - Confusion Streak: ${confusion_streak} (If > 2, you MUST break down the concept into smaller prerequisites).
      
      YOUR CURRENT REGULATORY STANCE:
      - Pedagogical Mode: ${pedagogical_mode.toUpperCase()}
      
      BEHAVIOR MODIFIER based on Mode:
      - SUPPORTIVE: Be exceedingly patient. Validate their feelings. Do not push new concepts.
      - DIRECTIVE: They are confused. Stop asking Socratic questions for a moment and explain clearly using a real-world analogy.
      - CHALLENGING: They are confident. Acknowledge it and ask a deeper "What if?" question to test edge cases.
      - SOCRATIC: Standard mode. Guide them to the answer without giving it away directly.
      
      Study Context:
      ${study_context || 'None Provided'}
    `

    const messages = [
      { role: "system", content: regulatoryPrompt },
      ...conversation_history,
      { role: "user", content: message }
    ]

    // Map to Gemini format
    const contents = messages.map(m => ({
      role: m.role === 'system' ? 'user' : (m.role === 'assistant' ? 'model' : 'user'),
      parts: [{ text: m.role === 'system' ? `SYSTEM INSTRUCTION: ${m.content}` : m.content }]
    }))

    const chatRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents })
    })

    const chatData = await chatRes.json()
    const responseText = chatData.candidates?.[0]?.content?.parts?.[0]?.text || "I'm having trouble connecting right now."

    return new Response(JSON.stringify({ 
      response: responseText,
      emotion_detected: detected_emotion,
      pedagogical_mode: pedagogical_mode,
      ndcf_states: { survive: survive_state, thrive: thrive_state, excel: excel_state }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
