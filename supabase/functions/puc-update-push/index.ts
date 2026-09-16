import { createClient } from "supabase";
import webpush from "web-push";

type Subscription = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
type CatalogEntry = {
  id: string;
  course_code: string;
  course_name: string;
  academic_year: string;
  edition: string;
  version: number;
  approved_from_submission_id: string | null;
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

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
    const catalogId = typeof body?.catalog_id === "string" ? body.catalog_id : "";
    if (!catalogId) return jsonResponse({ error: "Missing catalog_id" }, 400);

    const { data: catalog, error: catalogError } = await db
      .from("puc_catalog_entries")
      .select("id,course_code,course_name,academic_year,edition,version,approved_from_submission_id")
      .eq("id", catalogId)
      .eq("is_active", true)
      .maybeSingle();
    if (catalogError) return jsonResponse({ error: "Catalog lookup failed" }, 500);
    if (!catalog) return jsonResponse({ error: "Active catalog version not found" }, 404);

    const current = catalog as CatalogEntry;
    if (!current.approved_from_submission_id) {
      return jsonResponse({ sent: 0, usersNotified: 0, skipped: true, reason: "catalog-not-from-submission" });
    }

    const { data: submission, error: submissionError } = await db
      .from("puc_catalog_submissions")
      .select("id,kind,status")
      .eq("id", current.approved_from_submission_id)
      .maybeSingle();
    if (submissionError) return jsonResponse({ error: "Submission lookup failed" }, 500);
    if (!submission || submission.kind !== "correction" || submission.status !== "approved") {
      return jsonResponse({ sent: 0, usersNotified: 0, skipped: true, reason: "not-approved-correction" });
    }

    const { data: versions, error: versionsError } = await db
      .from("puc_catalog_entries")
      .select("id,version")
      .eq("course_code", current.course_code)
      .eq("academic_year", current.academic_year)
      .eq("edition", current.edition)
      .lt("version", current.version);
    if (versionsError) return jsonResponse({ error: "Catalog history unavailable" }, 503);

    const previousIds = (versions ?? []).map((row: any) => row.id as string);
    if (!previousIds.length) {
      return jsonResponse({ sent: 0, usersNotified: 0, skipped: true, reason: "no-previous-version" });
    }

    const { data: oldAcceptances, error: acceptanceError } = await db
      .from("puc_catalog_acceptances")
      .select("user_id,catalog_id,accepted_version")
      .in("catalog_id", previousIds);
    if (acceptanceError) return jsonResponse({ error: "Acceptance lookup failed" }, 503);

    const candidateUserIds = [...new Set((oldAcceptances ?? []).map((row: any) => row.user_id as string))];
    if (!candidateUserIds.length) {
      return jsonResponse({ sent: 0, usersNotified: 0, affectedUsers: 0 });
    }

    const { data: currentAcceptances, error: currentAcceptanceError } = await db
      .from("puc_catalog_acceptances")
      .select("user_id")
      .eq("catalog_id", current.id)
      .in("user_id", candidateUserIds);
    if (currentAcceptanceError) return jsonResponse({ error: "Current acceptance lookup failed" }, 503);
    const alreadyAccepted = new Set((currentAcceptances ?? []).map((row: any) => row.user_id as string));
    const affectedUserIds = candidateUserIds.filter((userId) => !alreadyAccepted.has(userId));
    if (!affectedUserIds.length) {
      return jsonResponse({ sent: 0, usersNotified: 0, affectedUsers: 0, alreadyAcceptedUsers: alreadyAccepted.size });
    }

    const eventKey = `puc:update:${current.id}:v${current.version}`;
    const { data: deliveredRows, error: deliveryError } = await db
      .from("push_delivery_log")
      .select("user_id,event_key")
      .eq("event_key", eventKey)
      .in("user_id", affectedUserIds);
    if (deliveryError) return jsonResponse({ error: "Push delivery history unavailable" }, 503);
    const deliveredUsers = new Set((deliveredRows ?? []).map((row: any) => row.user_id as string));
    const pendingUserIds = affectedUserIds.filter((userId) => !deliveredUsers.has(userId));
    if (!pendingUserIds.length) {
      return jsonResponse({ sent: 0, usersNotified: 0, affectedUsers: affectedUserIds.length, alreadyNotifiedUsers: deliveredUsers.size });
    }

    const { data: subscriptions, error: subscriptionError } = await db
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .in("user_id", pendingUserIds)
      .eq("enabled", true);
    if (subscriptionError) return jsonResponse({ error: "Push subscriptions unavailable" }, 503);

    webpush.setVapidDetails("mailto:sergioneto78@gmail.com", config.vapid_public, config.vapid_private);
    const grouped = new Map<string, Subscription[]>();
    for (const subscription of (subscriptions ?? []) as Subscription[]) {
      const currentItems = grouped.get(subscription.user_id) ?? [];
      currentItems.push(subscription);
      grouped.set(subscription.user_id, currentItems);
    }

    const payload = JSON.stringify({
      title: "Atualização PUC para rever",
      body: `${current.course_name} (${current.course_code}) · Existe uma nova versão validada para ${current.academic_year}, edição ${current.edition}. Confirma com o teu PUC antes de aceitar qualquer alteração.`,
      url: "/#/puc/atualizacoes",
      icon: "/academic-hub-icon-v10-192.png",
      badge: "/academic-hub-notification-badge.png",
      tag: `puc-update-${current.course_code}-${current.academic_year}-${current.edition}-v${current.version}`,
      data: {
        kind: "puc-update",
        catalogId: current.id,
        courseCode: current.course_code,
        academicYear: current.academic_year,
        edition: current.edition,
        version: current.version,
      },
    });

    let sent = 0;
    const successfulUserIds: string[] = [];
    for (const userId of pendingUserIds) {
      const userSubscriptions = grouped.get(userId) ?? [];
      let succeeded = false;
      for (const subscription of userSubscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
            payload,
            { TTL: 604800 },
          );
          sent += 1;
          succeeded = true;
        } catch (error: any) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await db.from("push_subscriptions").delete().eq("id", subscription.id);
          } else {
            console.error("puc-update-push", error?.statusCode ?? error);
          }
        }
      }
      if (succeeded) successfulUserIds.push(userId);
    }

    if (successfulUserIds.length) {
      const { error: logError } = await db
        .from("push_delivery_log")
        .upsert(
          successfulUserIds.map((userId) => ({ user_id: userId, event_key: eventKey })),
          { onConflict: "user_id,event_key", ignoreDuplicates: true },
        );
      if (logError) {
        console.error("puc-update-push-delivery-log", logError.message);
        return jsonResponse({ error: "Push sent but delivery log failed", sent, usersNotified: successfulUserIds.length }, 503);
      }
    }

    return jsonResponse({
      sent,
      usersNotified: successfulUserIds.length,
      affectedUsers: affectedUserIds.length,
      alreadyNotifiedUsers: deliveredUsers.size,
      usersWithoutActiveSubscription: pendingUserIds.filter((id) => !(grouped.get(id)?.length)).length,
      courseCode: current.course_code,
      academicYear: current.academic_year,
      edition: current.edition,
      version: current.version,
    });
  },
};
