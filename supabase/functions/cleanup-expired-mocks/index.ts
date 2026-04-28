// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCors } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// CORS handled per-request via getCors()

function extractAssignmentsKey(publicUrl?: string | null): string | null {
  if (!publicUrl) return null;
  // Typical public URL: https://<proj>.supabase.co/storage/v1/object/public/assignments/<key>
  const marker = "/storage/v1/object/public/assignments/";
  const idx = publicUrl.indexOf(marker);
  if (idx !== -1) return publicUrl.slice(idx + marker.length);
  // Fallback: if someone passed a key already
  if (!publicUrl.includes("http")) return publicUrl.replace(/^\/+/, "");
  return null;
}

serve(async (req: Request) => {
  const cors = getCors(req);
  const corsHeaders = cors.headers;
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: "CORS origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const dry = url.searchParams.get("dryRun") === "1";

    const nowIso = new Date().toISOString();
    // 1) Find expired mock assignments
    const { data: rows, error: selErr } = await supabase
      .from("assignments")
      .select("id, file_url")
      .eq("is_mock", true)
      .lte("expires_at", nowIso)
      .limit(1000);

    if (selErr) {
      return new Response(JSON.stringify({ error: selErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ids = (rows || []).map((r: any) => r.id);
    const keys = (rows || [])
      .map((r: any) => extractAssignmentsKey(r.file_url))
      .filter((k: string | null): k is string => !!k);

    const result: any = { expiredCount: rows?.length || 0, removedFiles: 0, removedRows: 0, dryRun: dry };

    if (!dry && keys.length > 0) {
      const { error: remErr } = await supabase.storage.from("assignments").remove(keys);
      if (remErr) {
        // Not fatal, continue with row delete
        result.storageError = remErr.message;
      } else {
        result.removedFiles = keys.length;
      }
    }

    if (!dry && ids.length > 0) {
      const { error: delErr, count } = await supabase
        .from("assignments")
        .delete({ count: "exact" })
        .in("id", ids);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message, partial: result }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      result.removedRows = count ?? ids.length;
    }

    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
