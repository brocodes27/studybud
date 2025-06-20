const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface CreateSubscriptionRequest {
  plan_id: string;
  user_email: string;
  user_name: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get the authorization header to extract user info
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract JWT token and verify user
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        "Authorization": authHeader,
        "apikey": supabaseServiceKey,
      },
    });

    if (!userResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Invalid authorization token" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userData = await userResponse.json();
    const userId = userData.id;

    const { plan_id, user_email, user_name }: CreateSubscriptionRequest = await req.json();

    // Get Razorpay credentials
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeyId || !razorpayKeySecret) {
      throw new Error("Razorpay credentials not configured");
    }

    // Get plan details from database
    const planResponse = await fetch(`${supabaseUrl}/rest/v1/subscription_plans?id=eq.${plan_id}`, {
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
      },
    });

    if (!planResponse.ok) {
      throw new Error("Failed to fetch plan details");
    }

    const plans = await planResponse.json();
    if (!plans || plans.length === 0) {
      throw new Error("Plan not found");
    }

    const plan = plans[0];

    // Create or get Razorpay customer
    const customerData = {
      name: user_name,
      email: user_email,
      contact: "", // Optional
    };

    const customerResponse = await fetch("https://api.razorpay.com/v1/customers", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(customerData),
    });

    if (!customerResponse.ok) {
      const errorData = await customerResponse.json();
      throw new Error(`Failed to create customer: ${errorData.error?.description || 'Unknown error'}`);
    }

    const customer = await customerResponse.json();

    // Create Razorpay plan if it doesn't exist
    const razorpayPlanData = {
      period: plan.interval_type === 'monthly' ? 'monthly' : 'yearly',
      interval: 1,
      item: {
        name: plan.name,
        amount: plan.price, // Amount in paise
        currency: plan.currency,
        description: plan.description,
      },
    };

    const planCreateResponse = await fetch("https://api.razorpay.com/v1/plans", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(razorpayPlanData),
    });

    let razorpayPlan;
    if (planCreateResponse.ok) {
      razorpayPlan = await planCreateResponse.json();
    } else {
      // Plan might already exist, try to fetch it
      const existingPlanResponse = await fetch(`https://api.razorpay.com/v1/plans`, {
        headers: {
          "Authorization": `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
        },
      });

      if (existingPlanResponse.ok) {
        const existingPlans = await existingPlanResponse.json();
        razorpayPlan = existingPlans.items.find((p: any) => 
          p.item.name === plan.name && p.item.amount === plan.price
        );
      }

      if (!razorpayPlan) {
        throw new Error("Failed to create or find Razorpay plan");
      }
    }

    // Create subscription
    const subscriptionData = {
      plan_id: razorpayPlan.id,
      customer_id: customer.id,
      quantity: 1,
      total_count: 12, // 12 billing cycles for monthly plan
      start_at: Math.floor(Date.now() / 1000), // Current timestamp
      expire_by: Math.floor((Date.now() + (365 * 24 * 60 * 60 * 1000)) / 1000), // 1 year from now
      addons: [],
      notes: {
        user_id: userId,
        plan_id: plan_id,
      },
    };

    // Add trial period if applicable
    if (plan.trial_days > 0) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + plan.trial_days);
      subscriptionData.start_at = Math.floor(trialEnd.getTime() / 1000);
    }

    const subscriptionResponse = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscriptionData),
    });

    if (!subscriptionResponse.ok) {
      const errorData = await subscriptionResponse.json();
      throw new Error(`Failed to create subscription: ${errorData.error?.description || 'Unknown error'}`);
    }

    const subscription = await subscriptionResponse.json();

    // Save subscription to database
    const now = new Date();
    const trialStart = plan.trial_days > 0 ? now : null;
    const trialEnd = plan.trial_days > 0 ? new Date(now.getTime() + (plan.trial_days * 24 * 60 * 60 * 1000)) : null;
    const periodStart = trialEnd || now;
    const periodEnd = new Date(periodStart.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

    const dbSubscription = {
      user_id: userId,
      razorpay_subscription_id: subscription.id,
      razorpay_customer_id: customer.id,
      plan_id: plan_id,
      status: plan.trial_days > 0 ? 'trial' : 'active',
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      trial_start: trialStart?.toISOString() || null,
      trial_end: trialEnd?.toISOString() || null,
    };

    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
        "Prefer": "return=representation",
      },
      body: JSON.stringify(dbSubscription),
    });

    if (!dbResponse.ok) {
      const errorText = await dbResponse.text();
      console.error("Database error:", errorText);
      throw new Error(`Failed to save subscription: ${dbResponse.status}`);
    }

    return new Response(
      JSON.stringify({
        subscription,
        customer,
        plan: razorpayPlan,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating subscription:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to create subscription", 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});