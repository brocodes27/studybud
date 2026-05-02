// Agent Corrections Analysis Edge Function
// Daily cron: aggregates agent_corrections, detects patterns,
// generates prompt template updates for high-confidence patterns.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callGemini, GeminiMessage } from '../_shared/gemini.ts'
import { getCors } from '../_shared/cors.ts'

const MIN_CORRECTION_FREQUENCY = 3
const CONFIDENCE_THRESHOLD = 0.6
const SESSION_WINDOW_HOURS = 72

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
    .rpc('start_pipeline_run', { p_function_name: 'agent-analyze-corrections' })
    .single()

  let correctionsAnalyzed = 0
  let templatesUpdated = 0
  let errors: string[] = []

  try {
    // 1. Fetch recent corrections (last 72 hours to catch session-level patterns)
    const cutoffTime = new Date(Date.now() - SESSION_WINDOW_HOURS * 60 * 60 * 1000)
    const { data: corrections } = await supabaseAdmin
      .from('agent_corrections')
      .select('id, agent_responsible, root_cause_analysis, correction, created_at, user_id')
      .gte('created_at', cutoffTime.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)

    if (!corrections || corrections.length === 0) {
      await supabaseAdmin.rpc('mark_pipeline_complete', {
        p_run_id: runRecord?.id,
        p_status: 'completed',
        p_records_processed: 0,
        p_errors: null
      })
      return new Response(JSON.stringify({ message: 'No corrections to analyze', analyzed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    correctionsAnalyzed = corrections.length

    // 2. Group by agent_responsible and root_cause_category
    const agentGroups = new Map<string, typeof corrections>()
    for (const c of corrections) {
      const key = c.agent_responsible ?? 'unknown'
      const group = agentGroups.get(key) ?? []
      group.push(c)
      agentGroups.set(key, group)
    }

    for (const [agent, group] of agentGroups) {
      // 3. Cluster corrections by root_cause_analysis
      const categoryGroups = new Map<string, typeof corrections>()
      for (const c of group) {
        const cat = c.root_cause_analysis ?? 'uncategorized'
        const existing = categoryGroups.get(cat) ?? []
        existing.push(c)
        categoryGroups.set(cat, existing)
      }

      for (const [category, cats] of categoryGroups) {
        if (cats.length < MIN_CORRECTION_FREQUENCY) continue

        // 4. Get or create correction analysis record
        const existing = await supabaseAdmin
          .from('agent_correction_analysis')
          .select('id, frequency, confidence')
          .eq('agent_responsible', agent)
          .eq('root_cause_category', category)
          .order('analyzed_at', { ascending: false })
          .limit(1)
          .single()

        const newFrequency = cats.length
        const confidence = Math.min(0.95, newFrequency / 20) // confidence grows with frequency, max 0.95

        if (existing) {
          await supabaseAdmin
            .from('agent_correction_analysis')
            .update({
              frequency: newFrequency,
              last_seen_at: new Date().toISOString(),
              confidence: Math.max(existing.data?.confidence ?? 0, confidence)
            })
            .eq('id', existing.data?.id)
        } else {
          await supabaseAdmin
            .from('agent_correction_analysis')
            .insert({
              agent_responsible: agent,
              root_cause_category: category,
              frequency: newFrequency,
              affected_sessions: new Set(cats.map(c => c.user_id)).size,
              confidence
            })
        }

        // 5. For high-confidence patterns, generate template delta via Gemini
        if (confidence >= CONFIDENCE_THRESHOLD) {
          const sampleCorrections = cats.slice(0, 5)

          const messages: GeminiMessage[] = [{
            role: 'user',
            content: `Analyze these agent corrections and generate a prompt template delta.

Agent: ${agent}
Root cause: ${category}

Corrections:
${sampleCorrections.map((c, i) => `${i + 1}. Original: "${c.original_response?.slice(0, 200)}" → Correction: "${c.correction?.slice(0, 200)}"`).join('\n')}

Generate a JSON object with:
- "suggested_template_delta": a specific instruction to add to the system prompt that would prevent this type of error
- "template_delta_confidence": 0.0-1.0 based on how confident you are this delta would help
- "affected_prompt_section": which section of the system prompt this would go in (e.g., "response_format", "reasoning_style", "content_guardrails")

Respond only with valid JSON.`
          }]

          try {
            const response = await callGemini(messages, { json: true })
            const parsed = JSON.parse(response)

            if (parsed.suggested_template_delta) {
              // Update analysis with suggested delta
              const analysisRecord = await supabaseAdmin
                .from('agent_correction_analysis')
                .select('id')
                .eq('agent_responsible', agent)
                .eq('root_cause_category', category)
                .order('analyzed_at', { ascending: false })
                .limit(1)
                .single()

              if (analysisRecord.data?.id) {
                await supabaseAdmin
                  .from('agent_correction_analysis')
                  .update({ suggested_template_delta: parsed.suggested_template_delta })
                  .eq('id', analysisRecord.data.id)
              }

              // 6. Auto-create new prompt template version if very high confidence
              if (parsed.template_delta_confidence >= 0.8) {
                // Get current active template for this agent
                const { data: currentTemplate } = await supabaseAdmin
                  .from('agent_prompt_templates')
                  .select('*')
                  .eq('agent_responsible', agent)
                  .eq('is_active', true)
                  .limit(1)
                  .single()

                if (currentTemplate) {
                  const newVersion = (currentTemplate.data?.version ?? 0) + 1
                  const updatedText = (currentTemplate.data?.template_text ?? '') +
                    '\n\n' + parsed.suggested_template_delta

                  await supabaseAdmin
                    .from('agent_prompt_templates')
                    .upsert({
                      agent_responsible: agent,
                      version: newVersion,
                      template_text: updatedText,
                      template_hash: hashString(updatedText),
                      correction_count: newFrequency,
                      is_active: false // review before activating
                    })

                  templatesUpdated++
                }
              }
            }
          } catch (geminiErr) {
            errors.push(`Gemini analysis failed for ${agent}/${category}: ${geminiErr.message}`)
          }
        }
      }
    }

    await supabaseAdmin.rpc('mark_pipeline_complete', {
      p_run_id: runRecord?.id,
      p_status: errors.length > 0 ? 'completed_with_errors' : 'completed',
      p_records_processed: correctionsAnalyzed,
      p_errors: errors.length > 0 ? errors.join('; ') : null
    })

    return new Response(JSON.stringify({
      success: true,
      corrections_analyzed: correctionsAnalyzed,
      templates_proposed: templatesUpdated,
      errors: errors.length > 0 ? errors : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    await supabaseAdmin.rpc('mark_pipeline_complete', {
      p_run_id: runRecord?.id,
      p_status: 'failed',
      p_records_processed: correctionsAnalyzed,
      p_errors: error.message
    })

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(16)
}
