import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function isEventProcessed(
  supabase: SupabaseClient,
  eventId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("processed_webhooks")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("Idempotency check error:", error);
    return false;
  }

  return !!data;
}

export async function markEventProcessed(
  supabase: SupabaseClient,
  eventId: string,
  source: "dodo" | "paypal" | "razorpay",
  eventType?: string,
  payload?: any
): Promise<void> {
  const { error } = await supabase
    .from("processed_webhooks")
    .insert({
      event_id: eventId,
      source,
      event_type: eventType || null,
      payload: payload || null,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error("Failed to mark event as processed:", error);
  }
}
