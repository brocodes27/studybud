import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const JEE_TOPICS = [
  'Mechanics',
  'Electrostatics',
  'Current Electricity',
  'Modern Physics',
  'Organic Chemistry',
  'Physical Chemistry',
  'Inorganic Chemistry',
  'Calculus',
  'Coordinate Geometry',
  'Algebra',
  'Vectors',
  'Probability',
]

const SUBJECT_WEIGHTS: Record<string, number> = {
  physics: 100,
  chemistry: 100,
  mathematics: 100,
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

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

    const subjectScores = Object.keys(SUBJECT_WEIGHTS).map((subject) => {
      const topics = topicPredictions.filter((topic) => topic.subject === subject)
      const averageMastery = topics.reduce((sum, topic) => sum + topic.mastery, 0) / Math.max(1, topics.length)
      return {
        subject,
        estimated_score: Math.round(SUBJECT_WEIGHTS[subject] * averageMastery),
        average_mastery: Number(averageMastery.toFixed(3)),
      }
    })

    const estimatedScore = clamp(subjectScores.reduce((sum, subject) => sum + subject.estimated_score, 0), 0, 300)
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
