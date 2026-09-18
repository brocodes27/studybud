import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isPassPlan, verifyPaymentWebhook } from "../_shared/curve-billing.ts";

serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("DODO_PAYMENTS_WEBHOOK_KEY");
  if (!secret) return json({ error: "Webhook is not configured" }, 503);
  const raw = await req.text();
  if (raw.length > 200000) return json({ error: "Payload too large" }, 413);
  if (!(await verifyPaymentWebhook(raw, req.headers, secret)))
    return json({ error: "Invalid signature" }, 401);
  try {
    const event = JSON.parse(raw);
    const revoke = [
      "refund.succeeded",
      "dispute.accepted",
      "dispute.lost",
    ].includes(event.type);
    if (event.type !== "payment.succeeded" && !revoke)
      return json({ received: true });
    const paymentId = event.data?.payment_id;
    if (typeof paymentId !== "string")
      return json({ error: "Missing payment identifier" }, 400);
    // Reconcile against the provider rather than relying on checkout return parameters.
    const key = Deno.env.get("DODO_PAYMENTS_API_KEY");
    if (!key) return json({ error: "Payment verification unavailable" }, 503);
    const base =
      Deno.env.get("DODO_TEST_MODE") === "true"
        ? "https://test.dodopayments.com"
        : "https://live.dodopayments.com";
    const response = await fetch(
      `${base}/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      return json({ error: "Payment verification unavailable" }, 503);
    const payment = await response.json();
    const { user_id: userId, plan } = payment.metadata || {};
    if (
      !isPassPlan(plan) ||
      typeof userId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(userId)
    )
      return json({ received: true, ignored: true });
    const product = Deno.env.get(
      plan === "semester" ? "DODO_SEMESTER_PRODUCT_ID" : "DODO_PRODUCT_ID",
    );
    if (
      !product ||
      !payment.product_cart?.some(
        (item: { product_id: string; quantity: number }) =>
          item.product_id === product && item.quantity === 1,
      )
    )
      return json({ error: "Payment product does not match" }, 400);
    if (!revoke && payment.status !== "succeeded")
      return json({ error: "Payment not settled" }, 409);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await admin.rpc("curve_record_payment", {
      p_payment: paymentId,
      p_user: userId,
      p_plan: plan,
      p_revoke: revoke,
    });
    if (error)
      return json({ error: "Unable to record payment. Retry delivery." }, 500);
    return json({ received: true });
  } catch {
    return json({ error: "Unable to process payment event" }, 500);
  }
});
