import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'
import { callGeminiJSON, GeminiMessage } from '../_shared/gemini.ts'

export interface GradingComponentExtract {
  name: string
  kind: 'homework' | 'quiz' | 'midterm' | 'final' | 'project' | 'lab' | 'participation' | 'other'
  weight: number
  drop_lowest?: number
  due_on?: string
}

export interface CollegeSyllabusWeek {
  week: number
  topic: string
  subtopics: string[]
  exam_event?: string
  due_date?: string
}

export interface CollegeSyllabusScanResult {
  course_code?: string
  course_title?: string
  instructor_name?: string
  term?: string
  textbook?: string
  grading_components: GradingComponentExtract[]
  weekly_schedule: CollegeSyllabusWeek[]
  confidence?: 'low' | 'medium' | 'high'
}

const SYSTEM_PROMPT = `You are a specialist US college syllabus parser.
Extract syllabus PDFs into structured JSON containing course details, grading breakdown, exam dates, and weekly schedule.

Return ONLY JSON matching this shape:
{
  "course_code": "CHEM 2210",
  "course_title": "Organic Chemistry I",
  "instructor_name": "Dr. Jane Smith",
  "term": "Fall 2026",
  "textbook": "Organic Chemistry 8th Edition - Loudon",
  "grading_components": [
    {
      "name": "Problem Sets",
      "kind": "homework",
      "weight": 20,
      "drop_lowest": 1
    },
    {
      "name": "Midterm 1",
      "kind": "midterm",
      "weight": 20,
      "drop_lowest": 0,
      "due_on": "2026-10-15"
    },
    {
      "name": "Final Exam",
      "kind": "final",
      "weight": 40,
      "drop_lowest": 0
    }
  ],
  "weekly_schedule": [
    {
      "week": 1,
      "topic": "Structure and Bonding",
      "subtopics": ["Hybridization", "Resonance"],
      "due_date": "2026-09-05"
    }
  ],
  "confidence": "high"
}

Rules:
- Extract precise weight percentages for homework, quizzes, midterms, final, labs, projects, participation.
- Weights MUST sum to approximately 100%.
- "kind" MUST be one of: "homework", "quiz", "midterm", "final", "project", "lab", "participation", "other".
- Extract drop-lowest counts if specified (e.g., "lowest 1 homework dropped" -> drop_lowest: 1).
- Parse weekly topics and subtopics chronologically.
- Never invent information not present or inferable from the document.`

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
    const sbAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await sb.auth.getUser(token)
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { class_id, course_id, pages, subject } = await req.json()
    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error('pages array is required')
    }

    const messages: GeminiMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Subject hint: ${subject || ''}\nExtract the college syllabus structure from these page images.` },
          ...pages.slice(0, 15).map((pageDataUrl: string) => ({ type: 'image' as const, dataUrl: pageDataUrl })),
        ],
      },
    ]

    const parsed = await callGeminiJSON<CollegeSyllabusScanResult>(messages, {
      temperature: 0.1,
      maxOutputTokens: 8192,
    })

    // If linked to a Curve course, insert components directly into public.curve_grading_components
    if (course_id && parsed.grading_components?.length > 0) {
      const componentsToInsert = parsed.grading_components.map((comp, idx) => ({
        course_id,
        name: comp.name,
        kind: comp.kind || 'other',
        weight: comp.weight,
        drop_lowest: comp.drop_lowest || 0,
        due_on: comp.due_on || null,
        position: idx,
      }))
      await sbAdmin.from('curve_grading_components').insert(componentsToInsert)
    }

    // Persist weekly topics into the BKT substrate so the mastery engine has
    // canonical knowledge nodes to trace against. curve_ensure_course_kc
    // canonicalizes the topic name into knowledge_components and links it to
    // the course by week; repeated scans are idempotent.
    if (course_id && Array.isArray(parsed.weekly_schedule) && parsed.weekly_schedule.length > 0) {
      for (const week of parsed.weekly_schedule) {
        const { error: kcError } = await sbAdmin.rpc('curve_ensure_course_kc', {
          p_course_id: course_id,
          p_topic: week.topic,
          p_week: week.week,
        })
        if (kcError) console.error('topic persistence failed:', kcError)
      }
    }

    // Legacy closed-loop integration support if class_id is present
    if (class_id) {
      await sbAdmin.from('classes').update({
        subject: parsed.course_title || parsed.course_code || subject,
      }).eq('id', class_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        syllabus: parsed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('scan-curriculum-file error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Syllabus scan failed' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

