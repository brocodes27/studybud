import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { roadmap_id, target_date } = await req.json()
    const prescriptionDate = target_date || new Date().toISOString().split('T')[0]

    // Gather Context
    // 1. Roadmap info
    const { data: roadmap, error: rError } = await supabaseClient
      .from('student_roadmaps')
      .select('*')
      .eq('id', roadmap_id)
      .single()
      
    if (rError || !roadmap) throw new Error("Roadmap not found")

    // 2. Today's classes
    const { data: sessions } = await supabaseClient
      .from('class_sessions')
      .select('subject, topics_covered, homework_assigned')
      .eq('roadmap_id', roadmap_id)
      .eq('session_date', prescriptionDate)

    // 3. Next test
    const { data: nextTests } = await supabaseClient
       .from('upcoming_tests')
       .select('*')
       .eq('roadmap_id', roadmap_id)
       .eq('status', 'upcoming')
       .gte('test_date', prescriptionDate)
       .order('test_date', { ascending: true })
       .limit(1)
       
    const nextTest = nextTests && nextTests.length > 0 ? nextTests[0] : null
    
    // 4. Behavioral Profile
    const { data: profile } = await supabaseClient
      .from('student_behavioral_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // Package context for AI Gen
    const contextSnapshot = {
      roadmap_week: roadmap.current_week,
      today_sessions: sessions || [],
      next_test: nextTest ? {
        name: nextTest.test_name,
        date: nextTest.test_date,
        duration: nextTest.duration_minutes,
        days_until: Math.ceil((new Date(nextTest.test_date).getTime() - new Date(prescriptionDate).getTime()) / (1000 * 3600 * 24))
      } : null,
      behavioral_profile: profile || { preferred_time: 'evening', typical_session_duration_min: 90 }
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")
    if (!openaiApiKey) throw new Error("OpenAI key missing")

    const systemPrompt = `You are Ranjan Sir, an elite JEE mentor. Your job is to generate a precise nightly study plan (prescription) for today.
Here is the context:
${JSON.stringify(contextSnapshot, null, 2)}

Instructions:
1. Generate an ordered sequence of study tasks.
2. If there were classes today, priority 1 is reviewing those notes and doing assigned homework.
3. Keep total estimated time under 120 minutes (or under the typical_session_duration_min if provided).
4. For weak/new topics, prescribe 'guided_examples'. For strong topics, prescribe 'retrieval_check'.
5. Generate an 'implementation_intentions' array (e.g., 'At 7:00 PM, I will open HC Verma and do 5 questions').

Output strictly in JSON:
{
  "total_estimated_minutes": number,
  "tasks": [
    { "order": 1, "type": "review_notes", "subject": "Physics", "topic": "NLM", "duration_min": 20, "details": "string", "difficulty": "guided|easy|medium|hard" }
  ],
  "implementation_intentions": [
    { "trigger": "After dinner at 8pm", "action": "Start Mathematics DPP", "duration_min": 30 }
  ]
}
`

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiApiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "system", content: "You output JSON only." }, { role: "user", content: systemPrompt }],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    })

    if (!aiRes.ok) throw new Error(`OpenAI Error: ${await aiRes.text()}`)
    const aiData = await aiRes.json()
    const prescriptionJSON = JSON.parse(aiData.choices[0].message.content)

    const { data: prescription, error: presErr } = await supabaseClient
      .from('daily_prescriptions')
      .insert({
        user_id: user.id,
        roadmap_id,
        prescription_date: prescriptionDate,
        context_snapshot: contextSnapshot,
        tasks: prescriptionJSON.tasks,
        implementation_intentions: prescriptionJSON.implementation_intentions,
        total_estimated_minutes: prescriptionJSON.total_estimated_minutes,
        status: 'active'
      })
      .select()
      .single()

    if (presErr) throw presErr

    return new Response(JSON.stringify({ success: true, prescription }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
