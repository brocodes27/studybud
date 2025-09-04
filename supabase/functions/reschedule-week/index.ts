// supabase/functions/reschedule-week/index.ts
// Reschedule monthly curriculum tasks to fit within a single week (Mon-Sat), keeping exam tasks intact.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

type Payload = {
  curriculum_id?: string;
  week_start?: string; // YYYY-MM-DD (Monday). If omitted, current week's Monday.
  include_sources?: Array<'monthly' | 'manual'>; // sources to reschedule; default: ['monthly']
  constraints?: string; // e.g., 'sunday off'
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function toISODate(d: Date) { return d.toISOString().split('T')[0]; }
function mondayOfWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

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
    const includeSources = (Array.isArray(body?.include_sources) && body.include_sources.length)
      ? body.include_sources
      : ['monthly'];

    let weekStart: Date;
    if (body?.week_start) {
      weekStart = new Date(body.week_start + 'T00:00:00Z');
    } else {
      weekStart = mondayOfWeek(new Date());
    }
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6); // Monday..Sunday

    const weekStartStr = toISODate(weekStart);
    const weekEndStr = toISODate(weekEnd);

    // Determine curriculum_id if not given: pick active one
    let curriculumId = body?.curriculum_id || '';
    if (!curriculumId) {
      const q = new URL(`${supabaseUrl}/rest/v1/curriculum_plans`);
      q.searchParams.set('user_id', `eq.${userId}`);
      q.searchParams.set('is_active', 'eq.true');
      q.searchParams.set('select', 'id');
      const curResp = await fetch(q.toString(), { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
      if (!curResp.ok) throw new Error(`Failed to fetch curriculum_plans: ${await curResp.text()}`);
      const rows = await curResp.json();
      if (!Array.isArray(rows) || rows.length === 0) return new Response(JSON.stringify({ error: 'No active curriculum found' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      curriculumId = rows[0].id;
    }

    // Fetch tasks in week
    const tasksUrl = new URL(`${supabaseUrl}/rest/v1/curriculum_tasks`);
    tasksUrl.searchParams.set('user_id', `eq.${userId}`);
    tasksUrl.searchParams.set('curriculum_id', `eq.${curriculumId}`);
    tasksUrl.searchParams.append('task_date', `gte.${weekStartStr}`);
    tasksUrl.searchParams.append('task_date', `lte.${weekEndStr}`);
    tasksUrl.searchParams.set('select', 'id,task_date,source,status,subject,title,description');
    tasksUrl.searchParams.set('order', 'task_date.asc');
    const tasksResp = await fetch(tasksUrl.toString(), { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    if (!tasksResp.ok) throw new Error(`Failed to fetch tasks: ${await tasksResp.text()}`);
    const tasks = await tasksResp.json();

    const monthlyTasks = tasks.filter((t: any) => includeSources.includes(t.source));
    const fixedTasks = tasks.filter((t: any) => !includeSources.includes(t.source)); // keep as-is (e.g., exam)

    // Build target weekdays Mon..Sat (exclude Sunday)
    const targetDays: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(weekStart);
      d.setUTCDate(weekStart.getUTCDate() + i);
      targetDays.push(toISODate(d));
    }

    // Assign monthly tasks round-robin across targetDays
    const updates: any[] = [];
    for (let i = 0; i < monthlyTasks.length; i++) {
      const t = monthlyTasks[i];
      const newDate = targetDays[i % targetDays.length];
      if (t.task_date !== newDate) {
        updates.push({ id: t.id, task_date: newDate });
      }
    }

    if (updates.length > 0) {
      // Bulk upsert by id to update task_date
      const upsertUrl = new URL(`${supabaseUrl}/rest/v1/curriculum_tasks`);
      upsertUrl.searchParams.set('on_conflict', 'id');
      const upResp = await fetch(upsertUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(updates),
      });
      if (!upResp.ok) throw new Error(`Failed to update tasks: ${await upResp.text()}`);
    }

    return new Response(JSON.stringify({ ok: true, week_start: weekStartStr, week_end: weekEndStr, tasks_considered: tasks.length, monthly_moved: updates.length }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
