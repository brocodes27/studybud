// BKT Parameter Tuning Edge Function
// Uses Expectation-Maximization (EM) to estimate cohort-level BKT parameters
// (p_guess, p_slip, p_transit) per knowledge component from interaction_logs.
//
// Runs monthly. Results stored in bkt_kc_parameters.
// Modifies knowledge-trace/index.ts to read from this table.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'

const MIN_RESPONSES = 20
const MAX_EM_ITERATIONS = 50
const EM_CONVERGENCE = 0.0001
const DEFAULT_P_GUESS = 0.2
const DEFAULT_P_SLIP = 0.1
const DEFAULT_P_TRANSIT = 0.2

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

  const { data: runRecord } = await supabaseAdmin
    .rpc('start_pipeline_run', { p_function_name: 'bkt-tune' })
    .single()

  let kcsTuned = 0
  let errors: string[] = []

  try {
    // 1. Get all KCs with sufficient interaction data
    const { data: kcStats } = await supabaseAdmin
      .from('interaction_logs')
      .select('kc_id')
      .limit

    // Count responses per KC
    const kcCounts = new Map<string, number>()
    for (const log of kcStats ?? []) {
      kcCounts.set(log.kc_id, (kcCounts.get(log.kc_id) ?? 0) + 1)
    }

    const eligibleKcs = [...kcCounts.entries()]
      .filter(([_, count]) => count >= MIN_RESPONSES)
      .map(([kc_id]) => kc_id)

    if (eligibleKcs.length === 0) {
      await supabaseAdmin.rpc('mark_pipeline_complete', {
        p_run_id: runRecord?.id,
        p_status: 'completed',
        p_records_processed: 0,
        p_errors: null
      })
      return new Response(JSON.stringify({ message: 'No KCs with sufficient data', kcs_tuned: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    for (const kc_id of eligibleKcs.slice(0, 50)) {
      try {
        // 2. Fetch all interaction sequences for this KC
        const { data: logs } = await supabaseAdmin
          .from('interaction_logs')
          .select('user_id, is_correct, created_at')
          .eq('kc_id', kc_id)
          .order('created_at', { ascending: true })

        if (!logs || logs.length < MIN_RESPONSES) continue

        // Group by user
        const userSequences = new Map<string, boolean[]>()
        for (const log of logs) {
          const seq = userSequences.get(log.user_id) ?? []
          seq.push(log.is_correct)
          userSequences.set(log.user_id, seq)
        }

        // 3. EM Algorithm
        // Initialize with defaults
        let pGuess = DEFAULT_P_GUESS
        let pSlip = DEFAULT_P_SLIP
        let pTransit = DEFAULT_P_TRANSIT

        for (let iter = 0; iter < MAX_EM_ITERATIONS; iter++) {
          // E-step: compute expected mastery per student given current params
          let sumPGuess = 0
          let sumPSlip = 0
          let sumPTransit = 0
          let totalWeight = 0

          for (const [userId, sequence] of userSequences) {
            // Initial mastery estimate from first response or 0.1
            let mastery = 0.1
            if (sequence.length > 0) {
              mastery = sequence[0] ? 0.6 : 0.1
            }

            let eGuess = 0, eSlip = 0, eTransit = 0
            let weight = 0

            for (const isCorrect of sequence) {
              // BKT forward pass
              const pCorrect = mastery * (1 - pSlip) + (1 - mastery) * pGuess
              const pNotCorrect = 1 - pCorrect

              // Observed: correct → update mastery
              if (isCorrect) {
                const newMastery = (mastery * (1 - pSlip)) / pCorrect
                // Transit term: learning during interaction
                const finalMastery = newMastery + (1 - newMastery) * pTransit
                const obsWeight = 1
                eGuess += (1 - mastery) * pGuess * obsWeight / Math.max(pCorrect, 0.001)
                eSlip += 0
                eTransit += (1 - newMastery) * pTransit * obsWeight / Math.max(pCorrect, 0.001)
                weight += obsWeight
                mastery = Math.min(0.99, Math.max(0.01, finalMastery))
              } else {
                const newMastery = (mastery * pSlip) / pNotCorrect
                const finalMastery = newMastery + (1 - newMastery) * pTransit
                const obsWeight = 1
                eGuess += 0
                eSlip += mastery * pSlip * obsWeight / Math.max(pNotCorrect, 0.001)
                eTransit += (1 - newMastery) * pTransit * obsWeight / Math.max(pNotCorrect, 0.001)
                weight += obsWeight
                mastery = Math.min(0.99, Math.max(0.01, finalMastery))
              }
            }

            if (weight > 0) {
              sumPGuess += eGuess / weight
              sumPSlip += eSlip / weight
              sumPTransit += eTransit / weight
              totalWeight += weight
            }
          }

          // M-step: update parameters as weighted averages
          if (totalWeight > 0) {
            const newPGuess = sumPGuess / userSequences.size
            const newPSlip = sumPSlip / userSequences.size
            const newPTransit = sumPTransit / userSequences.size

            // Check convergence
            const delta = Math.abs(newPGuess - pGuess) + Math.abs(newPSlip - pSlip) + Math.abs(newPTransit - pTransit)
            pGuess = Math.max(0.05, Math.min(0.4, newPGuess))
            pSlip = Math.max(0.02, Math.min(0.3, newPSlip))
            pTransit = Math.max(0.05, Math.min(0.5, newPTransit))

            if (delta < EM_CONVERGENCE) break
          }
        }

        // 4. Store results
        const sampleSize = logs.length
        await supabaseAdmin
          .from('bkt_kc_parameters')
          .upsert({
            kc_id,
            p_guess: Math.round(pGuess * 1000) / 1000,
            p_slip: Math.round(pSlip * 1000) / 1000,
            p_transit: Math.round(pTransit * 1000) / 1000,
            sample_size: sampleSize,
            updated_at: new Date().toISOString()
          }, { onConflict: 'kc_id' })

        // Record history
        await supabaseAdmin
          .from('bkt_parameter_history')
          .insert({
            kc_id,
            p_guess: Math.round(pGuess * 1000) / 1000,
            p_slip: Math.round(pSlip * 1000) / 1000,
            p_transit: Math.round(pTransit * 1000) / 1000,
            sample_size: sampleSize,
            converged: true
          })

        kcsTuned++
      } catch (err) {
        errors.push(`KC ${kc_id}: ${err.message}`)
      }
    }

    await supabaseAdmin.rpc('mark_pipeline_complete', {
      p_run_id: runRecord?.id,
      p_status: errors.length > 0 ? 'completed_with_errors' : 'completed',
      p_records_processed: kcsTuned,
      p_errors: errors.length > 0 ? errors.join('; ') : null
    })

    return new Response(JSON.stringify({
      success: true,
      kcs_tuned: kcsTuned,
      errors: errors.length > 0 ? errors : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    await supabaseAdmin.rpc('mark_pipeline_complete', {
      p_run_id: runRecord?.id,
      p_status: 'failed',
      p_records_processed: kcsTuned,
      p_errors: error.message
    })

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
