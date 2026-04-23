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

    const { message, session_id, conversation_history, study_context, use_full_orchestration = true } = await req.json()

    // 0. Fetch Knowledge Graph context
    // This allows the mentor to maintain overall scope of what the student knows vs is weak at
    let knowledgeGraphContext = "Student's global mastery profiles have not been initialized yet.";
    try {
      // Get the lowest performing KCs (Knowledge Components) for this user
      const { data: weakNodes, error: nodeError } = await supabaseClient
        .from('student_cognitive_profiles')
        .select(`
          p_mastery,
          cognitive_tier,
          knowledge_components ( topic, subject )
        `)
        .eq('user_id', user.id)
        .lt('p_mastery', 0.8)
        .order('p_mastery', { ascending: true })
        .limit(5);

      if (!nodeError && weakNodes && weakNodes.length > 0) {
        knowledgeGraphContext = "Student's Identified Weak Areas (Knowledge Graph):\n" + 
          weakNodes.map((n: any) => `- ${n.knowledge_components?.subject} / ${n.knowledge_components?.topic} (Mastery: ${(n.p_mastery * 100).toFixed(0)}%, Level: ${n.cognitive_tier})`).join('\n');
      }
    } catch(e) {
      console.error("Failed to fetch knowledge graph context:", e);
    }

    // Base context string augmented with Knowledge Graph state
    const baseContext = `Study Context: ${study_context}\n\n${knowledgeGraphContext}\n\nRecent History: ${JSON.stringify(conversation_history.slice(-3))}\nStudent Message: ${message}`

    // Internal helper to call Gemini
    const callGemini = async (systemPrompt: string, userPrompt: string) => {
      const contents = [
        { role: 'user', parts: [{ text: `SYSTEM INSTRUCTION: ${systemPrompt}\n\nUSER PROMPT: ${userPrompt}` }]}
      ]
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
         method: "POST", headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ 
           contents,
           generationConfig: { temperature: 0.3 }
         })
      })
      const data = await res.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    }

    let finalResponse = ''
    let emotionDetected = 'neutral'
    let pedagogicalMode = 'socratic'

    if (!use_full_orchestration) {
      // Fast path (Route to NDCF mentor or direct)
       finalResponse = await callGemini("You are ATLAS, an expert tutor. Provide a precise, helpful answer.", baseContext)
    } else {
      // 1. Emotional Agent
      const emotionalOutput = await callGemini(
        "You are the Emotional Intelligence Agent. Analyze the student's emotional state (frustration, confidence, confusion). Output a short JSON with { 'emotion': '...', 'recommended_tone': '...' }",
        baseContext
      )

      try {
        const parsed = JSON.parse(emotionalOutput.replace(/```json/g, '').replace(/```/g, ''))
        emotionDetected = parsed.emotion || 'neutral'
      } catch(e) {}

      // 2. Subject Expert Agent
      const expertOutput = await callGemini(
        "You are the Subject Expert Agent. Ignore teaching style. Just analyze the factual correctness of the student's statement or precisely answer their technical question. Output pure facts.",
        baseContext
      )

      // 3. Pedagogical Agent
      const pedagogyOutput = await callGemini(
        `You are the Pedagogical Agent. Given the Expert's facts: "${expertOutput}" and the student's emotion: "${emotionDetected}", decide HOW to teach this. Should we use Socratic questioning, a real-world analogy, or just give the answer? Output your strategy.`,
        baseContext
      )

      // 4. Meta Agent (Synthesizer)
      finalResponse = await callGemini(
        `You are the Meta-Agent (StudyBud) operating as the core engine of an Agentic OS. Synthesize the final response to the student.
         Expert Facts: ${expertOutput}
         Teaching Strategy: ${pedagogyOutput}
         Tone to use based on emotion: ${emotionDetected}
         
         Write the actual message the student will see. Keep it engaging, empathetic, and adhering to the strategy. Do not mention that you are an AI or agents.
         
         CRITICAL UI ROUTING: You control the student's UI workspace. If the student implicitly or explicitly asks to:
         - Watch videos or lectures: append exactly [ACTION:NAVIGATE_VIDEOS] at the end of your response.
         - Take a test, practice quiz, or solve papers: append exactly [ACTION:NAVIGATE_TEST]
         - View their knowledge graph or atlas: append exactly [ACTION:NAVIGATE_ATLAS]
         - See their study plans or curriculum: append exactly [ACTION:NAVIGATE_PLANS]
         
         Only append ONE tag if a transition is strongly requested. Otherwise, just output your normal conversational response.`,
        baseContext
      )

      // Log the conversation flow asynchronously
      const logPromises = [
        { name: 'Emotional Agent', role: 'monitor', output: emotionalOutput },
        { name: 'Expert Agent', role: 'subject_matter', output: expertOutput },
        { name: 'Pedagogy Agent', role: 'teaching_strategy', output: pedagogyOutput },
        { name: 'Meta Agent', role: 'synthesizer', output: finalResponse }
      ].map(agent => 
         supabaseClient.from('agent_conversations').insert({
            session_id,
            user_id: user.id,
            agent_name: agent.name,
            agent_role: agent.role,
            output: agent.output,
            input_context: { message }
         })
      )
      
      Promise.all(logPromises).catch(console.error)
    }

    return new Response(JSON.stringify({ 
      response: finalResponse,
      emotion_detected: emotionDetected,
      pedagogical_mode: pedagogicalMode,
      orchestration_used: use_full_orchestration
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
