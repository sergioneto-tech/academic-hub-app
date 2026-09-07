import { createClient } from "supabase";
import webpush from "web-push";

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };
type SurveyRow = { survey_id: string; user_id: string; likes_app: boolean; recommends_app: boolean; rating: number };

const MANAGER_USER_ID = "b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c";
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const yesNo = (value: boolean) => value ? "Sim" : "Não";

export default {
  async fetch(req: Request) {
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(url, service, { auth: { persistSession: false } });
    const { data: configRows } = await db.from("push_server_config").select("key,value").in("key", ["vapid_public", "vapid_private", "cron_secret"]);
    const config = Object.fromEntries((configRows ?? []).map((row: any) => [row.key, row.value]));
    if (!config.cron_secret || req.headers.get("x-cron-secret") !== config.cron_secret) return jsonResponse({ error: "Unauthorized" }, 401);
    if (!config.vapid_public || !config.vapid_private) return jsonResponse({ error: "Push not configured" }, 503);

    const body = await req.json().catch(() => ({}));
    const isTest = body?.mode === "test";
    let title = "Nova avaliação recebida";
    let message = "Foi recebida uma nova resposta ao inquérito do Academic Hub.";
    let eventKey: string | null = null;

    if (isTest) {
      title = "Teste · Avaliações do Academic Hub";
      message = "As notificações Push para novas avaliações estão ativas.";
    } else {
      const surveyId = typeof body?.survey_id === "string" ? body.survey_id : "";
      const userId = typeof body?.user_id === "string" ? body.user_id : "";
      if (!surveyId || !userId) return jsonResponse({ error: "Missing survey identifier" }, 400);
      const { data: survey, error } = await db.from("app_survey_responses").select("survey_id,user_id,likes_app,recommends_app,rating").eq("survey_id", surveyId).eq("user_id", userId).maybeSingle();
      if (error) return jsonResponse({ error: "Survey lookup failed" }, 500);
      if (!survey) return jsonResponse({ error: "Survey response not found" }, 404);
      const row = survey as SurveyRow;
      eventKey = `survey:${row.survey_id}:${row.user_id}`;
      const { data: existing } = await db.from("push_delivery_log").select("id").eq("user_id", MANAGER_USER_ID).eq("event_key", eventKey).limit(1);
      if (existing?.length) return jsonResponse({ sent: 0, duplicate: true });
      message = `${row.rating}★ · Gosta: ${yesNo(row.likes_app)} · Recomenda: ${yesNo(row.recommends_app)}`;
    }

    const { data: subscriptions } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", MANAGER_USER_ID).eq("enabled", true);
    if (!subscriptions?.length) return jsonResponse({ sent: 0, reason: "no-active-subscriptions" });
    webpush.setVapidDetails("mailto:sergioneto78@gmail.com", config.vapid_public, config.vapid_private);
    const payload = JSON.stringify({ title, body: message, url: "/#/feedback?survey=1", icon: "/academic-hub-icon-v10-192.png", badge: "/academic-hub-notification-badge.png", tag: isTest ? `survey-test-${Date.now()}` : eventKey });

    let sent = 0;
    for (const subscription of subscriptions as Sub[]) {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 86400 });
        sent += 1;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) await db.from("push_subscriptions").delete().eq("id", subscription.id);
        else console.error("survey-push", error?.statusCode ?? error);
      }
    }
    if (sent > 0 && eventKey) await db.from("push_delivery_log").insert({ user_id: MANAGER_USER_ID, event_key: eventKey });
    return jsonResponse({ sent, test: isTest });
  },
};
