import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'

serve(async (req: Request) => {
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const path = url.pathname.split('/').pop()

    // GET /student-twin — fetch latest twin for current user
    if (req.method === 'GET') {
      const authHeader = req.headers.get('Authorization') ?? ''
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authErr } = await supabaseClient.auth.getUser(token)
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const targetUserId = url.searchParams.get('user_id') || user.id

      // If teacher, verify they can view this student
      if (targetUserId !== user.id) {
        const { data: isTeacher } = await supabaseClient
          .from('classes')
          .select('id')
          .eq('teacher_id', user.id)
          .limit(1)
          .single()
        if (!isTeacher) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }

      // Fetch latest snapshot
      const { data: snapshot, error: snapErr } = await supabaseClient
        .from('student_twin_snapshots')
        .select('*')
        .eq('user_id', targetUserId)
        .order('snapshot_version', { ascending: false })
        .limit(1)
        .single()

      if (snapErr && snapErr.code !== 'PGRST116') throw snapErr

      // Fetch latest weekly summary
      const { data: summary, error: sumErr } = await supabaseClient
        .from('student_twin_summaries')
        .select('*')
        .eq('user_id', targetUserId)
        .order('week_start', { ascending: false })
        .limit(1)
        .single()

      if (sumErr && sumErr.code !== 'PGRST116') throw sumErr

      return new Response(JSON.stringify({
        user_id: targetUserId,
        snapshot,
        summary,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // POST /student-twin — refresh twin for current user or all
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const authHeader = req.headers.get('Authorization') ?? ''
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authErr } = await supabaseClient.auth.getUser(token)
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Admin or cron: refresh all
      if (body.scope === 'all') {
        const { data, error } = await supabaseClient.rpc('refresh_all_student_twins')
        if (error) throw error
        return new Response(JSON.stringify({
          success: true,
          scope: 'all',
          refreshed: data?.length ?? 0,
          timestamp: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      // Refresh single user
      const targetUserId = body.user_id || user.id
      const { data, error } = await supabaseClient.rpc('refresh_student_twin_full', {
        p_user_id: targetUserId
      })
      if (error) throw error

      return new Response(JSON.stringify({
        success: true,
        user_id: targetUserId,
        result: data,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
