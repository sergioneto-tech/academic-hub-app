import { createClient } from "supabase";
import webpush from "web-push";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const MANAGER_USER_ID = "b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

export default {
  async fetch(req: Request) {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const suppliedSecret = req.headers.get("x-cron-secret");
    if (!suppliedSecret) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Server configuration unavailable" }, 500);

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: configRows, error: configError } = await db
      .from("push_server_config")
      .select("key,value")
      .in("key", ["vapid_public", "vapid_private", "cron_secret"]);
    if (configError) return jsonResponse({ error: "Push configuration lookup failed" }, 500);

    const config = Object.fromEntries((configRows ?? []).map((row: { key: string; value: string }) => [row.key, row.value]));
    if (!config.cron_secret || suppliedSecret !== config.cron_secret) return jsonResponse({ error: "Unauthorized" }, 401);
    if (!config.vapid_public || !config.vapid_private) return jsonResponse({ error: "Push not configured" }, 503);

    const body = await req.json().catch(() => ({}));
    const userId = typeof body?.user_id === "string" ? body.user_id.trim() : "";
    const isAnonymous = body?.is_anonymous === true;
    if (!UUID_PATTERN.test(userId)) return jsonResponse({ error: "Invalid user_id" }, 400);
    if (isAnonymous) return jsonResponse({ sent: 0, ignored: "anonymous-user" });

    const eventKey = `admin-user-registration:${userId}`;
    const { data: existing, error: existingError } = await db
      .from("push_delivery_log")
      .select("id")
      .eq("user_id", MANAGER_USER_ID)
      .eq("event_key", eventKey)
      .limit(1);
    if (existingError) return jsonResponse({ error: "Delivery log lookup failed" }, 500);
    if (existing?.length) return jsonResponse({ sent: 0, duplicate: true });

    let page = 1;
    let totalUsers = 0;
    while (true) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return jsonResponse({ error: "User count failed" }, 500);
      totalUsers += data.users.filter((user) => !user.is_anonymous).length;
      if (data.users.length < 1000) break;
      page += 1;
    }

    const { data: subscriptions, error: subscriptionsError } = await db
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", MANAGER_USER_ID)
      .eq("enabled", true);
    if (subscriptionsError) return jsonResponse({ error: "Subscription lookup failed" }, 500);
    if (!subscriptions?.length) return jsonResponse({ sent: 0, totalUsers, reason: "no-active-subscriptions" });

    webpush.setVapidDetails("mailto:sergioneto78@gmail.com", config.vapid_public, config.vapid_private);
    const payload = JSON.stringify({
      title: "Novo utilizador registado",
      body: `O Academic Hub tem agora ${totalUsers} contas registadas.`,
      url: "/#/",
      icon: "/academic-hub-icon-v10-192.png",
      badge: "/academic-hub-notification-badge.png",
      tag: `admin-user-${userId}`,
      data: {
        kind: "admin-user-registration",
        userId,
        totalUsers,
      },
    });

    let sent = 0;
    for (const subscription of subscriptions as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: 86400 },
        );
        sent += 1;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await db.from("push_subscriptions").delete().eq("id", subscription.id);
        } else {
          console.error("admin-user-registration-push", error?.statusCode ?? error);
        }
      }
    }

    if (sent > 0) {
      const { error: logError } = await db
        .from("push_delivery_log")
        .insert({ user_id: MANAGER_USER_ID, event_key: eventKey });
      if (logError && logError.code !== "23505") {
        return jsonResponse({ error: "Push sent but delivery log failed", sent, totalUsers }, 503);
      }
    }

    return jsonResponse({ sent, totalUsers });
  },
};
