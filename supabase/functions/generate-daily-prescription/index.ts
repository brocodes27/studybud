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

    // 5. Weak areas (subject mastery)
    const { data: weakAreas } = await supabaseClient
      .from('user_subject_mastery')
      .select('domain, subdomain, mastery_score, questions_attempted, questions_correct')
      .eq('user_id', user.id)
      .order('mastery_score', { ascending: true })
      .limit(5)

    // 6. Recent mistakes from task outputs (last 14 days)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentOutputs } = await supabaseClient
      .from('task_outputs')
      .select('output_type, text_content, ai_analysis, created_at')
      .eq('user_id', user.id)
      .gte('created_at', fourteenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(5)

    // Package context for AI Gen
    const contextSnapshot = {
      roadmap_week: roadmap.current_week,
      today_sessions: sessions || [],
      next_test: nextTest ? {
        name: nextTest.test_name,
        date: nextTest.test_date,
        duration: nextTest.duration_minutes,
        syllabus: nextTest.syllabus || null,
        days_until: Math.ceil((new Date(nextTest.test_date).getTime() - new Date(prescriptionDate).getTime()) / (1000 * 3600 * 24))
      } : null,
      behavioral_profile: profile || { preferred_time: 'evening', typical_session_duration_min: 90, weak_subjects: [] },
      weak_areas: (weakAreas || []).map((w: any) => ({
        domain: w.domain,
        subdomain: w.subdomain,
        mastery_score: w.mastery_score,
        accuracy: w.questions_attempted > 0 ? Math.round((w.questions_correct / w.questions_attempted) * 100) : 0,
      })),
      recent_mistake_patterns: (recentOutputs || []).map((o: any) => ({
        type: o.output_type,
        date: o.created_at,
        ai_feedback: o.ai_analysis?.summary || o.ai_analysis?.weak_spots || null,
      })).filter((o: any) => o.ai_feedback),
    }

    // ── Phase 1: Deterministic Plan ──
    const { data: planRes, error: planErr } = await supabaseClient.functions.invoke('plan-daily-mission', {
      body: { roadmap_id, target_date: prescriptionDate, user_context: contextSnapshot }
    });
    if (planErr || !planRes?.success || !planRes?.plan) throw new Error(`plan-daily-mission failed: ${planErr?.message || 'empty response'}`);
    const plan = planRes.plan;

    // ── Phase 2: Voice Layer (Ranjan Sir copy) ──
    let voiceScript: string | null = null;
    try {
      const { data: voiceRes } = await supabaseClient.functions.invoke('voice-daily-mission', {
        body: { plan, user_name: profile?.nickname || 'Student' }
      });
      voiceScript = voiceRes?.voice_script || null;
    } catch (e) {
      console.warn('voice-daily-mission failed, continuing without voice script:', e);
    }

    const { data: prescription, error: presErr } = await supabaseClient
      .from('daily_prescriptions')
      .upsert({
        user_id: user.id,
        roadmap_id,
        prescription_date: prescriptionDate,
        context_snapshot: { ...contextSnapshot, generated_by: 'deterministic+voice_v1' },
        tasks: plan.tasks,
        implementation_intentions: plan.implementation_intentions,
        total_estimated_minutes: plan.total_estimated_minutes,
        status: 'active',
        generated_by: 'deterministic+voice_v1',
        prescription_source: {
          engine: 'plan-daily-mission',
          voice_layer: voiceScript ? 'voice-daily-mission' : null,
          llm_fallback: false,
          generated_at: new Date().toISOString(),
        }
      }, { onConflict: 'user_id,prescription_date' })
      .select()
      .single()

    if (presErr) throw presErr

    return new Response(JSON.stringify({ success: true, prescription, voice_script: voiceScript }), {
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
