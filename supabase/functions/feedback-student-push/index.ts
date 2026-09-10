import { createClient } from "supabase";
import webpush from "web-push";

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };
type EventKind = "reply" | "status";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const STATUS_LABELS: Record<string, string> = {
  reviewing: "Em análise",
  waiting_user: "A aguardar informação",
  planned: "Planeado",
  in_development: "Em desenvolvimento",
  completed: "Concluído",
  not_planned: "Não previsto",
};

function notificationFor(kind: EventKind, reference: string, status?: string) {
  if (kind === "reply") {
    return {
      title: "Resposta do Academic Hub",
      body: `${reference} · O Academic Hub respondeu ao teu pedido. Abre para consultar.`,
    };
  }

  const label = STATUS_LABELS[status ?? ""] ?? "Atualizado";
  if (status === "completed") {
    return {
      title: "Pedido concluído",
      body: `${reference} · O teu pedido foi concluído pelo Academic Hub.`,
    };
  }
  if (status === "waiting_user") {
    return {
      title: "Pedido atualizado",
      body: `${reference} · O Academic Hub está a aguardar informação adicional.`,
    };
  }
  return {
    title: "Estado do pedido atualizado",
    body: `${reference} · Novo estado: ${label}.`,
  };
}

export default {
  async fetch(req: Request) {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const suppliedSecret = req.headers.get("x-cron-secret") ?? "";
    if (!suppliedSecret) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) return jsonResponse({ error: "Server configuration missing" }, 503);

    const db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
    const { data: configRows, error: configError } = await db
      .from("push_server_config")
      .select("key,value")
      .in("key", ["vapid_public", "vapid_private", "cron_secret"]);
    if (configError) return jsonResponse({ error: "Push configuration unavailable" }, 503);

    const config = Object.fromEntries((configRows ?? []).map((row: any) => [row.key, row.value]));
    if (!config.cron_secret || suppliedSecret !== config.cron_secret) return jsonResponse({ error: "Unauthorized" }, 401);
    if (!config.vapid_public || !config.vapid_private) return jsonResponse({ error: "Push not configured" }, 503);

    const body = await req.json().catch(() => ({}));
    const kind: EventKind | null = body?.event === "reply" || body?.event === "status" ? body.event : null;
    const requestId = typeof body?.request_id === "string" ? body.request_id : "";
    if (!kind || !requestId) return jsonResponse({ error: "Invalid event" }, 400);

    const { data: feedback, error: feedbackError } = await db
      .from("feedback_requests")
      .select("id,reference,user_id,status")
      .eq("id", requestId)
      .maybeSingle();
    if (feedbackError) return jsonResponse({ error: "Feedback lookup failed" }, 500);
    if (!feedback) return jsonResponse({ error: "Feedback not found" }, 404);

    let eventKey = "";
    if (kind === "reply") {
      const messageId = typeof body?.message_id === "string" ? body.message_id : "";
      if (!messageId) return jsonResponse({ error: "Missing message_id" }, 400);
      const { data: message, error: messageError } = await db
        .from("feedback_messages")
        .select("id,request_id,author")
        .eq("id", messageId)
        .eq("request_id", requestId)
        .maybeSingle();
      if (messageError) return jsonResponse({ error: "Message lookup failed" }, 500);
      if (!message || message.author !== "academic_hub") return jsonResponse({ error: "Invalid reply" }, 400);
      eventKey = `feedback:student:reply:${messageId}`;
    } else {
      const status = typeof body?.status === "string" ? body.status : "";
      if (!status || feedback.status !== status) {
        return jsonResponse({ sent: 0, skipped: true, reason: "stale-status" });
      }
      const statusAt = typeof body?.status_at === "string" ? body.status_at : "";
      eventKey = `feedback:student:status:${requestId}:${status}:${statusAt || "current"}`;
    }

    const { data: existing } = await db
      .from("push_delivery_log")
      .select("id")
      .eq("user_id", feedback.user_id)
      .eq("event_key", eventKey)
      .limit(1);
    if (existing?.length) return jsonResponse({ sent: 0, duplicate: true, eventKey });

    const { data: subscriptions, error: subscriptionError } = await db
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", feedback.user_id)
      .eq("enabled", true);
    if (subscriptionError) return jsonResponse({ error: "Push subscriptions unavailable" }, 503);
    if (!subscriptions?.length) return jsonResponse({ sent: 0, reason: "no-active-subscriptions", eventKey });

    webpush.setVapidDetails("mailto:sergioneto78@gmail.com", config.vapid_public, config.vapid_private);
    const notification = notificationFor(kind, feedback.reference, kind === "status" ? feedback.status : undefined);
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: `/#/feedback?request=${encodeURIComponent(feedback.id)}`,
      icon: "/academic-hub-icon-v10-192.png",
      badge: "/academic-hub-notification-badge.png",
      tag: kind === "reply" ? `feedback-reply-${requestId}` : `feedback-status-${requestId}`,
      data: {
        kind: "feedback-student",
        event: kind,
        requestId: feedback.id,
        status: feedback.status,
      },
    });

    let sent = 0;
    for (const subscription of subscriptions as Subscription[]) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payload,
          { TTL: 604800 },
        );
        sent += 1;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await db.from("push_subscriptions").delete().eq("id", subscription.id);
        } else {
          console.error("feedback-student-push", error?.statusCode ?? error);
        }
      }
    }

    if (sent > 0) {
      await db.from("push_delivery_log").upsert(
        { user_id: feedback.user_id, event_key: eventKey },
        { onConflict: "user_id,event_key", ignoreDuplicates: true },
      );
    }

    return jsonResponse({ sent, event: kind, requestId, eventKey });
  },
};
