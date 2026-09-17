import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.3";

const MANAGER_USER_ID = "b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c";
const SUPPORT_ID_PATTERN = /^AH-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const AUDITED_FIELDS = [
  "account.email_verified",
  "account.created_at",
  "account.last_sign_in_at",
  "cloud.has_state",
  "cloud.updated_at",
  "push.subscription_counts",
  "push.last_updated_at",
  "errors.latest_metadata",
  "feedback.references_status",
  "puc.status_summary",
];

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "server_configuration" }, 500);

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: callerData, error: callerError } = await caller.auth.getUser();
  if (callerError || !callerData.user) return json({ error: "unauthorized" }, 401);
  if (callerData.user.id !== MANAGER_USER_ID) return json({ error: "forbidden" }, 403);

  let payload: { action?: unknown; supportId?: unknown; reason?: unknown } = {};
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (payload.action === "access") return json({ allowed: true });

  const supportId = String(payload.supportId ?? "").trim().toUpperCase();
  const reason = String(payload.reason ?? "").trim().replace(/\s+/g, " ");
  if (!SUPPORT_ID_PATTERN.test(supportId)) return json({ error: "invalid_support_id" }, 400);
  if (reason.length < 8 || reason.length > 500) return json({ error: "invalid_reason" }, 400);
  if (reason.toUpperCase() === supportId || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(reason)) {
    return json({ error: "invalid_reason" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: identity, error: identityError } = await admin
    .from("user_support_identity")
    .select("user_id,support_id")
    .eq("support_id", supportId)
    .maybeSingle();
  if (identityError) return json({ error: "lookup_failed" }, 500);
  if (!identity?.user_id) return json({ error: "not_found" }, 404);

  const userId = identity.user_id as string;
  const [authResult, stateResult, pushResult, errorsResult, feedbackResult, pucResult] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("user_state").select("updated_at").eq("user_id", userId).maybeSingle(),
    admin.from("push_subscriptions").select("enabled,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(20),
    admin.from("client_error_reports").select("error_code,route,app_version,occurrence_count,last_seen_at,status").eq("user_id", userId).order("last_seen_at", { ascending: false }).limit(5),
    admin.from("feedback_requests").select("reference,status,app_version,created_at,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(5),
    admin.from("puc_catalog_submissions").select("status,created_at,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(5),
  ]);

  if (authResult.error) return json({ error: "account_lookup_failed" }, 500);
  if (stateResult.error || pushResult.error || errorsResult.error || feedbackResult.error || pucResult.error) {
    return json({ error: "diagnostics_lookup_failed" }, 500);
  }

  const { error: auditError } = await admin.rpc("log_admin_support_access", {
    p_admin_user_id: callerData.user.id,
    p_subject_user_id: userId,
    p_support_id: supportId,
    p_reason: reason,
    p_fields_returned: AUDITED_FIELDS,
    p_action: "support_lookup",
  });
  if (auditError) {
    console.error("[admin-support-lookup][audit]", auditError.message);
    return json({ error: "audit_failed" }, 500);
  }

  const authUser = authResult.data.user;
  const pushRows = pushResult.data ?? [];
  const errorRows = errorsResult.data ?? [];
  const feedbackRows = feedbackResult.data ?? [];
  const pucRows = pucResult.data ?? [];

  return json({
    supportId,
    account: {
      exists: true,
      createdAt: authUser.created_at ?? null,
      emailVerified: Boolean(authUser.email_confirmed_at),
      lastSignInAt: authUser.last_sign_in_at ?? null,
    },
    cloud: {
      hasState: Boolean(stateResult.data),
      updatedAt: stateResult.data?.updated_at ?? null,
    },
    push: {
      subscriptions: pushRows.length,
      enabledSubscriptions: pushRows.filter((row) => row.enabled).length,
      lastUpdatedAt: pushRows[0]?.updated_at ?? null,
    },
    errors: {
      openCount: errorRows.filter((row) => row.status === "open").length,
      recentCount: errorRows.length,
      latest: errorRows[0] ?? null,
    },
    feedback: {
      activeCount: feedbackRows.filter((row) => row.status !== "completed" && row.status !== "archived").length,
      recent: feedbackRows,
    },
    puc: {
      pendingCount: pucRows.filter((row) => row.status === "pending").length,
      recentCount: pucRows.length,
      latestStatus: pucRows[0]?.status ?? null,
      latestUpdatedAt: pucRows[0]?.updated_at ?? null,
    },
  });
});
