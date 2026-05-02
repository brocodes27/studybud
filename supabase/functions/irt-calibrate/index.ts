// IRT Calibration Edge Function
// Calibrates irt_difficulty (b) and irt_discrimination (a) for questions
// using Newton-Raphson Marginal Maximum Likelihood Estimation (MMLE)
// on student interaction logs.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'

const MIN_RESPONSES = 30
const MAX_ITERATIONS = 30
const CONVERGENCE_THRESHOLD = 0.001
const DEFAULT_DISCRIMINATION = 1.0
const DEFAULT_DIFFICULTY = 0.0
const DEFAULT_GUESSING = 0.25

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

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Start pipeline run tracking
  const { data: runRecord } = await supabaseAdmin
    .rpc('start_pipeline_run', { p_function_name: 'irt-calibrate' })
    .single()

  let recordsProcessed = 0
  let questionsCalibrated = 0
  let errors: string[] = []

  try {
    // 1. Select questions with sufficient interaction history
    const { data: questions } = await supabaseAdmin
      .from('questions')
      .select('id, kc_id, irt_difficulty, irt_discrimination')
      .not('kc_id', 'is', null)
      .limit(50)

    if (!questions || questions.length === 0) {
      await supabaseAdmin.rpc('mark_pipeline_complete', {
        p_run_id: runRecord?.id,
        p_status: 'completed',
        p_records_processed: 0,
        p_errors: null
      })
      return new Response(JSON.stringify({ message: 'No questions to calibrate', calibrated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    for (const question of questions) {
      try {
        // 2. Fetch interaction logs for this question
        const { data: responses } = await supabaseAdmin
          .from('interaction_logs')
          .select('user_id, is_correct, difficulty_presented')
          .eq('kc_id', question.kc_id)
          .order('created_at', { ascending: false })
          .limit(200)

        if (!responses || responses.length < MIN_RESPONSES) continue

        // 3. Estimate student thetas from their mastery profiles
        const userIds = [...new Set(responses.map(r => r.user_id))]
        const { data: profiles } = await supabaseAdmin
          .from('student_cognitive_profiles')
          .select('user_id, p_mastery')
          .in('user_id', userIds)
          .eq('kc_id', question.kc_id)

        const masteryMap = new Map(
          (profiles ?? []).map(p => [p.user_id, p.p_mastery])
        )

        // Build response vector with estimated theta per student
        const dataPoints = responses
          .map(r => {
            const mastery = masteryMap.get(r.user_id) ?? 0.3
            const theta = (mastery - 0.5) * 4 // map [0,1] → [-2, 2]
            return { is_correct: r.is_correct, theta }
          })

        // 4. Newton-Raphson to find optimal (a, b)
        // Starting from current DB values or defaults
        let a = question.irt_discrimination ?? DEFAULT_DISCRIMINATION
        let b = question.irt_difficulty ?? DEFAULT_DIFFICULTY
        const c = DEFAULT_GUESSING

        let converged = false
        let iterationCount = 0
        let logLikelihood = 0

        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
          iterationCount++
          let ll = 0
          let da_ll = 0, db_ll = 0 // first derivatives
          let da2_ll = 0, db2_ll = 0, dab_ll = 0 // second derivatives (Hessian)

          for (const dp of dataPoints) {
            const { is_correct, theta } = dp
            const eta = a * (theta - b)
            const expEta = Math.exp(-Math.abs(eta)) // stable
            const p = c + (1 - c) / (1 + expEta)

            // Clamp to avoid log(0)
            const pClamped = Math.max(0.001, Math.min(0.999, p))
            ll += is_correct ? Math.log(pClamped) : Math.log(1 - pClamped)

            // First derivatives
            const pSubC = p - c
            const oneCP = 1 - p
            const etaSign = eta >= 0 ? 1 : -1
            const expEtaPos = Math.exp(-Math.abs(eta))

            const common = (1 - c) * expEtaPos / Math.pow(1 + expEtaPos, 2)
            da_ll += is_correct
              ? ((theta - b) * common / pSubC)
              : (-(theta - b) * common / oneCP)
            db_ll += is_correct
              ? (-a * common / pSubC)
              : (a * common / oneCP)

            // Second derivatives (Hessian diagonal and off-diagonal)
            const pSq = pSubC * pSubC
            const onePSq = oneCP * oneCP
            const exp2 = Math.pow(1 + expEtaPos, 2)
            const exp3 = Math.pow(1 + expEtaPos, 3)

            const hCommon = Math.pow(1 - c, 2) * expEtaPos / exp3
            da2_ll += is_correct
              ? (-Math.pow(theta - b, 2) * hCommon / pSq)
              : (-Math.pow(theta - b, 2) * hCommon / onePSq)
            db2_ll += is_correct
              ? (-a * a * hCommon / pSq)
              : (-a * a * hCommon / onePSq)
            dab_ll += is_correct
              ? (2 * a * (theta - b) * hCommon / pSq)
              : (2 * a * (theta - b) * hCommon / onePSq)
          }

          logLikelihood = ll

          // Newton-Raphson update
          // Solve H * delta = -grad using 2x2 matrix inverse
          const det = da2_ll * db2_ll - dab_ll * dab_ll
          if (Math.abs(det) < 1e-10) break // Singular Hessian

          const delta_a = (-da_ll * db2_ll + dab_ll * db_ll) / det
          const delta_b = (-dab_ll * da_ll + da2_ll * db_ll) / det

          a += delta_a
          b += delta_b

          // Constrain parameters to reasonable ranges
          a = Math.max(0.1, Math.min(3.0, a))
          b = Math.max(-4.0, Math.min(4.0, b))

          // Check convergence
          const stepSize = Math.sqrt(delta_a * delta_a + delta_b * delta_b)
          if (stepSize < CONVERGENCE_THRESHOLD) {
            converged = true
            break
          }
        }

        // 5. If converged, update question_bank and record history
        if (converged && a > 0.1) {
          const { error: updateError } = await supabaseAdmin
            .from('questions')
            .update({
              irt_difficulty: Math.round(b * 1000) / 1000,
              irt_discrimination: Math.round(a * 1000) / 1000,
              irt_guessing: DEFAULT_GUESSING,
            })
            .eq('id', question.id)

          if (!updateError) {
            // Record calibration history
            await supabaseAdmin
              .from('irt_item_parameters_history')
              .insert({
                question_id: question.id,
                irt_difficulty: Math.round(b * 1000) / 1000,
                irt_discrimination: Math.round(a * 1000) / 1000,
                irt_guessing: DEFAULT_GUESSING,
                sample_size: dataPoints.length,
                log_likelihood: Math.round(logLikelihood * 100) / 100,
                converged: true,
                iteration_count: iterationCount,
              })

            questionsCalibrated++
          }
        }

        recordsProcessed++
      } catch (err) {
        errors.push(`Question ${question.id}: ${err.message}`)
      }
    }

    // 6. Mark pipeline complete
    await supabaseAdmin.rpc('mark_pipeline_complete', {
      p_run_id: runRecord?.id,
      p_status: errors.length > 0 ? 'completed_with_errors' : 'completed',
      p_records_processed: recordsProcessed,
      p_errors: errors.length > 0 ? errors.join('; ') : null
    })

    return new Response(JSON.stringify({
      success: true,
      questions_calibrated: questionsCalibrated,
      records_processed: recordsProcessed,
      errors: errors.length > 0 ? errors : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    await supabaseAdmin.rpc('mark_pipeline_complete', {
      p_run_id: runRecord?.id,
      p_status: 'failed',
      p_records_processed: recordsProcessed,
      p_errors: error.message
    })

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
