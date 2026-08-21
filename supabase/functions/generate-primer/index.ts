import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'
import { callGeminiJSON } from '../_shared/gemini.ts'

/**
 * Priming content for one syllabus topic (PRD v2 §4.1).
 *
 * Priming is pre-learning prep: it gives the brain a schema before the lecture
 * so attention lands on what matters instead of overloading on everything at
 * once. Six minutes of this is what stops an hour of lecture from leaking.
 *
 * The primer is cached per (course, topic) and shared by every student in that
 * course — the syllabus topic is the same for all of them, so generating it per
 * student would multiply cost by class size for identical output. This cache is
 * the main AI cost control in the stage engine, which is why only the service
 * role writes to it: a client that could write here could poison another
 * student's priming.
 *
 * Generation is never allowed to block the stage. If Gemini is unavailable or
 * returns something unusable, a deterministic primer is built from the syllabus
 * itself and returned uncached, so a later call can still fill the cache with a
 * real one.
 */

interface PrimerContent {
  /** What this topic is about, in three sentences. */
  summary: string
  /** Questions to listen for during the lecture. */
  listenFor: string[]
  /** Terms that will show up and should not be a surprise. */
  terms: string[]
  /** One prerequisite worth confirming before the lecture. */
  prereqCheck: string
  /** How this topic follows from the previous one. */
  connectsTo: string
}

const LISTEN_FOR_COUNT = 5
const TERM_COUNT = 3

const SYSTEM_PROMPT = `You write pre-lecture primers for university students.

A primer is read in under six minutes BEFORE the lecture happens. Its only job
is to give the student a schema: what this topic is for, what to listen for, and
which words will appear. It is not a lesson and not a summary of content the
student has not seen yet.

Return JSON with exactly these keys:
{
  "summary": "3 sentences on what this topic is and why it exists",
  "listenFor": ["${LISTEN_FOR_COUNT} questions the lecture should answer"],
  "terms": ["${TERM_COUNT} terms that will appear, each with a 6-word gloss"],
  "prereqCheck": "one thing to confirm you still remember before the lecture",
  "connectsTo": "one sentence linking this to the previous topic"
}

Rules:
- Write for someone who has NOT studied this yet. No jargon without a gloss.
- Questions must be answerable by the lecture, not by the primer.
- Never teach the material. Priming builds the shelf; the lecture puts things on it.
- Plain language, second person, no preamble.`

function fallbackPrimer(
  topic: string,
  courseCode: string,
  prereqs: string[],
  previousTopic: string | null,
): PrimerContent {
  // Deterministic and content-free by design: it cannot know the topic, so it
  // sets up the student's attention instead of pretending to explain anything.
  return {
    summary: `${topic} is the next topic in ${courseCode}. You have not covered it yet — go in looking for what problem it solves and where it fits with what you already know.`,
    listenFor: [
      `What problem does ${topic} solve?`,
      `What is the core definition or rule of ${topic}?`,
      `Which worked example does the lecturer reach for first?`,
      `Where does ${topic} break down or not apply?`,
      `How does ${topic} connect to what we covered last time?`,
    ],
    terms: [`${topic} — the topic itself`, ...prereqs.slice(0, TERM_COUNT - 1)],
    prereqCheck: prereqs.length
      ? `Can you still explain ${prereqs[0]}? ${topic} builds on it.`
      : `Skim your last set of notes for ${courseCode} before the lecture.`,
    connectsTo: previousTopic
      ? `This follows ${previousTopic}.`
      : `This is where ${courseCode} goes next.`,
  }
}

