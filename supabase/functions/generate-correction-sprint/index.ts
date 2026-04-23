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

    const { target_test_result_id, roadmap_id, weak_topics } = await req.json()
    
    // Fetch user behavioral profile
    const { data: profile } = await supabaseClient
      .from('student_behavioral_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")
    if (!openaiApiKey) throw new Error("OpenAI key missing")

    const systemPrompt = `You are Ranjan Sir, an elite rigorous JEE mentor. You are creating a 'Correction Sprint' for a student who just took a test.
Here are the weak topics extracted from their test result:
${JSON.stringify(weak_topics, null, 2)}
Student Profile:
${JSON.stringify(profile || {}, null, 2)}

Instructions:
1. Generate an actionable, max 3-day sprint. Let's assign tasks specifically to correct the root conceptual gap of the weak topics.
2. The sprint tasks are discrete actions: "Solve 10 questions on Rotational Friction", "Watch explanation on Spring Constants".
3. Return exactly JSON.

Output Format:
{
  "sprint_name": "string",
  "estimated_days": number,
  "sprint_tasks": [
    { "order": 1, "task_type": "deep_work|video|practice", "topic": "string", "description": "string", "duration_min": 30 }
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
    const sprintJSON = JSON.parse(aiData.choices[0].message.content)

    // Insert to DB
    const { data: sprint, error: insertError } = await supabaseClient
      .from('correction_sprints')
      .insert({
        user_id: user.id,
        roadmap_id,
        test_result_id: target_test_result_id || null,
        sprint_name: sprintJSON.sprint_name,
        estimated_days: sprintJSON.estimated_days,
        sprint_tasks: sprintJSON.sprint_tasks,
        status: 'active'
      })
      .select()
      .single()

    // Gracefully handle if table is missing locally for the test mode 
    if (insertError && !insertError.message.includes('relation "correction_sprints" does not exist')) {
        throw insertError
    }

    return new Response(JSON.stringify({ success: true, sprint: sprint || sprintJSON }), {
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
