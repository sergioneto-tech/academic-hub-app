import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import webpush from "npm:web-push@3.6.7";

type PushSubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };
type ErrorCode = "interface_chunk" | "update_failed" | "auth_confirmation" | "cloud_sync" | "unexpected_ui";

const MANAGER_CONFIG_KEY = "security_manager_user_id";
const DEDUPE_WINDOW_MS = 15 * 60 * 1000;
const ALLOWED_CODES = new Set<ErrorCode>([
  "interface_chunk",
  "update_failed",
  "auth_confirmation",
  "cloud_sync",
  "unexpected_ui",
]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function cleanText(value: unknown, max = 500) {
  return String(value ?? "")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/(access_token|refresh_token|token|apikey|authorization)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, max);
}

function cleanRoute(value: unknown) {
  const raw = String(value ?? "").trim().slice(0, 240);
  if (!raw) return null;
  return raw.replace(/([?&][^=&#]+)=([^&#]*)/g, "$1=[redacted]");
}

function labelFor(code: ErrorCode) {
  switch (code) {
    case "interface_chunk": return "mistura de ficheiros/versões";
    case "update_failed": return "falha na atualização";
    case "auth_confirmation": return "falha na confirmação da conta";
    case "cloud_sync": return "falha de sincronização Cloud";
    default: return "erro inesperado da interface";
  }
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!jwt) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Configuration unavailable" }, 503);

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: userData, error: userError } = await db.auth.getUser(jwt);
  const user = userData?.user;
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const code = String(body?.errorCode ?? "") as ErrorCode;
  if (!ALLOWED_CODES.has(code)) return json({ error: "Invalid error code" }, 400);

  const summary = cleanText(body?.summary, 500) || labelFor(code);
  const route = cleanRoute(body?.route);
  const appVersion = cleanText(body?.appVersion, 32) || "unknown";
  const fingerprint = await sha256Hex(`${user.id}|${code}|${summary.toLowerCase()}|${route ?? ""}|${appVersion}`);
  const cutoff = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();

  const { data: existingRows } = await db
    .from("client_error_reports")
    .select("id,occurrence_count,notified_at")
    .eq("user_id", user.id)
    .eq("fingerprint", fingerprint)
    .gte("last_seen_at", cutoff)
    .order("last_seen_at", { ascending: false })
    .limit(1);

  let reportId: string;
  let shouldNotify = true;
  if (existingRows?.length) {
    const existing = existingRows[0];
    reportId = existing.id;
    shouldNotify = !existing.notified_at;
    await db
      .from("client_error_reports")
      .update({ occurrence_count: Number(existing.occurrence_count ?? 1) + 1, last_seen_at: new Date().toISOString() })
      .eq("id", reportId);
  } else {
    const { data: inserted, error: insertError } = await db
      .from("client_error_reports")
      .insert({ user_id: user.id, error_code: code, summary, route, app_version: appVersion, fingerprint })
      .select("id")
      .single();
    if (insertError || !inserted) return json({ error: "Could not record error" }, 503);
    reportId = inserted.id;
  }

  if (!shouldNotify) return json({ ok: true, reportId, duplicate: true });

  const { data: configRows, error: configError } = await db
    .from("push_server_config")
    .select("key,value")
    .in("key", ["vapid_public", "vapid_private", MANAGER_CONFIG_KEY]);
  if (configError) return json({ ok: true, reportId, notification: "configuration-unavailable" });

  const config = Object.fromEntries((configRows ?? []).map((row: { key: string; value: string }) => [row.key, row.value]));
  const managerUserId = String(config[MANAGER_CONFIG_KEY] ?? "").trim();
  if (!managerUserId || !config.vapid_public || !config.vapid_private) {
    return json({ ok: true, reportId, notification: "not-configured" });
  }

  const { data: subscriptions } = await db
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", managerUserId)
    .eq("enabled", true);
  if (!subscriptions?.length) return json({ ok: true, reportId, notification: "no-subscription" });

  const email = String(user.email ?? "").toLowerCase();
  const studentNumber = email.endsWith("@estudante.uab.pt") ? email.split("@")[0] : "não identificado";
  const shortRef = `AH-ERR-${reportId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const payload = JSON.stringify({
    title: "Erro técnico detetado no Academic Hub",
    body: `Aluno ${studentNumber} · ${labelFor(code)} · v${appVersion} · ${shortRef}`,
    url: "/#/definicoes",
    icon: "/academic-hub-icon-v10-192.png",
    badge: "/academic-hub-notification-badge.png",
    tag: `academic-hub-client-error-${reportId}`,
    data: { kind: "admin-client-error", reportId, reference: shortRef, errorCode: code },
  });

  webpush.setVapidDetails("mailto:sergioneto78@gmail.com", config.vapid_public, config.vapid_private);
  let sent = 0;
  for (const subscription of subscriptions as PushSubscriptionRow[]) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
        { TTL: 86400 },
      );
      sent += 1;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await db.from("push_subscriptions").delete().eq("id", subscription.id);
      } else {
        console.error("client-error-report-push", error?.statusCode ?? error);
      }
    }
  }

  if (sent > 0) {
    await db.from("client_error_reports").update({ notified_at: new Date().toISOString() }).eq("id", reportId);
  }

  return json({ ok: true, reportId, sent });
});
