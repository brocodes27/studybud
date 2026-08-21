import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCors } from "../_shared/cors.ts";

type LeaderRole = "chain_head" | "principal";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  const cors = getCors(req);
  const headers = { ...cors.headers, "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (!cors.allowed) {
    return new Response(JSON.stringify({ error: "CORS origin not allowed" }), {
      status: 403,
      headers,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error("School leader provisioning is not configured");
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await callerClient.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { role, email: rawEmail, school_id, chain_id } = await req.json();
    const leaderRole = role as LeaderRole;
    const email = String(rawEmail || "")
      .trim()
      .toLowerCase();
    if (!emailPattern.test(email))
      throw new Error("Enter a valid email address");
    if (leaderRole !== "principal" && leaderRole !== "chain_head") {
      throw new Error("Invalid school leader role");
    }

    const invitation =
      leaderRole === "principal"
        ? await callerClient.rpc("admin_invite_school_admin", {
            p_school_id: school_id,
            p_email: email,
          })
        : await callerClient.rpc("admin_invite_chain_admin", {
            p_chain_id: chain_id,
            p_email: email,
          });

    if (invitation.error) throw new Error(invitation.error.message);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const pendingAppMetadata = {
      pending_provisioned_role: leaderRole,
      pending_provisioned_school_id:
        leaderRole === "principal" ? String(school_id) : null,
      pending_provisioned_chain_id:
        leaderRole === "chain_head" ? String(chain_id) : null,
    };
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          provisioned_by: user.id,
          provisioned_role: leaderRole,
          provisioned_school_id:
            pendingAppMetadata.pending_provisioned_school_id,
          provisioned_chain_id: pendingAppMetadata.pending_provisioned_chain_id,
        },
      });

    if (inviteError) {
      const existingAccount = /already|registered|exists/i.test(
        inviteError.message || "",
      );
      if (!existingAccount) throw inviteError;

      const { data: existingProfile, error: profileError } = await adminClient
        .from("user_profiles")
        .select("id")
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      if (profileError || !existingProfile?.id) {
        throw new Error(
          "The existing account could not be prepared for this invitation",
        );
      }

      const {
        data: { user: existingUser },
        error: existingUserError,
      } = await adminClient.auth.admin.getUserById(existingProfile.id);
      if (existingUserError || !existingUser) {
        throw new Error("The existing account could not be loaded");
      }

      const { error: updateError } =
        await adminClient.auth.admin.updateUserById(existingProfile.id, {
          app_metadata: {
            ...existingUser.app_metadata,
            ...pendingAppMetadata,
          },
        });
      if (updateError) throw new Error(updateError.message);

      return new Response(
        JSON.stringify({
          success: true,
          status: "existing_account",
          email,
          message:
            "Access is ready. The existing user can use secure email sign-in.",
        }),
        { headers },
      );
    }

    if (inviteData.user?.id) {
      const { error: updateError } =
        await adminClient.auth.admin.updateUserById(inviteData.user.id, {
          app_metadata: {
            ...inviteData.user.app_metadata,
            ...pendingAppMetadata,
          },
        });
      if (updateError) throw new Error(updateError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "invited",
        email,
        message: "Provisioned access and sent a secure invitation.",
      }),
      { headers },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not provision school leader";
    const status = message === "Unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers,
    });
  }
});
