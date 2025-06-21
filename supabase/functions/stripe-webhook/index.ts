const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Stripe-Signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!signature || !stripeWebhookSecret) {
      throw new Error("Stripe signature or webhook secret missing");
    }

    // In a real application, you would verify the webhook signature here.
    // const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
    // const event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);

    const payload = JSON.parse(body);
    console.log("Received Stripe webhook:", payload.type, payload);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    switch (payload.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(payload.data.object, supabaseUrl, supabaseServiceKey);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(payload.data.object, supabaseUrl, supabaseServiceKey);
        break;
      default:
        console.log(`Unhandled event type ${payload.type}`);
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

async function handleSubscriptionUpdated(subscription: any, supabaseUrl: string, supabaseServiceKey: string) {
  console.log("Stripe Subscription Updated:", subscription.id);

  const stripeCustomerId = subscription.customer;
  console.log("Stripe Webhook - stripe_customer_id:", stripeCustomerId);

  // Fetch user_id from profiles table using stripeCustomerId
  const { data: userData, error: userError } = await fetch(
    `${supabaseUrl}/rest/v1/profiles?stripe_customer_id=eq.${stripeCustomerId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "apikey": supabaseServiceKey,
      },
    }
  ).then(res => res.json());

  if (userError || !userData || userData.length === 0) {
    console.error("Stripe Webhook - User not found for stripe_customer_id:", stripeCustomerId, userError);
    return;
  }

  const userId = userData[0].id;
  console.log("Stripe Webhook - stripe_subscription_id:", subscription.id);
  let status = subscription.status;
  if (status === 'trialing') {
    status = 'trial';
  } else if (status === 'active') {
    status = 'active';
  }
  const current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
  const current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
  const trial_end = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;

  const subscriptionData = {
    user_id: userId,
    stripe_subscription_id: subscription.id,
    razorpay_subscription_id: null,
    plan_id: subscription.items.data[0].price.id,
    status: status,
    current_period_start: current_period_start,
    current_period_end: current_period_end,
    trial_end: trial_end,
    updated_at: new Date().toISOString(),
  };
  console.log("Stripe Webhook - Subscription Data (PATCH/POST):");
  console.log(JSON.stringify(subscriptionData, null, 2));

  const updateResponse = await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?stripe_subscription_id=eq.${subscription.id}`,
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

  console.log("Stripe Webhook - Update Response Status:", updateResponse.status);
  const updateResponseBody = await updateResponse.text();
  console.log("Stripe Webhook - Update Response Body:", updateResponseBody);

  // If no rows were updated, create new subscription
  if (updateResponse.status === 406) { // 406 Not Acceptable typically means no rows matched for update
    console.log("Stripe Webhook - No existing subscription found, creating new one.");
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

async function handleSubscriptionDeleted(subscription: any, supabaseUrl: string, supabaseServiceKey: string) {
  console.log("Stripe Subscription Deleted:", subscription.id);

  await fetch(
    `${supabaseUrl}/rest/v1/subscriptions?stripe_subscription_id=eq.${subscription.id}`,
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