import {
  getStoredSession,
  refreshSession,
  type AuthSession,
  type CloudConfig,
} from "@/lib/cloudSync";

export const VAPID_PUBLIC_KEY = "BFDPFz6LlLvqa99SKJYYnxSBskJWWFLpHF7PqGA8MmdzZJfaX4DkbYlWIKD5zMt1JaDq5kdOBsq_I7gVEHwFQSc";

export type PushPreferences = {
  deadlines_enabled: boolean;
  exams_enabled: boolean;
  uab_enabled: boolean;
  efinal_lead_days: number;
  exam_lead_days: number;
  uab_lead_days: number;
  timezone: string;
};

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  deadlines_enabled: true,
  exams_enabled: true,
  uab_enabled: true,
  efinal_lead_days: 2,
  exam_lead_days: 7,
  uab_lead_days: 3,
  timezone: "Europe/Lisbon",
};

type CloudAuthContext = {
  config: CloudConfig;
  session: AuthSession;
};

function getCloudConfig(): CloudConfig {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const supabaseAnonKey = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("A configuração da cloud não está disponível neste dispositivo.");
  }
  return { supabaseUrl, supabaseAnonKey };
}

async function getCloudAuthContext(): Promise<CloudAuthContext> {
  const config = getCloudConfig();
  let session = getStoredSession(config);
  if (!session) throw new Error("Inicia sessão na conta do Academic Hub para ativar notificações.");

  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at <= now + 60) {
    session = await refreshSession(config, session);
  }
  return { config, session };
}

function authHeaders(context: CloudAuthContext, extra?: Record<string, string>) {
  return {
    apikey: context.config.supabaseAnonKey,
    Authorization: `Bearer ${context.session.access_token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function cloudFetch(
  context: CloudAuthContext,
  url: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(context),
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  if (response.status === 401 && retry) {
    const fresh = await refreshSession(context.config, context.session);
    return cloudFetch({ config: context.config, session: fresh }, url, init, false);
  }
  return response;
}

async function assertOk(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const text = await response.text().catch(() => "");
  throw new Error(text || response.statusText || fallback);
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isStandalonePwa() {
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function loadPushPreferences() {
  let context: CloudAuthContext;
  try {
    context = await getCloudAuthContext();
  } catch {
    return null;
  }

  const url = `${context.config.supabaseUrl}/rest/v1/push_preferences?user_id=eq.${encodeURIComponent(context.session.user.id)}&select=*&limit=1`;
  const response = await cloudFetch(context, url, { cache: "no-store" });
  await assertOk(response, "Não foi possível carregar as preferências de notificações.");
  const rows = await response.json() as Array<PushPreferences & { user_id: string }>;
  return rows[0] ? { ...DEFAULT_PUSH_PREFERENCES, ...rows[0] } : DEFAULT_PUSH_PREFERENCES;
}

export async function savePushPreferences(prefs: PushPreferences) {
  const context = await getCloudAuthContext();
  const url = `${context.config.supabaseUrl}/rest/v1/push_preferences?on_conflict=user_id`;
  const response = await cloudFetch(context, url, {
    method: "POST",
    cache: "no-store",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: context.session.user.id, ...prefs }),
  });
  await assertOk(response, "Não foi possível guardar as preferências de notificações.");
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function enablePushOnThisDevice(deviceLabel: string) {
  if (!pushSupported()) throw new Error("Este dispositivo/navegador não suporta notificações Push.");
  const context = await getCloudAuthContext();

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("A autorização de notificações não foi concedida.");

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const url = `${context.config.supabaseUrl}/rest/v1/push_subscriptions?on_conflict=endpoint`;
  const response = await cloudFetch(context, url, {
    method: "POST",
    cache: "no-store",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: context.session.user.id,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      device_label: deviceLabel,
      user_agent: navigator.userAgent,
      enabled: true,
    }),
  });
  await assertOk(response, "Não foi possível registar este dispositivo para notificações.");

  const preferences = await loadPushPreferences() ?? DEFAULT_PUSH_PREFERENCES;
  await savePushPreferences(preferences);
  return subscription;
}

export async function disablePushOnThisDevice() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;

  const context = await getCloudAuthContext();
  const url = `${context.config.supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`;
  const response = await cloudFetch(context, url, { method: "DELETE", cache: "no-store" });
  await assertOk(response, "Não foi possível remover a subscrição de notificações.");
  await subscription.unsubscribe();
}

export async function sendPushTest() {
  const context = await getCloudAuthContext();
  const response = await cloudFetch(context, `${context.config.supabaseUrl}/functions/v1/academic-push`, {
    method: "POST",
    cache: "no-store",
    body: JSON.stringify({ mode: "test" }),
  });
  await assertOk(response, "Não foi possível enviar a notificação de teste.");
}
