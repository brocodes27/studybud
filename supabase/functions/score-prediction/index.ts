import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'

const JEE_TOPICS = [
  'Mechanics', 'Electrostatics', 'Current Electricity', 'Modern Physics',
  'Organic Chemistry', 'Physical Chemistry', 'Inorganic Chemistry',
  'Calculus', 'Coordinate Geometry', 'Algebra', 'Vectors', 'Probability',
]

const SUBJECT_WEIGHTS: Record<string, number> = {
  physics: 100, chemistry: 100, mathematics: 100,
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function topicSubject(topic: string) {
  const lower = topic.toLowerCase()
  if (lower.includes('chem')) return 'chemistry'
  if (lower.includes('calculus') || lower.includes('geometry') || lower.includes('algebra') || lower.includes('vector') || lower.includes('probability')) return 'mathematics'
  return 'physics'
}

function percentileBand(score: number) {
  if (score >= 260) return '99.7+'
  if (score >= 220) return '99+'
  if (score >= 180) return '97-99'
  if (score >= 140) return '94-97'
  if (score >= 100) return '90-94'
  return '<90'
}

serve(async (req) => {
  const cors = getCors(req)
  const corsHeaders = cors.headers
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const body = await req.json().catch(() => ({}))
    const targetScore = Number(body?.target_score || 180)
    const exam = String(body?.exam || 'jee_main')

    const { data: profiles, error: profileError } = await supabaseClient
      .from('student_cognitive_profiles')
      .select('kc_id, p_mastery, interaction_count, cognitive_tier')
      .eq('user_id', user.id)
    if (profileError) throw profileError

    const profileByTopic = new Map<string, any>()
    for (const profile of profiles || []) {
      profileByTopic.set(String(profile.kc_id).toLowerCase(), profile)
    }

    const topicPredictions = JEE_TOPICS.map((topic) => {
      const directProfile = profileByTopic.get(topic.toLowerCase())
      const fuzzyProfile = directProfile || Array.from(profileByTopic.entries()).find(([key]) => key.includes(topic.toLowerCase()) || topic.toLowerCase().includes(key))?.[1]
      const mastery = clamp(Number(fuzzyProfile?.p_mastery ?? 0.18), 0.01, 0.99)
      const subject = topicSubject(topic)
      return {
        topic,
        subject,
        mastery,
        points_unlocked: Math.round((SUBJECT_WEIGHTS[subject] / 4) * mastery),
        interaction_count: Number(fuzzyProfile?.interaction_count ?? 0),
        cognitive_tier: fuzzyProfile?.cognitive_tier || 'anoetic',
      }
    })

    // Build feature vector for trained model
    const avgMastery = profiles?.length
      ? profiles.reduce((s, p) => s + (p.p_mastery ?? 0), 0) / profiles.length : 0.1
    const totalInteractions = profiles?.reduce((s, p) => s + (p.interaction_count ?? 0), 0) ?? 0
    const tierEncoding: Record<string, number> = { anoetic: 0, noetic: 1, autonoetic: 2 }
    const avgTier = profiles?.length
      ? profiles.reduce((s, p) => s + (tierEncoding[p.cognitive_tier as keyof typeof tierEncoding] ?? 0), 0) / profiles.length : 0

    let estimatedScore = 0
    let modelVersion = 0
    let scoreMechanism = 'rule_formula'
    let subjectScores: any[] = []

    // Try trained model first
    try {
      const latestVersion: number = (await supabaseClient.rpc('get_latest_score_model_version') as any) ?? 0
      if (latestVersion > 0) {
        const { data: coefs } = await supabaseClient.rpc('get_score_model_coefficients', { p_version: null })
        if (coefs && coefs.length > 0) {
          modelVersion = latestVersion
          scoreMechanism = 'trained_model'

          const { data: behavioral } = await supabaseClient
            .from('student_behavioral_profiles')
            .select('missed_days_streak, backlog_count, streak_days')
            .eq('user_id', user.id)
            .single()

          const features: Record<string, number> = {
            avg_mastery: avgMastery,
            total_interactions: totalInteractions,
            missed_days_streak: behavioral?.missed_days_streak ?? 0,
            backlog_count: behavioral?.backlog_count ?? 0,
            streak_days: behavioral?.streak_days ?? 0,
            cognitive_tier_avg: avgTier,
          }

          const subjectCoefs: Record<string, { features: Record<string, number>; intercept: number }> = {}
          for (const coef of coefs) {
            if (!subjectCoefs[coef.subject]) subjectCoefs[coef.subject] = { features: {}, intercept: 0 }
            subjectCoefs[coef.subject].features[coef.feature_name] = coef.coefficient
            subjectCoefs[coef.subject].intercept = coef.band_intercept
          }

          subjectScores = Object.keys(SUBJECT_WEIGHTS).map((subject) => {
            const cs = subjectCoefs[subject]
            if (!cs) {
              const topics = topicPredictions.filter((t) => t.subject === subject)
              const avgM = topics.reduce((s, t) => s + t.mastery, 0) / Math.max(1, topics.length)
              return { subject, estimated_score: Math.round(SUBJECT_WEIGHTS[subject] * avgM), average_mastery: Number(avgM.toFixed(3)) }
            }
            let pred = cs.intercept
            for (const [feat, val] of Object.entries(features)) {
              pred += (cs.features[feat] ?? 0) * val
            }
            pred = Math.max(0.05, Math.min(0.95, pred))
            return { subject, estimated_score: Math.round(SUBJECT_WEIGHTS[subject] * pred), average_mastery: Number(pred.toFixed(3)) }
          })

          estimatedScore = clamp(subjectScores.reduce((s, sub) => s + sub.estimated_score, 0), 0, 300)
        }
      }
    } catch {
      // Trained model not available yet — fall through
    }

    // Rule-based fallback
    if (scoreMechanism === 'rule_formula') {
      subjectScores = Object.keys(SUBJECT_WEIGHTS).map((subject) => {
        const topics = topicPredictions.filter((topic) => topic.subject === subject)
        const averageMastery = topics.reduce((sum, topic) => sum + topic.mastery, 0) / Math.max(1, topics.length)
        return {
          subject,
          estimated_score: Math.round(SUBJECT_WEIGHTS[subject] * averageMastery),
          average_mastery: Number(averageMastery.toFixed(3)),
        }
      })
      estimatedScore = clamp(subjectScores.reduce((sum, s) => sum + s.estimated_score, 0), 0, 300)
    }

    const nextTopics = topicPredictions
      .filter((topic) => topic.mastery < 0.72)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 4)
      .map((topic) => topic.topic)

    return new Response(JSON.stringify({
      exam,
      estimated_score: estimatedScore,
      target_score: targetScore,
      gap_to_target: Math.max(0, targetScore - estimatedScore),
      percentile_band: percentileBand(estimatedScore),
      confidence: profiles?.length ? 'medium' : 'low',
      score_mechanism: scoreMechanism,
      model_version: modelVersion,
      subject_scores: subjectScores,
      next_topics_to_prove: nextTopics,
      message: `You are tracking around ${estimatedScore}/300 in JEE Main right now. Prove ${nextTopics.length || 1} more topics to close the next score gap.`,
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
