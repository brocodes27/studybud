// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Vary": "Origin"
};

interface MaterializeRequest {
  plan_id: string;
  overwrite_status?: boolean; // if true, reset status to pending for all days
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    // Verify token and get user id
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: supabaseServiceKey,
      },
    });
    if (!userResponse.ok) {
      return new Response(JSON.stringify({ error: "Invalid authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userData = await userResponse.json();
    const userId = userData.id;

    const { plan_id, overwrite_status }: MaterializeRequest = await req.json();
    if (!plan_id) {
      return new Response(JSON.stringify({ error: "plan_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch plan and ensure ownership
    const planResp = await fetch(
      `${supabaseUrl}/rest/v1/exam_plans?id=eq.${plan_id}&user_id=eq.${userId}`,
      {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      }
    );
    if (!planResp.ok) {
      const txt = await planResp.text();
      throw new Error(`Failed to fetch plan: ${txt}`);
    }
    const plans = await planResp.json();
    if (!Array.isArray(plans) || plans.length === 0) {
      return new Response(JSON.stringify({ error: "Plan not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const plan = plans[0];

    const schedule = plan?.plan?.daily_schedule;
    if (!Array.isArray(schedule)) {
      return new Response(JSON.stringify({ error: "Plan JSON invalid: daily_schedule missing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build rows for upsert
    const rows = schedule
      .filter((d: any) => typeof d?.day === 'number')
      .map((d: any) => ({
        plan_id,
        day: d.day,
        task_date: d.date || null,
        topic: d.topic || null,
        description: d.description || null,
        ...(overwrite_status ? { status: 'pending', completed_at: null } : {}),
      }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No tasks to materialize' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert into plan_tasks on (plan_id, day)
    const upsertResp = await fetch(
      `${supabaseUrl}/rest/v1/plan_tasks?on_conflict=plan_id,day`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
          Prefer: 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify(rows),
      }
    );

    if (!upsertResp.ok) {
      const txt = await upsertResp.text();
      throw new Error(`Failed to upsert plan_tasks: ${txt}`);
    }

    const updated = await upsertResp.json();

    return new Response(JSON.stringify({ ok: true, count: updated?.length || 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('materialize-plan-tasks error', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
