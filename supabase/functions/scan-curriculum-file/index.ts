import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCors } from '../_shared/cors.ts'
import { callGeminiJSON, GeminiMessage } from '../_shared/gemini.ts'

interface CurriculumWeek {
  week: number;
  physics?: { topic: string; subtopics: string[] };
  chemistry?: { topic: string; subtopics: string[] };
  mathematics?: { topic: string; subtopics: string[] };
  social_science?: { topic: string; subtopics: string[] };
}

interface CurriculumScanResult {
  weekly_schedule: CurriculumWeek[];
  detected_class?: string;
  detected_subjects?: string[];
  confidence?: 'low' | 'medium' | 'high';
}

const SYSTEM_PROMPT = `You extract school/coaching curriculum PDFs into a strict weekly study schedule JSON.

Return ONLY JSON with this shape:
{
  "weekly_schedule": [
    {
      "week": 1,
      "physics": { "topic": "...", "subtopics": ["..."] },
      "chemistry": { "topic": "...", "subtopics": ["..."] },
      "mathematics": { "topic": "...", "subtopics": ["..."] },
      "social_science": { "topic": "...", "subtopics": ["..."] }
    }
  ],
  "detected_class": "Class 10 / Class 12 / JEE / etc",
  "detected_subjects": ["Mathematics"],
  "confidence": "low|medium|high"
}

Rules:
- Extract what is visible in the PDF pages.
- If the curriculum is a single-subject class, fill only that subject key.
- Use "mathematics" for Maths/Math.
- Use "social_science" for Social Science, SST, Civics, History, Geography, Political Science, Economics.
- If the PDF is chapter list without weeks, convert it into week order, one chapter per week.
- If it has months/units instead of weeks, preserve order and map them to week 1, 2, 3...
- subtopics must be an array. If no subtopics are visible, use [].
- Do not invent extra subjects.
- At least one weekly_schedule item should be returned if any curriculum content is visible.`;

function normalizeSubject(subject?: string | null): 'physics' | 'chemistry' | 'mathematics' | 'social_science' | null {
  const s = (subject || '').toLowerCase();
  if (s.includes('math')) return 'mathematics';
  if (s.includes('chem')) return 'chemistry';
  if (s.includes('phys')) return 'physics';
  if (s.includes('social') || s.includes('sst') || s.includes('civic') || s.includes('history') || s.includes('geograph') || s.includes('political') || s.includes('economic')) return 'social_science';
  return null;
}

function fallbackSchedule(subject?: string | null): CurriculumWeek[] {
  const key = normalizeSubject(subject) || 'mathematics';
  const defaults: Record<string, string[]> = {
    physics: ['Units and Measurements', 'Motion in a Straight Line', 'Motion in a Plane', 'Laws of Motion'],
    chemistry: ['Some Basic Concepts of Chemistry', 'Structure of Atom', 'Classification of Elements', 'Chemical Bonding'],
    mathematics: ['Number Systems', 'Polynomials', 'Coordinate Geometry', 'Linear Equations'],
    social_science: ['History: The Rise of Nationalism', 'Geography: Resources', 'Civics: Democracy', 'Economics: Development'],
  };
  return defaults[key].map((topic, index) => ({ week: index + 1, [key]: { topic, subtopics: [] } }));
}

function normalizeResult(result: CurriculumScanResult, subject?: string | null): CurriculumScanResult {
  const preferred = normalizeSubject(subject);
  const weeks = Array.isArray(result.weekly_schedule) ? result.weekly_schedule : [];
  const normalized = weeks
    .map((week, index) => {
      const row: CurriculumWeek = { week: Number(week.week) || index + 1 };
      for (const key of ['physics', 'chemistry', 'mathematics', 'social_science'] as const) {
        const value = (week as any)[key];
        if (value?.topic) {
          row[key] = {
            topic: String(value.topic).trim(),
            subtopics: Array.isArray(value.subtopics) ? value.subtopics.map(String).filter(Boolean) : [],
          };
        }
      }
      if (preferred && !row[preferred]) {
        const anyTopic = (week as any).topic || (week as any).chapter || (week as any).title;
        if (anyTopic) row[preferred] = { topic: String(anyTopic).trim(), subtopics: [] };
      }
      return row;
    })
    .filter((week) => week.physics || week.chemistry || week.mathematics || week.social_science);

  return {
    weekly_schedule: normalized.length ? normalized : fallbackSchedule(subject),
    detected_class: result.detected_class,
    detected_subjects: result.detected_subjects,
    confidence: normalized.length ? (result.confidence || 'medium') : 'low',
  };
}

serve(async (req: Request) => {
  const cors = getCors(req);
  const corsHeaders = cors.headers;
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const sbAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { class_id, pages, subject } = await req.json();
    if (!class_id) throw new Error('class_id is required');
    if (!Array.isArray(pages) || pages.length === 0) throw new Error('pages array is required');

    const { data: classRow, error: classErr } = await sbAdmin
      .from('classes')
      .select('id, teacher_id, subject, name')
      .eq('id', class_id)
      .maybeSingle();
    if (classErr || !classRow) throw new Error('Class not found');
    if (classRow.teacher_id !== user.id) throw new Error('Only the class teacher can scan this curriculum');

    const messages: GeminiMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Class name: ${classRow.name || ''}\nSubject: ${subject || classRow.subject || ''}\nExtract the curriculum from these PDF page images.` },
          ...pages.slice(0, 12).map((pageDataUrl: string) => ({ type: 'image' as const, dataUrl: pageDataUrl })),
        ],
      },
    ];

    const raw = await callGeminiJSON<CurriculumScanResult>(messages, { temperature: 0.1, maxOutputTokens: 8192 });
    const parsed = normalizeResult(raw, subject || classRow.subject);

    const { error: rpcErr } = await sbAdmin.rpc('insert_scanned_curriculum_hierarchy', {
      p_class_id: class_id,
      p_weekly_schedule: parsed,
    });
    if (rpcErr) throw rpcErr;

    const { error: roadmapErr } = await sbAdmin
      .from('student_roadmaps')
      .update({ custom_overrides: parsed })
      .eq('class_id', class_id)
      .is('template_id', null);
    if (roadmapErr) console.warn('Failed to update class roadmaps:', roadmapErr);

    const { error: ensureErr } = await sbAdmin.rpc('ensure_school_roadmaps_for_class', { p_class_id: class_id });
    if (ensureErr) console.warn('Failed to ensure class roadmaps:', ensureErr);

    return new Response(JSON.stringify({
      success: true,
      weeks: parsed.weekly_schedule.length,
      curriculum: parsed,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('scan-curriculum-file error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Scan failed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
