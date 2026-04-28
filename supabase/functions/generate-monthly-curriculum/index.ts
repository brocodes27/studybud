// supabase/functions/generate-monthly-curriculum/index.ts
// Generates or updates a monthly curriculum using Gemini and (optionally) Tavily, then materializes tasks
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, [TAVILY_API_KEY optional]

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { callGemini } from '../_shared/gemini.ts';
import { getCors } from '../_shared/cors.ts';

type Payload = {
  aim?: 'cbse' | 'jee';
  class_level?: string;
  subjects?: string[];
  month?: string; // YYYY-MM
  curriculum_id?: string; // optional explicit curriculum id
};

// CORS handled per-request via getCors()

function firstDayOfMonth(month?: string) {
  const now = new Date();
  const [yStr, mStr] = (month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10) - 1;
  const d = new Date(Date.UTC(y, m, 1));
  return d;
}

function lastDayOfMonth(d: Date) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0));
}

function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}

async function verifyUserAndGetId(authHeader: string, supabaseUrl: string, serviceKey: string) {
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: serviceKey },
  });
  if (!resp.ok) throw new Error('Invalid authorization token');
  const user = await resp.json();
  return user.id as string;
}

Deno.serve(async (req: Request) => {
  const cors = getCors(req);
  const corsHeaders = cors.headers;
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: 'CORS origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let stage = 'start';

  try {
    stage = 'readEnv';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const TAVILY_API_KEY = Deno.env.get('TAVILY_API_KEY') || '';
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase configuration missing');
    // TAVILY_API_KEY is optional; we will proceed without web context if it's not provided

    stage = 'checkAuthHeader';
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Authorization header required' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    stage = 'verifyUser';
    const userId = await verifyUserAndGetId(authHeader, supabaseUrl, serviceKey);

    stage = 'parseBody';
    const body = (await req.json()) as Payload;
    const aim = (body.aim || 'cbse') as 'cbse' | 'jee';
    const classLevel = (body.class_level || '').trim();
    let subjects = Array.isArray(body.subjects) ? body.subjects.filter(Boolean) : [];
    const monthStart = firstDayOfMonth(body.month);
    const monthEnd = lastDayOfMonth(monthStart);
    const monthStartStr = toISODate(monthStart);
    const monthEndStr = toISODate(monthEnd);

    // 1) Find or create curriculum plan
    stage = 'ensureCurriculum';
    let curriculumId = body.curriculum_id || '';
    if (!curriculumId) {
      const q = new URL(`${supabaseUrl}/rest/v1/curriculum_plans`);
      q.searchParams.set('user_id', `eq.${userId}`);
      q.searchParams.set('aim', `eq.${aim}`);
      q.searchParams.set('is_active', 'eq.true');
      q.searchParams.set('select', 'id,subjects,class_level');
      const curResp = await fetch(q.toString(), { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      if (!curResp.ok) throw new Error(`Failed to fetch curriculum_plans: ${await curResp.text()}`);
      const rows = await curResp.json();
      if (Array.isArray(rows) && rows.length > 0) {
        curriculumId = rows[0].id;
        if (!subjects || subjects.length === 0) subjects = rows[0]?.subjects || [];
      } else {
        // create one
        const payload = { user_id: userId, aim, class_level: classLevel || null, subjects: subjects?.length ? subjects : [] };
        const createResp = await fetch(`${supabaseUrl}/rest/v1/curriculum_plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'return=representation' },
          body: JSON.stringify(payload),
        });
        if (!createResp.ok) throw new Error(`Failed to create curriculum_plan: ${await createResp.text()}`);
        const created = await createResp.json();
        curriculumId = created[0].id;
      }
    }

    if (!subjects || subjects.length === 0) {
      return new Response(JSON.stringify({ error: 'subjects required (either in payload or associated with curriculum)' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // 2) Tavily search per subject
    stage = 'tavilySearch';
    async function searchSubject(subject: string) {
      if (!TAVILY_API_KEY) {
        return { subject, sources: [] as { title: string; url: string; content: string }[] };
      }
      try {
        const query = aim === 'cbse'
          ? `${subject} CBSE ${classLevel || ''} monthly curriculum syllabus`
          : `${subject} JEE mains syllabus monthly plan`;
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: TAVILY_API_KEY, query, search_depth: 'advanced', max_results: 6, include_answer: true, include_raw_content: true }),
        });
        if (!res.ok) return { subject, sources: [] as { title: string; url: string; content: string }[] };
        const json = await res.json();
        const items: any[] = json?.results || [];
        const sources: { title: string; url: string; content: string }[] = [];
        for (const it of items) {
          const content = it.content?.slice?.(0, 3000) || it.content || it.snippet || '';
          if (content) sources.push({ title: it.title || '', url: it.url || '', content });
        }
        return { subject, sources };
      } catch {
        return { subject, sources: [] as { title: string; url: string; content: string }[] };
      }
    }

    const chunks: string[][] = [];
    for (let i = 0; i < subjects.length; i += 4) chunks.push(subjects.slice(i, i + 4));
    const collected: Array<{ subject: string; sources: { title: string; url: string; content: string }[] }> = [];
    for (const ch of chunks) {
      const part = await Promise.all(ch.map(searchSubject));
      collected.push(...part);
    }

    // 3) OpenAI: build month plan JSON
    const context = collected.map(c => `Subject: ${c.subject}\n` + c.sources.map(s => `Title: ${s.title}\nURL: ${s.url}\n${s.content}`).join('\n\n')).join('\n\n-----\n\n');
    const system = `You are an expert academic planner for ${aim.toUpperCase()}. Given month range${TAVILY_API_KEY ? ' and web context' : ''}, produce a balanced monthly curriculum. Avoid Sundays. Distribute tasks evenly across weeks and subjects. Return STRICT JSON only.`;
    const user = `Month: ${monthStartStr}..${monthEndStr}\nAim: ${aim}\nClass Level: ${classLevel || 'N/A'}\nSubjects: ${subjects.join(', ')}\n\nReturn exactly this JSON shape:\n{\n  "month": "${monthStartStr.slice(0,7)}",\n  "weeks": [\n    {\n      "week_start": "YYYY-MM-DD",\n      "tasks": [\n        { "date": "YYYY-MM-DD", "subject": "<one of subjects>", "title": "short title", "description": "1-2 lines" }\n      ]\n    }\n  ]\n}\n\nRules:\n- Dates must be within the month and not Sunday.\n- Balance per subject across the month.\n- 1-2 tasks per weekday is fine.\n\nWeb context (no need to cite, just align topics):\n${context}`;

    stage = 'geminiRequest';
    const text = await callGemini(
      [ { role: 'system', content: system }, { role: 'user', content: user } ],
      { temperature: 0.2, maxOutputTokens: 3500, json: true }
    );
    let planJson: any = {};
    try {
      const cleaned = (text || '{}').replace(/```json|```/gi, '').trim();
      planJson = JSON.parse(cleaned);
    } catch { planJson = {}; }

    // Basic validation
    stage = 'validatePlan';
    if (!planJson?.weeks || !Array.isArray(planJson.weeks)) {
      const preview = typeof text === 'string' ? text.slice(0, 300) : '';
      return new Response(JSON.stringify({ error: 'model did not return valid plan JSON', stage, preview }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // 4) Upsert monthly_curricula
    stage = 'upsertMonthly';
    const upsertUrl = new URL(`${supabaseUrl}/rest/v1/monthly_curricula`);
    upsertUrl.searchParams.set('on_conflict', 'curriculum_id,month_start');
    const upsertResp = await fetch(upsertUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=representation,resolution=merge-duplicates',
      },
      body: JSON.stringify({ user_id: userId, curriculum_id: curriculumId, month_start: monthStartStr, month_end: monthEndStr, plan: planJson }),
    });
    if (!upsertResp.ok) throw new Error(`Failed to upsert monthly_curricula: ${await upsertResp.text()}`);
    const mc = await upsertResp.json();
    const monthlyId = mc?.[0]?.id as string;

    // 5) Materialize tasks: delete existing then insert
    stage = 'deleteOldTasks';
    const delUrl = new URL(`${supabaseUrl}/rest/v1/curriculum_tasks`);
    delUrl.searchParams.set('user_id', `eq.${userId}`);
    delUrl.searchParams.set('curriculum_id', `eq.${curriculumId}`);
    delUrl.searchParams.set('source', 'eq.monthly');
    delUrl.searchParams.append('task_date', `gte.${monthStartStr}`);
    delUrl.searchParams.append('task_date', `lte.${monthEndStr}`);
    const delResp = await fetch(delUrl.toString(), {
      method: 'DELETE',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!delResp.ok) throw new Error(`Failed to delete old tasks: ${await delResp.text()}`);

    const tasks: any[] = [];
    for (const w of planJson.weeks) {
      const arr = Array.isArray(w?.tasks) ? w.tasks : [];
      for (const t of arr) {
        if (!t?.date || !t?.subject) continue;
        tasks.push({
          user_id: userId,
          curriculum_id: curriculumId,
          source: 'monthly',
          plan_id: null,
          task_date: t.date,
          subject: t.subject,
          title: t.title || `${t.subject} study`,
          description: t.description || null,
          status: 'pending',
        });
      }
    }

    if (tasks.length > 0) {
      stage = 'insertTasks';
      const insResp = await fetch(`${supabaseUrl}/rest/v1/curriculum_tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'return=representation' },
        body: JSON.stringify(tasks),
      });
      if (!insResp.ok) throw new Error(`Failed to insert tasks: ${await insResp.text()}`);
    }

    return new Response(JSON.stringify({ ok: true, curriculum_id: curriculumId, monthly_id: monthlyId, month_start: monthStartStr, month_end: monthEndStr, tasks_inserted: tasks.length }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e: any) {
    console.error('[generate-monthly-curriculum] stage=', stage, 'error=', e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || 'Internal error', stage }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
