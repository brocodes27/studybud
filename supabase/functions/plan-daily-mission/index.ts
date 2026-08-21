import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'

/**
 * Curve daily action planner.
 *
 * Ranks the student's upcoming graded components by how much a twenty-minute
 * session is expected to move the final grade, per minute spent. The math is
 * deliberately the same deterministic arithmetic the app shows on the
 * dashboard: component weight times an expected score lift, converted into
 * final-percentage points, then divided by the time the action type takes.
 *
 * Every action carries a deep link into the study session for that course so
 * the loop stays closed: see the forecast, take the one action, watch the
 * number move.
 */

export interface DailyCurveAction {
  id: string
  enrollment_id: string
  course_code: string
  title: string
  action_type: 'practice' | 'atlas_tutor' | 'flashcards' | 'spaced_review' | 'notebook_scan'
  component_name: string
  due_in_days: number
  weight: number
  estimated_grade_impact: string // e.g. "+3.0%"
  estimated_minutes: number
  deep_link: string
  why_today: string
}

interface ComponentRow {
  id: string
  name: string
  kind: string
  weight: number
  drop_lowest: number
  due_on: string | null
}

interface ScoreRow {
  component_id: string
  points_earned: number
  points_possible: number
}

// How long each action type takes on average, used to rank by lift per minute.
const MINUTES_BY_KIND: Record<DailyCurveAction['action_type'], number> = {
  practice: 20,
  atlas_tutor: 15,
  flashcards: 10,
  spaced_review: 10,
  notebook_scan: 5,
}

// Rough expected improvement on the targeted component from one focused
// session, as a fraction of the component's score. Kept conservative.
const EXPECTED_LIFT = 0.15

function actionTypeFor(kind: string, weight: number): DailyCurveAction['action_type'] {
  if (kind === 'homework') return 'notebook_scan'
  if (kind === 'quiz') return 'flashcards'
  if (weight >= 20) return 'practice'
  return 'spaced_review'
}

function daysUntil(iso: string | null, fallback: number): number {
  if (!iso) return fallback
  const due = new Date(iso).getTime()
  const today = new Date().getTime()
  return Math.max(1, Math.ceil((due - today) / 86400000))
}

function hasScores(componentId: string, scores: ScoreRow[]): boolean {
  return scores.some((score) => score.component_id === componentId)
}

serve(async (req: Request) => {
  const cors = getCors(req)
  const corsHeaders = cors.headers
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: enrollments, error: enrollmentError } = await sb
      .from('curve_enrollments')
      .select(`
        id,
        course:curve_courses (
          id, course_code, title,
          components:curve_grading_components (id, name, kind, weight, drop_lowest, due_on)
        ),
        scores:curve_scores (component_id, points_earned, points_possible)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (enrollmentError) throw enrollmentError

    if (enrollments && enrollments.length > 0) {
      const candidateActions: DailyCurveAction[] = []

      for (const enrollment of enrollments) {
        const course = enrollment.course as any
        if (!course || !Array.isArray(course.components)) continue

        const scores: ScoreRow[] = (enrollment.scores ?? []) as ScoreRow[]

        for (const component of course.components as ComponentRow[]) {
          // Already-graded categories have no unearned weight to move.
          if (hasScores(component.id, scores)) continue

          const days = daysUntil(component.due_on, 14)
          const actionType = actionTypeFor(component.kind, Number(component.weight))
          const minutes = MINUTES_BY_KIND[actionType]

          // Final-percentage points gained from lifting this component's
          // score by EXPECTED_LIFT, exactly as the dashboard's deterministic
          // layer would compute it: weight × lift.
          const impactPts = Number(component.weight) * EXPECTED_LIFT

          // Urgency weights by exam proximity; past-due components are most urgent.
          const proximityWeight = days <= 3 ? 1.5 : days <= 7 ? 1.2 : days <= 14 ? 1.0 : 0.6
          const leverage = (impactPts / minutes) * proximityWeight

          candidateActions.push({
            id: `act_${enrollment.id}_${component.id}`,
            enrollment_id: enrollment.id,
            course_code: course.course_code,
            title:
              actionType === 'notebook_scan'
                ? `Work through ${component.name.toLowerCase()} for ${course.course_code}`
                : `Drill ${component.name} concepts for ${course.course_code}`,
            action_type: actionType,
            component_name: component.name,
            due_in_days: days,
            weight: Number(component.weight),
            estimated_grade_impact: `+${impactPts.toFixed(1)}%`,
            estimated_minutes: minutes,
            deep_link: `/session/${enrollment.id}?focus=${encodeURIComponent(component.name)}`,
            why_today:
              days <= 3
                ? `${component.name} is due in ${days} day${days === 1 ? '' : 's'} and is ${component.weight}% of your grade.`
                : `${component.name} is ${component.weight}% of your grade, and this is the highest-leverage work you can do today.`,
          })
        }
      }

      candidateActions.sort(
        (a, b) =>
          (Number(b.weight) / b.estimated_minutes) *
            proximity(b.due_in_days) -
          (Number(a.weight) / a.estimated_minutes) * proximity(a.due_in_days)
      )

      const primaryAction = candidateActions[0] || null

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'curve',
          primary_action: primaryAction,
          all_actions: candidateActions.slice(0, 5),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'empty',
        primary_action: null,
        message: 'Enroll in a course to receive your daily grade action.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('plan-daily-mission error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Mission planning failed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function proximity(days: number): number {
  if (days <= 3) return 1.5
  if (days <= 7) return 1.2
  if (days <= 14) return 1.0
  return 0.6
}
