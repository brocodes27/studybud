export type PassPlan = "monthly" | "semester";
export function isPassPlan(value: unknown): value is PassPlan {
  return value === "monthly" || value === "semester";
}
export const passPrice = { monthly: 1299, semester: 3900 };
export function validPassProduct(product: any, plan: PassPlan) {
  return (
    product?.is_recurring === false &&
    product?.price?.type === "one_time_price" &&
    product.price.currency === "USD" &&
    product.price.price === passPrice[plan] &&
    !product.price.pay_what_you_want &&
    !product.price.discount
  );
}
// Standard Webhooks signs id.timestamp.rawBody using the base64-decoded secret.
export async function verifyPaymentWebhook(
  raw: string,
  headers: Headers,
  secret: string,
  now = Date.now(),
) {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (
    !secret ||
    !id ||
    !timestamp ||
    !signatures ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300
  )
    return false;
  try {
    const bytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) =>
      c.charCodeAt(0),
    );
    const key = await crypto.subtle.importKey(
      "raw",
      bytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signed = new TextEncoder().encode(`${id}.${timestamp}.${raw}`);
    for (const signature of signatures.split(" ")) {
      const [version, value] = signature.split(",");
      if (version !== "v1" || !value) continue;
      const sig = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
      if (await crypto.subtle.verify("HMAC", key, sig, signed)) return true;
    }
  } catch {
    return false;
  }
  return false;
}