function normalize(raw: any, fallback: PrimerContent): PrimerContent {
  const strings = (value: unknown, count: number): string[] => {
    const list = Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []
    return list.slice(0, count)
  }

  const listenFor = strings(raw?.listenFor, LISTEN_FOR_COUNT)
  const terms = strings(raw?.terms, TERM_COUNT)

  return {
    summary: String(raw?.summary ?? '').trim() || fallback.summary,
    listenFor: listenFor.length >= 3 ? listenFor : fallback.listenFor,
    terms: terms.length > 0 ? terms : fallback.terms,
    prereqCheck: String(raw?.prereqCheck ?? '').trim() || fallback.prereqCheck,
    connectsTo: String(raw?.connectsTo ?? '').trim() || fallback.connectsTo,
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

    // User-scoped client: RLS is what proves this student is enrolled in the
    // course whose primer they are asking for. Do not bypass it with the
    // service role just to read.
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authErr } = await sb.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { topic_id: topicId } = await req.json()
    if (!topicId) return json({ error: 'topic_id is required' }, 400)

    const { data: topic, error: topicError } = await sb
      .from('curve_course_topics')
      .select('id, topic, week, kc_id, course_id, course:curve_courses ( course_code, title )')
      .eq('id', topicId)
      .maybeSingle()

    if (topicError || !topic) return json({ error: 'Topic not found' }, 404)

    const course = Array.isArray(topic.course) ? topic.course[0] : topic.course
    const courseCode = course?.course_code ?? 'this course'

    // Cache hit: one generation serves the whole class.
    const { data: cached } = await sb
      .from('curve_stage_primers')
      .select('content')
      .eq('course_id', topic.course_id)
      .eq('topic_id', topicId)
      .maybeSingle()

    if (cached?.content) {
      return json({ content: cached.content, cached: true, fallback: false })
    }

    // Context: the prerequisite concepts this topic builds on, and the topic
    // that came before it in the syllabus. Both are already in the graph.
    const [prereqNames, previousTopic] = await Promise.all([
      fetchPrereqNames(sb, topic.kc_id),
      fetchPreviousTopic(sb, topic.course_id, topic.week),
    ])

    const fallback = fallbackPrimer(topic.topic, courseCode, prereqNames, previousTopic)

    let content: PrimerContent
    let usedFallback = false
    let model: string | null = null

    try {
      const raw = await callGeminiJSON([
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            `Course: ${courseCode} — ${course?.title ?? ''}`,
            `Upcoming topic: ${topic.topic}`,
            `Week: ${topic.week ?? 'unknown'}`,
            previousTopic ? `Previous topic: ${previousTopic}` : 'Previous topic: none',
            prereqNames.length
              ? `Prerequisite concepts: ${prereqNames.join(', ')}`
              : 'Prerequisite concepts: none recorded',
          ].join('\n'),
        },
      ], { temperature: 0.4, maxOutputTokens: 900 })

      content = normalize(raw, fallback)
      model = 'gemini-3-flash-preview'
    } catch (err) {
      // Priming has a hard time window — a generation failure must never be
      // what stops a student priming before tomorrow's lecture.
      console.warn('generate-primer fell back to the deterministic primer:', err)
      content = fallback
      usedFallback = true
    }

    if (!usedFallback) {
      // Service role: the primer cache is shared, so writes are server-only.
      const admin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )
      const { error: cacheError } = await admin
        .from('curve_stage_primers')
        .upsert(
          { course_id: topic.course_id, topic_id: topicId, content, model },
          { onConflict: 'course_id,topic_id' },
        )
      if (cacheError) console.error('Primer cache write failed:', cacheError)
    }

    return json({ content, cached: false, fallback: usedFallback })
  } catch (err: any) {
    console.error('generate-primer error:', err)
    return json({ error: err?.message || 'Could not build a primer' }, 400)
  }
})

/* eslint-disable @typescript-eslint/no-explicit-any */

async function fetchPrereqNames(sb: any, kcId: string | null): Promise<string[]> {
  if (!kcId) return []
  const { data: kc } = await sb
    .from('knowledge_components')
    .select('prerequisite_ids')
    .eq('id', kcId)
    .maybeSingle()

  const ids = Array.isArray(kc?.prerequisite_ids) ? kc.prerequisite_ids : []
  if (ids.length === 0) return []

  const { data: prereqs } = await sb
    .from('knowledge_components')
    .select('topic')
    .in('id', ids.slice(0, 5))

  return ((prereqs ?? []) as any[]).map((row) => row.topic).filter(Boolean)
}

async function fetchPreviousTopic(
  sb: any,
  courseId: string,
  week: number | null,
): Promise<string | null> {
  if (!week || week <= 1) return null
  const { data } = await sb
    .from('curve_course_topics')
    .select('topic')
    .eq('course_id', courseId)
    .lt('week', week)
    .order('week', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.topic ?? null
}
