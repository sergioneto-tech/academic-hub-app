import { createClient } from "supabase";
import webpush from "web-push";

type ReleaseKind = "app" | "security" | "mixed";
type ReleaseEntry = {
  version: string;
  date?: string;
  changes?: string[];
  kind?: ReleaseKind;
  securityLevel?: string;
  securitySummary?: string;
  pushNotify?: boolean;
};
type ReleaseNotes = { latest?: string; versions?: ReleaseEntry[] };
type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

function notificationFor(entry: ReleaseEntry) {
  const kind: ReleaseKind = entry.kind ?? "app";
  if (kind === "security") {
    return {
      title: "Atualização de segurança disponível",
      body: entry.securityLevel
        ? `Segurança ${entry.securityLevel} · App v${entry.version}. Abre o Academic Hub para atualizar.`
        : `App v${entry.version} inclui uma atualização de segurança. Abre o Academic Hub para atualizar.`,
    };
  }
  if (kind === "mixed") {
    return {
      title: "Nova versão + segurança",
      body: entry.securityLevel
        ? `App v${entry.version} · Segurança ${entry.securityLevel}. Abre o Academic Hub para atualizar.`
        : `App v${entry.version} inclui melhorias e reforços de segurança.`,
    };
  }
  return {
    title: "Nova versão do Academic Hub",
    body: `Versão ${entry.version} disponível. Abre o Academic Hub para atualizar.`,
  };
}

export default {
  async fetch(req: Request) {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    // Rejeita chamadas sem credencial antes de qualquer leitura privilegiada.
    const suppliedSecret = req.headers.get("x-cron-secret") ?? "";
    if (!suppliedSecret) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) return jsonResponse({ error: "Server configuration missing" }, 503);

    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data: cfg, error: cfgError } = await db
      .from("push_server_config")
      .select("key,value")
      .in("key", ["vapid_public", "vapid_private", "cron_secret"]);
    if (cfgError) return jsonResponse({ error: "Push configuration unavailable" }, 503);

    const config = Object.fromEntries((cfg ?? []).map((row: any) => [row.key, row.value]));
    if (suppliedSecret !== config.cron_secret) return jsonResponse({ error: "Unauthorized" }, 401);
    if (!config.vapid_public || !config.vapid_private) return jsonResponse({ error: "Push not configured" }, 503);

    const releaseUrl = `https://academichub.sergioneto.pt/release-notes.json?release_check=${Date.now()}`;
    let notes: ReleaseNotes;
    try {
      const response = await fetch(releaseUrl, { headers: { "Cache-Control": "no-cache" } });
      if (!response.ok) return jsonResponse({ error: `Release metadata HTTP ${response.status}` }, 502);
      notes = await response.json() as ReleaseNotes;
    } catch {
      return jsonResponse({ error: "Release metadata unavailable" }, 502);
    }

    const latest = String(notes.latest ?? "").trim();
    const entry = (notes.versions ?? []).find((item) => item?.version === latest);
    if (!latest || !entry) return jsonResponse({ error: "Invalid release metadata" }, 502);

    // O envio é sempre opt-in por release. Evita notificações retroativas/acidentais.
    if (entry.pushNotify !== true) {
      return jsonResponse({ sent: 0, skipped: true, reason: "release-not-marked-for-push", version: latest });
    }

    const kind: ReleaseKind = entry.kind ?? "app";
    const eventKey = kind === "security"
      ? `release:security:${entry.securityLevel ?? "unknown"}:app:${entry.version}`
      : kind === "mixed"
        ? `release:mixed:${entry.version}:security:${entry.securityLevel ?? "unknown"}`
        : `release:app:${entry.version}`;

    const { data: subscriptions, error: subError } = await db
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .eq("enabled", true);
    if (subError) return jsonResponse({ error: "Push subscriptions unavailable" }, 503);
    if (!subscriptions?.length) return jsonResponse({ sent: 0, version: latest });

    const userIds = [...new Set((subscriptions as Subscription[]).map((item) => item.user_id))];
    const { data: existingLogs } = await db
      .from("push_delivery_log")
      .select("user_id,event_key")
      .eq("event_key", eventKey)
      .in("user_id", userIds);
    const deliveredUsers = new Set((existingLogs ?? []).map((row: any) => row.user_id));

    webpush.setVapidDetails("mailto:sergioneto78@gmail.com", config.vapid_public, config.vapid_private);
    const notification = notificationFor(entry);
    const grouped = new Map<string, Subscription[]>();
    for (const subscription of subscriptions as Subscription[]) {
      if (deliveredUsers.has(subscription.user_id)) continue;
      const current = grouped.get(subscription.user_id) ?? [];
      current.push(subscription);
      grouped.set(subscription.user_id, current);
    }

    let sent = 0;
    let usersNotified = 0;
    for (const [userId, userSubs] of grouped.entries()) {
      let userSucceeded = false;
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        url: `/#/?release=${encodeURIComponent(entry.version)}`,
        icon: "/academic-hub-icon-v10-192.png",
        badge: "/academic-hub-notification-badge.png",
        tag: `academic-hub-release-${entry.version}-${kind}`,
        data: {
          kind: "release",
          releaseKind: kind,
          version: entry.version,
          securityLevel: entry.securityLevel ?? null,
        },
      });

      for (const subscription of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
            { TTL: 604800 },
          );
          sent += 1;
          userSucceeded = true;
        } catch (error: any) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await db.from("push_subscriptions").delete().eq("id", subscription.id);
          } else {
            console.error("release-push", error?.statusCode ?? error);
          }
        }
      }

      if (userSucceeded) {
        usersNotified += 1;
        await db.from("push_delivery_log").insert({ user_id: userId, event_key: eventKey });
      }
    }

    return jsonResponse({
      sent,
      usersNotified,
      version: entry.version,
      kind,
      securityLevel: entry.securityLevel ?? null,
    });
  },
};
