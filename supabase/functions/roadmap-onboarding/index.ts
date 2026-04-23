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

    const { template_id, institute_name, batch_name, year_level, current_week, custom_overrides = {} } = await req.json()

    let testCalendar = []
    if (template_id) {
       const { data: template, error: tmplErr } = await supabaseClient
         .from('coaching_templates')
         .select('*')
         .eq('id', template_id)
         .single()
         
       if (tmplErr || !template) {
         return new Response(JSON.stringify({ error: 'Template not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
       }
       testCalendar = template.test_calendar || []
    }

    const { data: roadmap, error: roadmapErr } = await supabaseClient
      .from('student_roadmaps')
      .insert({
        user_id: user.id,
        template_id: template_id || null,
        institute_name: institute_name || 'Self Study',
        batch_name: batch_name || 'Standard',
        program: 'JEE',
        year_level: year_level,
        start_date: new Date().toISOString().split('T')[0],
        current_week: current_week || 1,
        custom_overrides: custom_overrides,
        is_active: true
      })
      .select()
      .single()

    if (roadmapErr) {
       console.error("Roadmap error:", roadmapErr)
       return new Response(JSON.stringify({ error: 'Failed to create roadmap', details: roadmapErr }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (testCalendar.length > 0) {
      const testsToInsert = testCalendar
        .filter((t: any) => t.week >= current_week)
        .map((t: any) => {
          const weeksAway = t.week - current_week
          const testDate = new Date()
          testDate.setDate(testDate.getDate() + (weeksAway * 7))
          return {
            user_id: user.id,
            roadmap_id: roadmap.id,
            test_name: t.name,
            test_date: testDate.toISOString().split('T')[0],
            test_type: t.type || 'phase_test',
            syllabus: t.syllabus,
            duration_minutes: t.duration_minutes || 180,
            total_marks: t.total_marks || 300,
            status: 'upcoming'
          }
        })

      if (testsToInsert.length > 0) {
        const { error: testErr } = await supabaseClient.from('upcoming_tests').insert(testsToInsert)
        if (testErr) console.error("Warning: failed to insert tests", testErr)
      }
    }

    return new Response(JSON.stringify({ success: true, roadmap }), {
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
