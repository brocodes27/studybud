import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCors } from "../_shared/cors.ts";
import { isPassPlan, validPassProduct } from "../_shared/curve-billing.ts";

serve(async (req) => {
  const cors = getCors(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors.headers, "Content-Type": "application/json" },
    });
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: cors.headers });
  if (!cors.allowed) return json({ error: "Origin not allowed" }, 403);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("authorization") || "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );
    const {
      data: { user },
    } = await sb.auth.getUser(authorization.replace(/^Bearer /i, ""));
    if (!user?.email)
      return json({ error: "Sign in again to choose your plan." }, 401);
    const { plan } = await req.json();
    if (!isPassPlan(plan)) return json({ error: "Choose a valid plan." }, 400);
    const { data: preferences, error: preferencesError } = await sb
      .from("curve_study_preferences")
      .select("completed")
      .eq("user_id", user.id)
      .maybeSingle();
    if (preferencesError || !preferences?.completed)
      return json(
        { error: "Finish your study setup before choosing a plan." },
        409,
      );
    const { data: paid, error: accessError } = await sb.rpc(
      "curve_has_paid_access",
    );
    if (accessError)
      return json(
        { error: "Unable to check your current plan. Please retry." },
        503,
      );
    if (paid)
      return json(
        {
          error:
            "Your plan is already active. Check your access to open the workspace.",
        },
        409,
      );
    const key = Deno.env.get("DODO_PAYMENTS_API_KEY");
    const productId = Deno.env.get(
      plan === "semester" ? "DODO_SEMESTER_PRODUCT_ID" : "DODO_PRODUCT_ID",
    );
    if (!key || !productId || !Deno.env.get("DODO_PAYMENTS_WEBHOOK_KEY"))
      return json(
        {
          error:
            "This plan is not available for checkout yet. Please contact support.",
        },
        503,
      );
    const base =
      Deno.env.get("DODO_TEST_MODE") === "true"
        ? "https://test.dodopayments.com"
        : "https://live.dodopayments.com";
    const headers = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    };
    const productResponse = await fetch(
      `${base}/products/${encodeURIComponent(productId)}`,
      { headers, signal: AbortSignal.timeout(15000) },
    );
    if (
      !productResponse.ok ||
      !validPassProduct(await productResponse.json(), plan)
    )
      return json(
        {
          error:
            "This plan is temporarily unavailable. Please contact support.",
        },
        503,
      );
    const origin = req.headers.get("origin") || "https://elevenfolks.com";
    const returnUrl = new URL("/subscription?checkout=returned", origin).href;
    const response = await fetch(`${base}/checkouts`, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: { email: user.email },
        return_url: returnUrl,
        metadata: { user_id: user.id, plan },
      }),
    });
    if (!response.ok)
      return json(
        { error: "Checkout is temporarily unavailable. Please try again." },
        502,
      );
    const data = await response.json();
    const url = new URL(data.checkout_url);
    if (
      url.protocol !== "https:" ||
      !(
        url.hostname === "checkout.dodopayments.com" ||
        url.hostname.endsWith(".dodopayments.com")
      )
    )
      throw new Error("Invalid checkout URL");
    return json({ url: url.href });
  } catch {
    return json({ error: "Unable to open checkout. Please try again." }, 503);
  }
});
