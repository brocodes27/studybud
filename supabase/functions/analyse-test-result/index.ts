import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callGeminiJSON, GeminiMessage } from '../_shared/gemini.ts'
import { getCors } from '../_shared/cors.ts'

serve(async (req: Request) => {
  const cors = getCors(req);
  const corsHeaders = cors.headers;
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

    const { roadmap_id, test_name, base64_image, manual_weaknesses, score_obtained, score_total, attempts } = await req.json()

    let weak_topics = manual_weaknesses || []

    // ── Legacy: If we have an image, ask Gemini to parse it for mistakes ──
    if (base64_image && (!manual_weaknesses || manual_weaknesses.length === 0)) {
      const messages: GeminiMessage[] = [
        {
          role: "system",
          content: "You are Ranjan Sir, a warm and encouraging JEE mentor evaluating an answer sheet. Identify specific weak topics based on the incorrect answers shown with kindness and constructive framing. Respond in JSON with an array of objects: { \"weak_topics\": [{\"topic\": \"Friction on incline\", \"subject\": \"Physics\", \"severity\": \"high|medium|low\"}] }"
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Analyze this marked test paper for the test: ${test_name}.` },
            { type: "image", dataUrl: base64_image }
          ]
        }
      ]
      const parsed = await callGeminiJSON<any>(messages, { temperature: 0.2 })
      weak_topics = parsed.weak_topics
    }

    // ── Insert test result ──
    const resultRecord = {
      user_id: user.id,
      roadmap_id,
      test_name: test_name || 'Mock Assessment',
      test_date: new Date().toISOString(),
      score_obtained: score_obtained || 0,
      score_total: score_total || 100,
      weak_topics: weak_topics,
      status: 'analyzed'
    }

    const { data: testResult, error: insertError } = await supabaseClient
      .from('test_results')
      .insert(resultRecord)
      .select()
      .single()

    if (insertError && !insertError.message.includes('relation "test_results" does not exist')) {
        throw insertError
    }

    const resultId = testResult?.id || crypto.randomUUID();

    // ── NEW: Per-question telemetry ──
    let classified = null;
    if (attempts && Array.isArray(attempts) && attempts.length > 0) {
      try {
        const { data: clsRes } = await supabaseClient.functions.invoke('classify-test-error', {
          body: { test_result_id: resultId, attempts }
        });
        if (clsRes?.success) {
          classified = clsRes.classified;
          // Override weak_topics with deterministic classification output if available
          if (clsRes.weak_topics && clsRes.weak_topics.length > 0) {
            weak_topics = clsRes.weak_topics;
            // Also update the test_results row with enriched weak_topics
            await supabaseClient.from('test_results').update({ weak_topics }).eq('id', resultId);
          }
        }
      } catch (e) {
        console.warn('classify-test-error invocation failed, continuing with legacy weak_topics:', e);
      }
    }

    // ── Invoke generate-correction-sprint (now deterministic, reads from test_attempt_questions) ──
    let sprint = null
    const { data: sprintRes, error: sprintErr } = await supabaseClient.functions.invoke('generate-correction-sprint', {
      body: {
        test_result_id: resultId,
        roadmap_id,
        weak_topics
      }
    })

    if (sprintRes && !sprintErr) {
        sprint = sprintRes.sprint
    }

    return new Response(JSON.stringify({ success: true, testResult, sprint, classified_attempts: classified }), {
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
