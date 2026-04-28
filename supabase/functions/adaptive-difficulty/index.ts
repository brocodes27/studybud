import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'

// Configuration & Default CORS Headers
// CORS handled per-request via getCors()

serve(async (req) => {
  const cors = getCors(req)
  const corsHeaders = cors.headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Verify user token
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json'} })
    }

    const { subject, topic, kc_ids, count = 10, source } = await req.json()

    // 1. Fetch relevant Knowledge Components (KCs) if not provided
    let target_kc_ids = kc_ids || []
    if (target_kc_ids.length === 0 && subject) {
      let query = supabaseClient.from('knowledge_components').select('id').eq('subject', subject)
      if (topic) query = query.eq('topic', topic)
      const { data: kcs } = await query.limit(50)
      if (kcs) target_kc_ids = kcs.map(kc => kc.id)
    }

    if (target_kc_ids.length === 0) {
      // Fallback: If no KCs mapped, just fetch random questions
      const { data: fallbackQuestions } = await supabaseClient
        .rpc('get_random_questions', {
          p_subject: subject,
          p_limit: count
        })
      return new Response(JSON.stringify({ questions: fallbackQuestions || [], mechanism: 'random_fallback' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Fetch Student's Mastery Profile for these KCs
    const { data: profiles } = await supabaseClient
      .from('student_cognitive_profiles')
      .select('kc_id, p_mastery')
      .eq('user_id', user.id)
      .in('kc_id', target_kc_ids)
    
    // Map of kc_id -> mastery (default to 0.1 if unseen)
    const masteryMap = new Map(target_kc_ids.map(id => [id, 0.1]))
    profiles?.forEach(p => masteryMap.set(p.kc_id, p.p_mastery))

    // Average mastery to approximate overall 'theta' (student ability)
    let sumMastery = 0;
    masteryMap.forEach(val => sumMastery += val)
    const avgMastery = sumMastery / masteryMap.size
    
    // IRT Theta conversion roughly from [0, 1] mastery to [-3, 3] standard normal
    // a mastery of 0.5 is theta 0, mastery 0.9 is theta 1.5, mastery 0.1 is theta -1.5
    const theta = (avgMastery - 0.5) * 4

    // 3. Fetch Candidate Questions
    const { data: candidates, error: candidateError } = await supabaseClient
      .from('question_bank')
      .select('*, knowledge_components(topic, subtopic)')
      .in('kc_id', target_kc_ids)
      .limit(100) // Fetch pool

    if (candidateError) throw candidateError

    const scoredQuestions = candidates?.map(q => {
      const b = q.irt_difficulty || 0        // standard normal
      const a = q.irt_discrimination || 1.0 // usually [0.5, 2.0]
      const c = q.irt_guessing || 0.25      // probability of guessing 

      // 3-Parameter Logistic (3PL) IRT Model
      // P(correct) = c + (1-c) / (1 + e^(-a * (theta - b)))
      const p_correct = c + (1 - c) / (1 + Math.exp(-a * (theta - b)))

      // We want to maximize Information. Information is highest when P(correct) is midway between c and 1
      // Target probability for "productive struggle" is usually around 0.6 - 0.8
      // We will score items by how close their p_correct is to the optimal target
      const target_p = c + (1 - c) / 2 // Information maximizing point
      
      // Calculate distance to target (smaller is better)
      const distance = Math.abs(p_correct - target_p)

      return {
        ...q,
        p_correct,
        distance
      }
    }) || []

    // 4. Sort by distance (closest to target probability = best for distinguishing ability)
    scoredQuestions.sort((a, b) => a.distance - b.distance)

    // 5. Select top `count`
    const selectedQuestions = scoredQuestions.slice(0, count)

    return new Response(JSON.stringify({ 
      questions: selectedQuestions,
      theta_estimate: theta,
      avg_mastery: avgMastery,
      mechanism: 'irt_adaptive'
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
