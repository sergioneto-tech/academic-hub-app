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
type ReleasePushRequest = { release?: ReleaseEntry };
type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

const FIRST_AUTOMATIC_PUSH_VERSION = "1.5.5";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

function parseVersion(value: string) {
  return value.split(".").map((part) => Number.parseInt(part.replace(/\D/g, ""), 10) || 0);
}

function compareVersions(left: string, right: string) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  const size = Math.max(a.length, b.length);
  for (let index = 0; index < size; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function isReleaseKind(value: unknown): value is ReleaseKind {
  return value === "app" || value === "security" || value === "mixed";
}

function normaliseRelease(input: ReleaseEntry): ReleaseEntry | null {
  const version = String(input?.version ?? "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) return null;
  const kind: ReleaseKind = isReleaseKind(input.kind) ? input.kind : "app";
  const securityLevel = input.securityLevel ? String(input.securityLevel).trim() : undefined;
  if ((kind === "security" || kind === "mixed") && !/^\d{4}\.\d{2}$/.test(securityLevel ?? "")) return null;
  return {
    ...input,
    version,
    kind,
    securityLevel,
  };
}

function notificationFor(entry: ReleaseEntry) {
  const kind: ReleaseKind = entry.kind ?? "app";
  if (kind === "security") {
    return {
      title: "Atualização de segurança disponível",
      body: entry.securityLevel
        ? `Segurança ${entry.securityLevel} · App v${entry.version}. Toca para atualizar e ver os reforços aplicados.`
        : `App v${entry.version} inclui uma atualização de segurança. Toca para atualizar.`,
    };
  }
  if (kind === "mixed") {
    return {
      title: "Nova versão + segurança",
      body: entry.securityLevel
        ? `App v${entry.version} · Segurança ${entry.securityLevel}. Toca para atualizar e ver o que mudou.`
        : `App v${entry.version} inclui melhorias e reforços de segurança. Toca para atualizar.`,
    };
  }
  return {
    title: "Nova versão do Academic Hub",
    body: `Versão ${entry.version} disponível. Toca para atualizar e ver o que mudou.`,
  };
}

function eventKeyFor(entry: ReleaseEntry) {
  const kind: ReleaseKind = entry.kind ?? "app";
  if (kind === "security") return `release:security:${entry.securityLevel ?? "unknown"}:app:${entry.version}`;
  if (kind === "mixed") return `release:mixed:${entry.version}:security:${entry.securityLevel ?? "unknown"}`;
  return `release:app:${entry.version}`;
}

async function releaseFromPublishedMetadata(): Promise<ReleaseEntry | null> {
  const releaseUrl = `https://academichub.sergioneto.pt/release-notes.json?release_check=${Date.now()}`;
  let notes: ReleaseNotes;
  try {
    const response = await fetch(releaseUrl, { headers: { "Cache-Control": "no-cache" } });
    if (!response.ok) return null;
    notes = await response.json() as ReleaseNotes;
  } catch {
    return null;
  }

  const latest = String(notes.latest ?? "").trim();
  const entry = (notes.versions ?? []).find((item) => item?.version === latest);
  if (!latest || !entry) return null;
  return normaliseRelease(entry);
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

    let requestBody: ReleasePushRequest = {};
    try {
      requestBody = await req.json() as ReleasePushRequest;
    } catch {
      requestBody = {};
    }

    const suppliedRelease = requestBody.release ? normaliseRelease(requestBody.release) : null;
    if (requestBody.release && !suppliedRelease) return jsonResponse({ error: "Invalid release payload" }, 400);

    const entry = suppliedRelease ?? await releaseFromPublishedMetadata();
    if (!entry) return jsonResponse({ error: "Release metadata unavailable or invalid" }, 502);

    // A partir da 1.5.5, toda release funcional, de segurança ou mista gera Push.
    // A barreira de versão impede notificações retroativas das releases anteriores.
    if (compareVersions(entry.version, FIRST_AUTOMATIC_PUSH_VERSION) < 0) {
      return jsonResponse({ sent: 0, skipped: true, reason: "release-before-automatic-push", version: entry.version });
    }

    const kind: ReleaseKind = entry.kind ?? "app";
    const eventKey = eventKeyFor(entry);

    const { data: subscriptions, error: subError } = await db
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .eq("enabled", true);
    if (subError) return jsonResponse({ error: "Push subscriptions unavailable" }, 503);
    if (!subscriptions?.length) return jsonResponse({ sent: 0, usersNotified: 0, version: entry.version, kind });

    const userIds = [...new Set((subscriptions as Subscription[]).map((item) => item.user_id))];
    const { data: existingLogs, error: logError } = await db
      .from("push_delivery_log")
      .select("user_id,event_key")
      .eq("event_key", eventKey)
      .in("user_id", userIds);
    if (logError) return jsonResponse({ error: "Push delivery history unavailable" }, 503);
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
        tag: `academic-hub-release-${entry.version}-${kind}-${entry.securityLevel ?? "app"}`,
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
      alreadyNotifiedUsers: deliveredUsers.size,
      version: entry.version,
      kind,
      securityLevel: entry.securityLevel ?? null,
      source: suppliedRelease ? "internal-release-payload" : "published-release-metadata",
    });
  },
};
