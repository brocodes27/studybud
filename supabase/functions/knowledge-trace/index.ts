import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'

// Configuration & Default CORS Headers
// CORS handled per-request via getCors()

serve(async (req) => {
  // Handle CORS preflight
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Used Service Role to allow updating profiles securely
    )

    // Verify user token
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json'} })
    }

    const { kc_id, is_correct, response_time_ms, difficulty_presented, source, emotional_state_detected, metadata } = await req.json()

    if (!kc_id || typeof is_correct !== 'boolean') {
      return new Response(JSON.stringify({ error: 'Missing required parameters: kc_id or is_correct.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json'} })
    }

    // 1. Fetch current cognitive profile + tuned BKT params
    const { data: profile, error: selectError } = await supabaseClient
      .from('student_cognitive_profiles')
      .select('*')
      .eq('user_id', user.id)
      .eq('kc_id', kc_id)
      .maybeSingle()

    if (selectError) throw selectError

    // Fetch cohort-tuned BKT params from bkt_kc_parameters
    let tunedParams: { p_guess: number; p_slip: number; p_transit: number } | null = null
    try {
      const { data: params } = await supabaseClient
        .rpc('get_bkt_params', { p_kc_id: kc_id })
        .single()
      if (params) tunedParams = params
    } catch {
      // Fallback to defaults if RPC fails (table not yet populated)
    }

    let currentMastery = 0.1
    let p_guess = tunedParams?.p_guess ?? 0.2
    let p_slip = tunedParams?.p_slip ?? 0.1
    let p_transit = tunedParams?.p_transit ?? 0.2
    let interaction_count = 0
    let cognitive_tier = 'anoetic'

    if (profile) {
      currentMastery = profile.p_mastery
      // Only override from profile if not already set from tuned params
      p_guess = profile.p_guess > 0 && profile.p_guess < 0.5 ? profile.p_guess : p_guess
      p_slip = profile.p_slip > 0 && profile.p_slip < 0.5 ? profile.p_slip : p_slip
      p_transit = profile.p_transit > 0 && profile.p_transit < 0.5 ? profile.p_transit : p_transit
      interaction_count = profile.interaction_count
      cognitive_tier = profile.cognitive_tier
    }

    // 2. Bayesian Knowledge Tracing Update Formula
    // P(obs = correct) = P(mastery)*P(not slip) + P(not mastery)*P(guess)
    const p_correct = (currentMastery * (1 - p_slip)) + ((1 - currentMastery) * p_guess)
    
    let posterior_mastery = 0;
    if (is_correct) {
      // P(mastery | correct) = (P(mastery)*P(not slip)) / P(obs = correct)
      posterior_mastery = (currentMastery * (1 - p_slip)) / p_correct
    } else {
      // P(mastery | incorrect) = (P(mastery)*P(slip)) / (1 - P(obs = correct))
      posterior_mastery = (currentMastery * p_slip) / (1 - p_correct)
    }

    // Add transit (probability of learning the skill during the step)
    // P(new_mastery) = P(mastery|obs) + (1 - P(mastery|obs))*P(transit)
    let new_mastery = posterior_mastery + (1 - posterior_mastery) * p_transit
    
    // Clamp values
    if(new_mastery > 0.99) new_mastery = 0.99;
    if(new_mastery < 0.01) new_mastery = 0.01;

    // Determine Cognitive Tier roughly
    let new_cognitive_tier = 'anoetic'
    if (new_mastery > 0.85 && interaction_count > 5) {
      new_cognitive_tier = 'autonoetic'
    } else if (new_mastery > 0.5) {
      new_cognitive_tier = 'noetic'
    }

    // 3. Update or Insert
    const { error: upsertError } = await supabaseClient
      .from('student_cognitive_profiles')
      .upsert({
        user_id: user.id,
        kc_id: kc_id,
        p_mastery: new_mastery,
        p_guess: p_guess,
        p_slip: p_slip,
        p_transit: p_transit,
        interaction_count: interaction_count + 1,
        last_correct: is_correct,
        last_interaction_at: new Date().toISOString(),
        cognitive_tier: new_cognitive_tier,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, kc_id' })
    
    if (upsertError) throw upsertError

    // 4. Log Interaction
    const { error: logError } = await supabaseClient
      .from('interaction_logs')
      .insert({
        user_id: user.id,
        kc_id: kc_id,
        is_correct,
        response_time_ms,
        difficulty_presented,
        emotional_state_detected,
        source,
        metadata
      })

    if (logError) throw logError

    return new Response(JSON.stringify({ 
      success: true, 
      previous_mastery: currentMastery,
      new_mastery: new_mastery,
      mastery_delta: new_mastery - currentMastery,
      cognitive_tier: new_cognitive_tier,
      is_correct
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
