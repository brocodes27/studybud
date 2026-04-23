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

    const { roadmap_id, session_date, subject, topics_covered, subtopics = [], notes = '', homework_assigned = '', dpp_reference = '', source = 'manual' } = await req.json()

    if (!roadmap_id || !session_date || !subject || !topics_covered || !topics_covered.length) {
       return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: session, error: sessionErr } = await supabaseClient
      .from('class_sessions')
      .insert({
        user_id: user.id,
        roadmap_id,
        session_date,
        subject,
        topics_covered,
        subtopics,
        notes,
        homework_assigned,
        dpp_reference,
        source
      })
      .select()
      .single()

    if (sessionErr) {
       console.error("Session error:", sessionErr)
       return new Response(JSON.stringify({ error: 'Failed to log session', details: sessionErr }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // TODO: Phase 2 - Add validation against template and trigger prescription regen if drift occurs
    // Example: Evaluate if topics_covered are way off the current_week schedule

    return new Response(JSON.stringify({ success: true, session }), {
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
