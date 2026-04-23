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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all active roadmap users
    const { data: roadmaps, error: roadmapErr } = await supabaseClient
      .from('student_roadmaps')
      .select('user_id')
      .eq('is_active', true)

    if (roadmapErr) throw roadmapErr

    const userIds = [...new Set((roadmaps || []).map((r: any) => r.user_id))]
    let refreshed = 0

    for (const userId of userIds) {
      const { error } = await supabaseClient.rpc('refresh_behavioral_profile', {
        p_user_id: userId
      })
      if (!error) refreshed++
    }

    return new Response(JSON.stringify({
      success: true,
      refreshed,
      total: userIds.length,
      timestamp: new Date().toISOString()
    }), {
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
