// @ts-nocheck
import { getCors } from "../_shared/cors.ts";
// CORS handled per-request via getCors()

interface ReshuffleRequest {
  plan_id: string;
  days: number;
  constraints?: string;
}

Deno.serve(async (req: Request) => {
  const cors = getCors(req);
  const corsHeaders = cors.headers;
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: "CORS origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
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

    const body: ReshuffleRequest = await req.json();
    const { plan_id, days, constraints } = body;
    if (!plan_id || !Number.isFinite(days) || days <= 0) {
      return new Response(JSON.stringify({ error: "plan_id and positive days are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch plan, ensuring it belongs to the user
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

    // Simple reshuffle strategy: shift all schedule dates >= today by `days`
    const todayStr = new Date().toISOString().split('T')[0];
    const addDays = (dateStr: string, n: number) => {
      const d = new Date(dateStr + 'T00:00:00');
      d.setDate(d.getDate() + n);
      return d.toISOString().split('T')[0];
    };

    let updatedPlan = plan.plan;
    if (!updatedPlan || !Array.isArray(updatedPlan?.daily_schedule)) {
      return new Response(JSON.stringify({ error: "Plan JSON invalid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shifted = updatedPlan.daily_schedule.map((day: any) => {
      if (!day?.date) return day;
      if (day.date >= todayStr) {
        return { ...day, date: addDays(day.date, days) };
      }
      return day;
    });

    // Optionally, honor simple constraints text by excluding Sundays: if constraints contains 'sunday off'
    if ((constraints || '').toLowerCase().includes('sunday')) {
      // Ensure no item is placed on Sunday; if so, push by 1 day
      const isSunday = (ds: string) => new Date(ds + 'T00:00:00').getDay() === 0; // 0 = Sunday
      for (let i = 0; i < shifted.length; i++) {
        let ds = shifted[i]?.date;
        if (ds && ds >= todayStr && isSunday(ds)) {
          // push forward until non-Sunday
          while (isSunday(ds)) {
            ds = addDays(ds, 1);
          }
          shifted[i] = { ...shifted[i], date: ds };
        }
      }
    }

    updatedPlan = { ...updatedPlan, daily_schedule: shifted };

    // Persist update
    const updateResp = await fetch(`${supabaseUrl}/rest/v1/exam_plans?id=eq.${plan_id}&user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ plan: updatedPlan }),
    });

    if (!updateResp.ok) {
      const txt = await updateResp.text();
      throw new Error(`Failed to update plan: ${txt}`);
    }

    const updated = await updateResp.json();

    return new Response(JSON.stringify({ ok: true, plan: updated[0]?.plan }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('reshuffle-plan error', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
