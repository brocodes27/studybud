// Score Prediction Model Training Edge Function
// Trains ordinal logistic regression coefficients on labeled student data.
// Monthly cron job. Replaces rule-based formula in score-prediction/index.ts.
//
// Features: per-subject mastery (IRT-weighted), interaction counts, streaks,
// behavioral signals, cognitive tier, prereq readiness.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'

const MIN_TRAINING_SAMPLES = 100
const TRAIN_TEST_SPLIT = 0.8
const MAX_ITERATIONS = 200
const LEARNING_RATE = 0.01
const SUBJECTS = ['physics', 'chemistry', 'mathematics']

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
    .rpc('start_pipeline_run', { p_function_name: 'train-score-model' })
    .single()

  try {
    // 1. Fetch labeled test attempts (completed with real scores)
    const { data: testAttempts } = await supabaseAdmin
      .from('practice_test_attempts')
      .select(`
        id,
        user_id,
        subject,
        total_score,
        max_score,
        created_at
      `)
      .not('total_score', 'is', null)
      .order('created_at', { ascending: false })
      .limit

    if (!testAttempts || testAttempts.length < MIN_TRAINING_SAMPLES) {
      await supabaseAdmin.rpc('mark_pipeline_complete', {
        p_run_id: runRecord?.id,
        p_status: 'completed',
        p_records_processed: 0,
        p_errors: 'Insufficient labeled data'
      })
      return new Response(JSON.stringify({
        message: `Need ${MIN_TRAINING_SAMPLES} labeled samples, got ${testAttempts?.length ?? 0}`,
        samples: testAttempts?.length ?? 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Compute features per attempt
    const featureRows: FeatureRow[] = []
    const userIds = [...new Set(testAttempts.map(t => t.user_id))]

    // Fetch student profiles for all users
    const { data: profiles } = await supabaseAdmin
      .from('student_cognitive_profiles')
      .select('user_id, kc_id, p_mastery, interaction_count, cognitive_tier')
      .in('user_id', userIds)

    // Fetch behavioral profiles
    const { data: behaviorals } = await supabaseAdmin
      .from('student_behavioral_profiles')
      .select('user_id, missed_days_streak, backlog_count, streak_days')
      .in('user_id', userIds)

    const profileMap = new Map<string, typeof profiles>()
    for (const p of profiles ?? []) {
      const arr = profileMap.get(p.user_id) ?? []
      arr.push(p)
      profileMap.set(p.user_id, arr)
    }
    const behavioralMap = new Map<string, typeof behaviorals>(behaviorals?.map(b => [b.user_id, b]) ?? [])

    for (const attempt of testAttempts) {
      const userProfiles = profileMap.get(attempt.user_id) ?? []
      const behavioral = behavioralMap.get(attempt.user_id)

      // Per-subject features
      const subjectMasteries = new Map<string, number>()
      for (const prof of userProfiles) {
        const current = subjectMasteries.get(prof.kc_id) ?? 0
        subjectMasteries.set(prof.kc_id, Math.max(current, prof.p_mastery))
      }

      const avgMastery = userProfiles.length > 0
        ? userProfiles.reduce((s, p) => s + p.p_mastery, 0) / userProfiles.length
        : 0.1

      const totalInteractions = userProfiles.reduce((s, p) => s + (p.interaction_count ?? 0), 0)
      const avgInteractionCount = userProfiles.length > 0 ? totalInteractions / userProfiles.length : 0

      // Cognitive tier encoding
      const tierEncoding = { anoetic: 0, noetic: 1, autonoetic: 2 }
      const avgTier = userProfiles.length > 0
        ? userProfiles.reduce((s, p) => s + (tierEncoding[p.cognitive_tier as keyof typeof tierEncoding] ?? 0), 0) / userProfiles.length
        : 0

      const scoreRatio = attempt.total_score / attempt.max_score
      const band = scoreToBand(scoreRatio)

      featureRows.push({
        user_id: attempt.user_id,
        subject: attempt.subject,
        score_ratio: scoreRatio,
        band,
        avg_mastery: avgMastery,
        total_interactions: totalInteractions,
        avg_interaction_count: avgInteractionCount,
        missed_days_streak: behavioral?.missed_days_streak ?? 0,
        backlog_count: behavioral?.backlog_count ?? 0,
        streak_days: behavioral?.streak_days ?? 0,
        cognitive_tier_avg: avgTier,
        feature_version: 1
      })
    }

    // 3. Split into train/test
    shuffle(featureRows)
    const splitIdx = Math.floor(featureRows.length * TRAIN_TEST_SPLIT)
    const trainData = featureRows.slice(0, splitIdx)
    const testData = featureRows.slice(splitIdx)

    // 4. Train per-subject ordinal logistic regression
    // We'll train simple linear regression per band (simplified ordinal logit)
    // Features: avg_mastery, total_interactions, missed_days_streak, backlog_count, streak_days, cognitive_tier_avg

    const FEATURE_NAMES = ['avg_mastery', 'total_interactions', 'missed_days_streak', 'backlog_count', 'streak_days', 'cognitive_tier_avg']
    const latestVersionRaw = (await supabaseAdmin.rpc('get_latest_score_model_version')) as any
    const modelVersion = (typeof latestVersionRaw === 'number' ? latestVersionRaw : 0) + 1

    const coefficients: Coefficient[] = []
    let totalAccuracy = 0
    let nSubjects = 0

    for (const subject of SUBJECTS) {
      const subjectTrain = trainData.filter(r => r.subject === subject)
      const subjectTest = testData.filter(r => r.subject === subject)

      if (subjectTrain.length < 20) continue

      // Simple gradient descent for linear regression (proxy for ordinal logit)
      // We'll predict score_ratio as a continuous target
      const coefs = trainLinearRegression(subjectTrain, FEATURE_NAMES)

      // Evaluate on test set
      let correct = 0
      for (const row of subjectTest) {
        const features = extractFeatures(row, FEATURE_NAMES)
        const predicted = predictScore(features, coefs)
        const predictedBand = scoreToBand(predicted)
        if (predictedBand === row.band) correct++
      }

      const accuracy = subjectTest.length > 0 ? correct / subjectTest.length : 0
      if (accuracy >= 0.3) { // Only keep if better than random baseline
        totalAccuracy += accuracy
        nSubjects++

        for (const feat of FEATURE_NAMES) {
          coefficients.push({
            feature_name: feat,
            coefficient: coefs[feat] ?? 0,
            subject,
            band_intercept: coefs['_intercept'] ?? 0,
            model_version: modelVersion,
            accuracy,
            training_sample_size: subjectTrain.length
          })
        }
      }
    }

    // 5. Store coefficients
    if (coefficients.length > 0) {
      await supabaseAdmin.from('score_model_coefficients').insert(coefficients)
    }

    // 6. Mark pipeline complete
    await supabaseAdmin.rpc('mark_pipeline_complete', {
      p_run_id: runRecord?.id,
      p_status: 'completed',
      p_records_processed: featureRows.length,
      p_errors: null
    })

    return new Response(JSON.stringify({
      success: true,
      model_version: modelVersion,
      training_samples: featureRows.length,
      test_samples: testData.length,
      subjects_trained: nSubjects,
      avg_accuracy: nSubjects > 0 ? totalAccuracy / nSubjects : 0,
      coefficients_stored: coefficients.length / FEATURE_NAMES.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    await supabaseAdmin.rpc('mark_pipeline_complete', {
      p_run_id: runRecord?.id,
      p_status: 'failed',
      p_records_processed: 0,
      p_errors: error.message
    })

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

interface FeatureRow {
  user_id: string
  subject: string
  score_ratio: number
  band: number
  avg_mastery: number
  total_interactions: number
  avg_interaction_count: number
  missed_days_streak: number
  backlog_count: number
  streak_days: number
  cognitive_tier_avg: number
  feature_version: number
}

interface Coefficient {
  feature_name: string
  coefficient: number
  subject: string
  band_intercept: number
  model_version: number
  accuracy: number
  training_sample_size: number
}

function scoreToBand(ratio: number): number {
  // JEE-like bands: 1 = <40%, 2 = 40-60%, 3 = 60-80%, 4 = >80%
  if (ratio < 0.4) return 1
  if (ratio < 0.6) return 2
  if (ratio < 0.8) return 3
  return 4
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

function trainLinearRegression(data: FeatureRow[], featureNames: string[]): Record<string, number> {
  const coefs: Record<string, number> = { _intercept: 0.5 }

  // Initialize coefficients
  for (const feat of featureNames) {
    coefs[feat] = 0.0
  }

  // Gradient descent
  const n = data.length
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let gradientIntercept = 0
    const gradientFeats: Record<string, number> = {}
    for (const feat of featureNames) gradientFeats[feat] = 0

    let totalError = 0
    for (const row of data) {
      const features = extractFeatures(row, featureNames)
      let pred = coefs['_intercept']
      for (const feat of featureNames) {
        pred += (coefs[feat] ?? 0) * features[feat]
      }
      pred = Math.max(0.05, Math.min(0.95, pred))

      const error = pred - row.score_ratio
      totalError += Math.abs(error)

      gradientIntercept += error / n
      for (const feat of featureNames) {
        gradientFeats[feat] += (error * features[feat]) / n
      }
    }

    // Update coefficients
    coefs['_intercept'] -= LEARNING_RATE * gradientIntercept
    for (const feat of featureNames) {
      coefs[feat] -= LEARNING_RATE * gradientFeats[feat]
    }

    const avgError = totalError / n
    if (avgError < 0.01) break
  }

  return coefs
}

function extractFeatures(row: FeatureRow, featureNames: string[]): Record<string, number> {
  const features: Record<string, number> = {}
  for (const feat of featureNames) {
    features[feat] = (row as any)[feat] ?? 0
  }
  return features
}

function predictScore(features: Record<string, number>, coefs: Record<string, number>): number {
  let pred = coefs['_intercept'] ?? 0
  for (const [feat, val] of Object.entries(features)) {
    pred += (coefs[feat] ?? 0) * val
  }
  return Math.max(0, Math.min(1, pred))
}
