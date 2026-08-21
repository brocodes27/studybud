import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'
import { callGeminiJSON } from '../_shared/gemini.ts'

/**
 * Grades a closed-book retrieval set (PRD v2 §4.4).
 *
 * This exists because `adaptive-difficulty` deliberately strips answer keys
 * from its response — it reads the question bank with the service role, so
 * shipping the keys to the browser would hand every student the answers. That
 * makes grading a server-side job.
 *
 * Two paths. A question that came from the bank is graded against its stored
 * answer, which is exact and free. A question the model generated on the fly
 * has no stored answer, so the model judges it — instructed to mark on whether
 * the idea is right, not on wording, because retrieval is a memory test and not
 * a spelling one.
 *
 * Correctness is returned per item and never aggregated here: the client logs
 * each one to the BKT engine individually, and a session average would destroy
 * the per-item evidence the mastery model runs on.
 */

interface SubmittedAnswer {
  /** `question_bank` row id, when the item came from the bank. */
  question_id?: string | null
  question: string
  /** The student's answer: the chosen option's text, or free recall. */
  answer: string
}

interface GradedAnswer {
  question: string
  is_correct: boolean
  /** The expected answer, revealed only after grading. */
  expected: string | null
  /** Present only for model-judged items. */
  note?: string
}

const MAX_ITEMS = 20

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Exact-ish match for bank questions: case, punctuation and spacing are noise. */
function matchesStoredAnswer(given: string, expected: string): boolean {
  const a = normalize(given)
  const b = normalize(expected)
  if (!a) return false
  if (a === b) return true
  // Multiple-choice answers are often stored as the option text while the
  // student submits the same text with a letter prefix, or vice versa.
  return a.length > 2 && (b.includes(a) || a.includes(b))
}

const JUDGE_SYSTEM = `You mark a student's closed-book recall answers.

Mark on whether the idea is right. This is a memory test, not a spelling test:
ignore wording, phrasing, capitalisation, and minor notation differences.

Mark incorrect when the answer is empty, off-topic, states the opposite, or is
so vague it would not distinguish someone who knows the material from someone
who does not. Do not award credit for restating the question.

Return JSON only:
{"results":[{"is_correct":true,"expected":"the answer in one sentence","note":"under 12 words, only when incorrect"}]}
One entry per question, in the order given.`

async function judgeAnswers(
  items: SubmittedAnswer[],
  topic: string | undefined,
): Promise<GradedAnswer[]> {
  const prompt = items
    .map((item, index) => `${index + 1}. Q: ${item.question}\n   A: ${item.answer || '(blank)'}`)
    .join('\n')

  try {
    const raw = await callGeminiJSON(
      [
        { role: 'system', content: JUDGE_SYSTEM },
        { role: 'user', content: topic ? `Topic: ${topic}\n\n${prompt}` : prompt },
      ],
      { temperature: 0, maxOutputTokens: 1200 },
    )

    const results = Array.isArray(raw?.results) ? raw.results : []
    return items.map((item, index) => {
      const result = results[index] ?? {}
      return {
        question: item.question,
        is_correct: result.is_correct === true,
        expected: result.expected ? String(result.expected) : null,
        note: result.note ? String(result.note).slice(0, 120) : undefined,
      }
    })
  } catch (err) {
    // A grading failure must not be recorded as a wrong answer — that would
    // push the student's mastery down for something they may well have known.
    // Failing the whole call lets the client discard the session instead.
    console.warn('check-retrieval could not judge answers:', err)
    throw new Error('Could not mark this set. Nothing was recorded — try submitting again.')
  }
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

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await sb.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { answers, topic } = await req.json()
    if (!Array.isArray(answers) || answers.length === 0) {
      return json({ error: 'answers is required' }, 400)
    }
    const submitted = (answers as SubmittedAnswer[]).slice(0, MAX_ITEMS)

    // Answer keys are read with the service role: the question bank is not
    // student-readable, and it must stay that way.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const bankIds = submitted
      .map((item) => item.question_id)
      .filter((id): id is string => Boolean(id))

    const keys = new Map<string, string>()
    if (bankIds.length > 0) {
      const { data } = await admin
        .from('question_bank')
        .select('id, options, correct_index, answer_text')
        .in('id', bankIds)

      for (const row of (data ?? []) as any[]) {
        // Multiple choice stores the answer as an index into options; written
        // questions store it as text. Either way the student sees and submits
        // text, so the key is normalised to text here.
        const options = Array.isArray(row.options) ? row.options : []
        const fromIndex =
          typeof row.correct_index === 'number' ? options[row.correct_index] : undefined
        const expected = fromIndex ?? row.answer_text
        if (expected) keys.set(row.id, String(expected))
      }
    }

    const graded: GradedAnswer[] = []
    const needsJudging: SubmittedAnswer[] = []

    for (const item of submitted) {
      const expected = item.question_id ? keys.get(item.question_id) : undefined
      if (expected) {
        graded.push({
          question: item.question,
          is_correct: matchesStoredAnswer(item.answer ?? '', expected),
          expected,
        })
      } else {
        needsJudging.push(item)
      }
    }

    if (needsJudging.length > 0) {
      graded.push(...(await judgeAnswers(needsJudging, topic)))
    }

    return json({ graded })
  } catch (err: any) {
    console.error('check-retrieval error:', err)
    return json({ error: err?.message || 'Could not grade that set' }, 400)
  }
})
