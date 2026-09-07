import { createClient } from "supabase";
import webpush from "web-push";

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };
type FeedbackRow = { id: string; reference: string; kind: string; title: string };

const MANAGER_USER_ID = "b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c";
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

function kindLabel(kind: string) {
  if (kind === "bug") return "Problema";
  if (kind === "opinion") return "Opinião";
  return "Sugestão";
}

export default {
  async fetch(req: Request) {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(url, service, { auth: { persistSession: false } });
    const { data: configRows } = await db
      .from("push_server_config")
      .select("key,value")
      .in("key", ["vapid_public", "vapid_private", "cron_secret"]);
    const config = Object.fromEntries((configRows ?? []).map((row: any) => [row.key, row.value]));

    const suppliedSecret = req.headers.get("x-cron-secret");
    if (!config.cron_secret || suppliedSecret !== config.cron_secret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    if (!config.vapid_public || !config.vapid_private) {
      return jsonResponse({ error: "Push not configured" }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const requestId = typeof body?.request_id === "string" ? body.request_id : "";
    if (!requestId) return jsonResponse({ error: "Missing request_id" }, 400);

    const { data: feedback, error: feedbackError } = await db
      .from("feedback_requests")
      .select("id,reference,kind,title")
      .eq("id", requestId)
      .maybeSingle();
    if (feedbackError) return jsonResponse({ error: "Feedback lookup failed" }, 500);
    if (!feedback) return jsonResponse({ error: "Feedback not found" }, 404);

    const eventKey = `feedback:${feedback.id}`;
    const { data: existing } = await db
      .from("push_delivery_log")
      .select("id")
      .eq("user_id", MANAGER_USER_ID)
      .eq("event_key", eventKey)
      .limit(1);
    if (existing?.length) return jsonResponse({ sent: 0, duplicate: true });

    const { data: subscriptions } = await db
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", MANAGER_USER_ID)
      .eq("enabled", true);
    if (!subscriptions?.length) return jsonResponse({ sent: 0, reason: "no-active-subscriptions" });

    webpush.setVapidDetails("mailto:sergioneto78@gmail.com", config.vapid_public, config.vapid_private);
    const row = feedback as FeedbackRow;
    const payload = JSON.stringify({
      title: "Novo feedback recebido",
      body: `${row.reference} · ${kindLabel(row.kind)}: ${row.title}`,
      url: `/#/feedback?request=${encodeURIComponent(row.id)}`,
      icon: "/academic-hub-icon-v10-192.png",
      badge: "/academic-hub-notification-badge.png",
      tag: `feedback-${row.id}`,
    });

    let sent = 0;
    for (const subscription of subscriptions as Sub[]) {
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
          console.error("feedback-push", error?.statusCode ?? error);
        }
      }
    }

    if (sent > 0) {
      await db.from("push_delivery_log").insert({ user_id: MANAGER_USER_ID, event_key: eventKey });
    }
    return jsonResponse({ sent });
  },
};
