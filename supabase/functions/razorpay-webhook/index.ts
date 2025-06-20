const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Razorpay-Signature",
};

interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: any;
    };
    subscription?: {
      entity: any;
    };
  };
  created_at: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Verify webhook signature
    const signature = req.headers.get("X-Razorpay-Signature");
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    
    if (!webhookSecret) {
      console.error("Webhook secret not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const body = await req.text();
    
    // Verify signature
    const crypto = await import("node:crypto");
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.error("Invalid webhook signature");
      return new Response("Invalid signature", { status: 400 });
    }

    const payload: RazorpayWebhookPayload = JSON.parse(body);
    console.log("Received webhook:", payload.event);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    // Handle different webhook events
    switch (payload.event) {
      case "payment.captured":
        await handlePaymentCaptured(payload, supabaseUrl, supabaseServiceKey);
        break;
      
      case "subscription.activated":
        await handleSubscriptionActivated(payload, supabaseUrl, supabaseServiceKey);
        break;
      
      case "subscription.charged":
        await handleSubscriptionCharged(payload, supabaseUrl, supabaseServiceKey);
        break;
      
      case "subscription.cancelled":
        await handleSubscriptionCancelled(payload, supabaseUrl, supabaseServiceKey);
        break;
      
      case "subscription.completed":
        await handleSubscriptionCompleted(payload, supabaseUrl, supabaseServiceKey);
        break;
      
      default:
        console.log(`Unhandled webhook event: ${payload.event}`);
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

async function handlePaymentCaptured(payload: RazorpayWebhookPayload, supabaseUrl: string, supabaseServiceKey: string) {
  const payment = payload.payload.payment?.entity;
  if (!payment) return;

  console.log("Payment captured:", payment.id);

  // Check if this is a subscription payment
  if (payment.notes && payment.notes.user_email) {
    // Find user by email
    const userResponse = await fetch(`${supabaseUrl}/rest/v1/user_profiles?select=id&email=eq.${payment.notes.user_email}`, {
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
      },
    });

    if (userResponse.ok) {
      const users = await userResponse.json();
      if (users.length > 0) {
        const userId = users[0].id;
        
        // Create or update subscription
        await createOrUpdateSubscription(userId, payment, supabaseUrl, supabaseServiceKey);
      }
    }
  }
}

async function handleSubscriptionActivated(payload: RazorpayWebhookPayload, supabaseUrl: string, supabaseServiceKey: string) {
  const subscription = payload.payload.subscription?.entity;
  if (!subscription) return;

  console.log("Subscription activated:", subscription.id);

  // Extract user info from subscription notes
  const userId = subscription.notes?.user_id;
  if (!userId) {
    console.error("No user_id found in subscription notes");
    return;
  }

  // Update subscription status
  await fetch(`${supabaseUrl}/rest/v1/subscriptions?razorpay_subscription_id=eq.${subscription.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseServiceKey}`,
      "apikey": supabaseServiceKey,
    },
    body: JSON.stringify({
      status: 'active',
      current_period_start: new Date(subscription.current_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
}

async function handleSubscriptionCharged(payload: RazorpayWebhookPayload, supabaseUrl: string, supabaseServiceKey: string) {
  const subscription = payload.payload.subscription?.entity;
  if (!subscription) return;

  console.log("Subscription charged:", subscription.id);

  // Update subscription period
  await fetch(`${supabaseUrl}/rest/v1/subscriptions?razorpay_subscription_id=eq.${subscription.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseServiceKey}`,
      "apikey": supabaseServiceKey,
    },
    body: JSON.stringify({
      current_period_start: new Date(subscription.current_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
}

async function handleSubscriptionCancelled(payload: RazorpayWebhookPayload, supabaseUrl: string, supabaseServiceKey: string) {
  const subscription = payload.payload.subscription?.entity;
  if (!subscription) return;

  console.log("Subscription cancelled:", subscription.id);

  // Update subscription status
  await fetch(`${supabaseUrl}/rest/v1/subscriptions?razorpay_subscription_id=eq.${subscription.id}`, {
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
  });
}

async function handleSubscriptionCompleted(payload: RazorpayWebhookPayload, supabaseUrl: string, supabaseServiceKey: string) {
  const subscription = payload.payload.subscription?.entity;
  if (!subscription) return;

  console.log("Subscription completed:", subscription.id);

  // Update subscription status
  await fetch(`${supabaseUrl}/rest/v1/subscriptions?razorpay_subscription_id=eq.${subscription.id}`, {
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
  });
}

async function createOrUpdateSubscription(userId: string, payment: any, supabaseUrl: string, supabaseServiceKey: string) {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days trial
  const periodEnd = new Date(trialEnd.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days after trial

  const subscriptionData = {
    user_id: userId,
    razorpay_subscription_id: payment.id,
    plan_id: 'premium_monthly',
    status: 'trial',
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    trial_start: now.toISOString(),
    trial_end: trialEnd.toISOString(),
  };

  // Try to update existing subscription first
  const updateResponse = await fetch(`${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseServiceKey}`,
      "apikey": supabaseServiceKey,
    },
    body: JSON.stringify(subscriptionData),
  });

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
}