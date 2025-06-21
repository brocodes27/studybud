const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Pabbly-Signature",
};

interface PabblyWebhookPayload {
  event_type: string;
  subscription_id: string;
  customer_email: string;
  customer_name: string;
  plan_id: string;
  status: string;
  amount: number;
  currency: string;
  trial_start?: string;
  trial_end?: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  custom_fields?: {
    user_id?: string;
    subscription_id?: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.text();
    const payload: PabblyWebhookPayload = JSON.parse(body);
    
    console.log("Received Pabbly webhook:", payload.event_type, payload);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    // Handle different webhook events
    switch (payload.event_type) {
      case "subscription.created":
      case "subscription.activated":
        await handleSubscriptionActivated(payload, supabaseUrl, supabaseServiceKey);
        break;
      
      case "subscription.payment_succeeded":
        await handlePaymentSucceeded(payload, supabaseUrl, supabaseServiceKey);
        break;
      
      case "subscription.cancelled":
        await handleSubscriptionCancelled(payload, supabaseUrl, supabaseServiceKey);
        break;
      
      case "subscription.expired":
        await handleSubscriptionExpired(payload, supabaseUrl, supabaseServiceKey);
        break;
      
      default:
        console.log(`Unhandled webhook event: ${payload.event_type}`);
    }

    return new Response("OK", {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Internal Server Error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});

async function handleSubscriptionActivated(payload: PabblyWebhookPayload, supabaseUrl: string, supabaseServiceKey: string) {
  console.log("Subscription activated:", payload.subscription_id);
  console.log("Pabbly Webhook Payload custom_fields:", payload.custom_fields);
  console.log("Pabbly Webhook Payload customer_email:", payload.customer_email);

  // Find user by email or custom fields
  let userId = payload.custom_fields?.user_id;
  console.log("Derived userId:", userId);
  
  if (!userId) {
    // Try to find user by email
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
      },
    });

    if (userResponse.ok) {
      const users = await userResponse.json();
      const user = users.users?.find((u: any) => u.email === payload.customer_email);
      if (user) {
        userId = user.id;
      }
    }
  }

  if (!userId) {
    console.error("Could not find user for email:", payload.customer_email);
    return;
  }

  // Determine subscription status
  const now = new Date();
  const trialEnd = payload.trial_end ? new Date(payload.trial_end) : null;
  const status = trialEnd && now < trialEnd ? 'trial' : 'active';

  // Create or update subscription
  const subscriptionData = {
    user_id: userId,
    pabbly_subscription_id: payload.subscription_id,
    plan_id: payload.plan_id || 'stubud_pro',
    status: status,
    current_period_start: payload.current_period_start,
    current_period_end: payload.current_period_end,
    trial_end: payload.trial_end || null,
    updated_at: new Date().toISOString(),
  };
  console.log("Subscription Data being sent to Supabase:", subscriptionData);

  // Try to update existing subscription first
  const updateResponse = await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
      },
      body: JSON.stringify(subscriptionData),
    }
  );

  // If no rows were updated, create new subscription
  if (updateResponse.ok) {
    const result = await updateResponse.text();
    if (!result || result === '[]') {
      // No existing subscription found, create new one
      await fetch(`${supabaseUrl}/rest/v1/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
        body: JSON.stringify(subscriptionData),
      });
    }
  }

  console.log(`Subscription ${status} for user ${userId}`);
}
    user_id: userId,
    pabbly_subscription_id: payload.subscription_id,
    plan_id: payload.plan_id || 'stubud_pro',
    status: status,
    current_period_start: payload.current_period_start,
    current_period_end: payload.current_period_end,
    trial_end: payload.trial_end || null,
    updated_at: new Date().toISOString(),
  };

  // Try to update existing subscription first
  const updateResponse = await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
      },
      body: JSON.stringify(subscriptionData),
    }
  );

  // If no rows were updated, create new subscription
  if (updateResponse.ok) {
    const result = await updateResponse.text();
    if (!result || result === '[]') {
      // No existing subscription found, create new one
      await fetch(`${supabaseUrl}/rest/v1/subscriptions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "apikey": supabaseServiceKey,
        },
        body: JSON.stringify(subscriptionData),
      });
    }
  }

  console.log(`Subscription ${status} for user ${userId}`);
}

async function handlePaymentSucceeded(payload: PabblyWebhookPayload, supabaseUrl: string, supabaseServiceKey: string) {
  console.log("Payment succeeded:", payload.subscription_id);

  // Update subscription period
  await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?pabbly_subscription_id=eq.${payload.subscription_id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
      },
      body: JSON.stringify({
        status: 'active',
        current_period_start: payload.current_period_start,
        current_period_end: payload.current_period_end,
        updated_at: new Date().toISOString(),
      }),
    }
  );
}

async function handleSubscriptionCancelled(payload: PabblyWebhookPayload, supabaseUrl: string, supabaseServiceKey: string) {
  console.log("Subscription cancelled:", payload.subscription_id);

  // Update subscription status
  await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?pabbly_subscription_id=eq.${payload.subscription_id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
      },
      body: JSON.stringify({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }
  );
}

async function handleSubscriptionExpired(payload: PabblyWebhookPayload, supabaseUrl: string, supabaseServiceKey: string) {
  console.log("Subscription expired:", payload.subscription_id);

  // Update subscription status
  await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?pabbly_subscription_id=eq.${payload.subscription_id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
      },
      body: JSON.stringify({
        status: 'expired',
        updated_at: new Date().toISOString(),
      }),
    }
  );
}