// supabase/functions/apply-exam-to-curriculum/index.ts
// Creates an exam plan (via generate-study-plan) and integrates it into curriculum_tasks.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

type Payload = {
  class: string;
  subject: string;
  chapters: string;
  exam_date: string; // YYYY-MM-DD
  curriculum_id?: string;
  aim?: 'cbse' | 'jee'; // used only if a curriculum must be created
  update_mode?: 'mark' | 'reschedule'; // default 'mark' -> mark monthly tasks as rescheduled on overlapping dates
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function toISODate(d: Date) { return d.toISOString().split('T')[0]; }

async function verifyUserAndGetId(authHeader: string, supabaseUrl: string, serviceKey: string) {
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authHeader, apikey: serviceKey } });
  if (!resp.ok) throw new Error('Invalid authorization token');
  const user = await resp.json();
  return user.id as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!supabaseUrl || !serviceKey) throw new Error('Supabase configuration missing');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Authorization header required' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

    const userId = await verifyUserAndGetId(authHeader, supabaseUrl, serviceKey);

    const body = (await req.json()) as Payload;
    const studentClass = (body.class || '').trim();
    const subject = (body.subject || '').trim();
    const chapters = (body.chapters || '').trim();
    const examDateStr = (body.exam_date || '').trim();
    const updateMode = (body.update_mode || 'mark') as 'mark' | 'reschedule';

    if (!studentClass || !subject || !chapters || !examDateStr) {
      return new Response(JSON.stringify({ error: 'class, subject, chapters, exam_date are required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // 1) Ensure curriculum exists or get active
    let curriculumId = body.curriculum_id || '';
    if (!curriculumId) {
      const q = new URL(`${supabaseUrl}/rest/v1/curriculum_plans`);
      q.searchParams.set('user_id', `eq.${userId}`);
      q.searchParams.set('is_active', 'eq.true');
      q.searchParams.set('select', 'id');
      const curResp = await fetch(q.toString(), { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      if (!curResp.ok) throw new Error(`Failed to fetch curriculum_plans: ${await curResp.text()}`);
      const rows = await curResp.json();
      if (Array.isArray(rows) && rows.length > 0) {
        curriculumId = rows[0].id;
      } else {
        // Create a default curriculum if none exists
        const aim = (body.aim || 'cbse') as 'cbse' | 'jee';
        const createResp = await fetch(`${supabaseUrl}/rest/v1/curriculum_plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'return=representation' },
          body: JSON.stringify({ user_id: userId, aim, class_level: null, subjects: [subject] }),
        });
        if (!createResp.ok) throw new Error(`Failed to create curriculum_plan: ${await createResp.text()}`);
        const created = await createResp.json();
        curriculumId = created[0].id;
      }
    }

    // 2) Call generate-study-plan using user's token
    const genUrl = `${supabaseUrl}/functions/v1/generate-study-plan`;
    const genResp = await fetch(genUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ class: studentClass, subject, chapters, exam_date: examDateStr }),
    });
    const genText = await genResp.text();
    if (!genResp.ok) throw new Error(`generate-study-plan failed: ${genResp.status} ${genText}`);

    let studyPlan: any = {};
    try { studyPlan = JSON.parse(genText); } catch { studyPlan = {}; }

    // 3) Fetch the inserted exam_plan id
    const planQ = new URL(`${supabaseUrl}/rest/v1/exam_plans`);
    planQ.searchParams.set('user_id', `eq.${userId}`);
    planQ.searchParams.set('class', `eq.${studentClass}`);
    planQ.searchParams.set('subject', `eq.${subject}`);
    planQ.searchParams.set('exam_date', `eq.${examDateStr}`);
    planQ.searchParams.set('select', 'id,plan,created_at');
    planQ.searchParams.set('order', 'created_at.desc');
    planQ.searchParams.set('limit', '1');
    const planResp = await fetch(planQ.toString(), { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!planResp.ok) throw new Error(`Failed to fetch exam plan: ${await planResp.text()}`);
    const planRows = await planResp.json();
    if (!Array.isArray(planRows) || planRows.length === 0) throw new Error('Exam plan not found after generation');
    const planId = planRows[0].id as string;
    const planObj = planRows[0].plan || studyPlan || {};

    const schedule = Array.isArray(planObj?.daily_schedule) ? planObj.daily_schedule : [];
    const tasks: any[] = [];
    const examDates = new Set<string>();

    for (const d of schedule) {
      const dateStr = (d?.date || '').toString();
      if (!dateStr) continue;
      examDates.add(dateStr);
      tasks.push({
        user_id: userId,
        curriculum_id: curriculumId,
        source: 'exam',
        plan_id: planId,
        task_date: dateStr,
        subject: subject,
        title: d?.topic || `${subject} study`,
        description: d?.description || null,
        status: 'pending',
      });
    }

    if (tasks.length > 0) {
      const insResp = await fetch(`${supabaseUrl}/rest/v1/curriculum_tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'return=representation' },
        body: JSON.stringify(tasks),
      });
      if (!insResp.ok) throw new Error(`Failed to insert exam tasks: ${await insResp.text()}`);
    }

    // 4) Update main curriculum according to exam plan
    let affected = 0;
    if (examDates.size > 0) {
      const dateList = Array.from(examDates);
      if (updateMode === 'mark') {
        // Mark overlapping monthly tasks as rescheduled
        const patchUrl = new URL(`${supabaseUrl}/rest/v1/curriculum_tasks`);
        patchUrl.searchParams.set('user_id', `eq.${userId}`);
        patchUrl.searchParams.set('curriculum_id', `eq.${curriculumId}`);
        patchUrl.searchParams.set('source', 'eq.monthly');
        patchUrl.searchParams.set('task_date', `in.(${dateList.join(',')})`);
        const patchResp = await fetch(patchUrl.toString(), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'return=representation' },
          body: JSON.stringify({ status: 'rescheduled' }),
        });
        if (!patchResp.ok) throw new Error(`Failed to update overlapping monthly tasks: ${await patchResp.text()}`);
        const patched = await patchResp.json();
        affected = Array.isArray(patched) ? patched.length : 0;
      } else {
        // Optional: implement reschedule strategy (shift to next available weekday after exam period)
        // Fetch overlapping monthly tasks
        const getUrl = new URL(`${supabaseUrl}/rest/v1/curriculum_tasks`);
        getUrl.searchParams.set('user_id', `eq.${userId}`);
        getUrl.searchParams.set('curriculum_id', `eq.${curriculumId}`);
        getUrl.searchParams.set('source', 'eq.monthly');
        getUrl.searchParams.set('task_date', `in.(${dateList.join(',')})`);
        getUrl.searchParams.set('select', 'id,task_date');
        const getResp = await fetch(getUrl.toString(), { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
        if (!getResp.ok) throw new Error(`Failed to fetch overlapping tasks: ${await getResp.text()}`);
        const rows = await getResp.json();

        // Shift each to the next Monday after last exam date
        const lastDate = dateList.sort().slice(-1)[0];
        let cursor = new Date(lastDate + 'T00:00:00Z');
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        // Avoid Sundays
        const nextValid = () => {
          while (cursor.getUTCDay() === 0) cursor.setUTCDate(cursor.getUTCDate() + 1);
          const s = toISODate(cursor);
          cursor.setUTCDate(cursor.getUTCDate() + 1);
          return s;
        };

        const updates = rows.map((r: any) => ({ id: r.id, task_date: nextValid() }));
        if (updates.length > 0) {
          const upUrl = new URL(`${supabaseUrl}/rest/v1/curriculum_tasks`);
          upUrl.searchParams.set('on_conflict', 'id');
          const upResp = await fetch(upUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify(updates),
          });
          if (!upResp.ok) throw new Error(`Failed to reschedule monthly tasks: ${await upResp.text()}`);
          affected = updates.length;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, curriculum_id: curriculumId, exam_plan_id: planId, exam_tasks_inserted: tasks.length, monthly_tasks_adjusted: affected }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
