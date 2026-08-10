import {
  getStoredSession,
  refreshSession,
  storeSession,
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

export type RegisteredPushDevice = {
  device_label: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
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
  const session = getStoredSession(config);
  if (!session) throw new Error("Inicia sessão na conta do Academic Hub para ativar notificações.");
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

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function getNewerStoredSession(context: CloudAuthContext): AuthSession | null {
  const latest = getStoredSession(context.config);
  if (
    latest?.user.id === context.session.user.id &&
    (latest.access_token !== context.session.access_token || latest.refresh_token !== context.session.refresh_token)
  ) {
    return latest;
  }
  return null;
}

async function recoverConcurrentRefresh(context: CloudAuthContext, error: unknown): Promise<AuthSession> {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!/refresh token.*already used|already used/i.test(message)) throw error;

  for (const wait of [150, 300, 600, 1000]) {
    await delay(wait);
    const latest = getNewerStoredSession(context);
    if (latest) return latest;
  }

  storeSession(context.config, null);
  throw new Error(
    "A sessão Cloud deste dispositivo expirou e já não pode ser renovada. Os dados locais não foram afetados. Vai a Conta e Perfil, inicia sessão novamente uma vez e repete o teste.",
  );
}

async function refreshForRequest(context: CloudAuthContext): Promise<AuthSession> {
  for (const wait of [120, 280]) {
    await delay(wait);
    const latest = getNewerStoredSession(context);
    if (latest) return latest;
  }

  try {
    return await refreshSession(context.config, context.session);
  } catch (error) {
    return recoverConcurrentRefresh(context, error);
  }
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
    const latest = getNewerStoredSession(context);
    const fresh = latest ?? await refreshForRequest(context);
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

export function isAppleMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) ||
    ((/Macintosh|Mac OS X/i.test(ua) || navigator.platform === "MacIntel") && navigator.maxTouchPoints > 1);
}

function defaultDeviceLabel() {
  const ua = navigator.userAgent || "";
  if (/iPhone|iPod/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua) || isAppleMobileDevice()) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  return "Computador";
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

export async function loadRegisteredPushDevices(): Promise<RegisteredPushDevice[]> {
  const context = await getCloudAuthContext();
  const url = `${context.config.supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(context.session.user.id)}&enabled=eq.true&select=device_label,user_agent,created_at,updated_at&order=updated_at.desc`;
  const response = await cloudFetch(context, url, { cache: "no-store" });
  await assertOk(response, "Não foi possível carregar os dispositivos registados.");
  return await response.json() as RegisteredPushDevice[];
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function ensureLocalPushSubscription() {
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  return subscription;
}

async function registerSubscription(
  context: CloudAuthContext,
  subscription: PushSubscription,
  deviceLabel = defaultDeviceLabel(),
) {
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
}

export async function reconcilePushOnThisDevice(deviceLabel = defaultDeviceLabel()) {
  if (!pushSupported() || Notification.permission !== "granted") return null;
  const context = await getCloudAuthContext();
  const subscription = await ensureLocalPushSubscription();
  await registerSubscription(context, subscription, deviceLabel);
  return subscription;
}

export async function enablePushOnThisDevice(deviceLabel = defaultDeviceLabel()) {
  if (!pushSupported()) throw new Error("Este dispositivo/navegador não suporta notificações Push.");
  const context = await getCloudAuthContext();

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("A autorização de notificações não foi concedida.");

  const subscription = await ensureLocalPushSubscription();
  await registerSubscription(context, subscription, deviceLabel);
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

  // Antes do teste, garante que o dispositivo onde o botão foi premido também está
  // registado. Isto repara automaticamente instalações iOS/iPadOS que já tinham
  // permissão concedida mas perderam a associação ao servidor.
  if (pushSupported() && Notification.permission === "granted") {
    const subscription = await ensureLocalPushSubscription();
    await registerSubscription(context, subscription);
  }

  // O teste serve para validar a conta inteira: envia para todos os dispositivos
  // ativos do utilizador, não apenas para o endpoint onde o botão foi premido.
  const response = await cloudFetch(context, `${context.config.supabaseUrl}/functions/v1/academic-push`, {
    method: "POST",
    cache: "no-store",
    body: JSON.stringify({ mode: "test" }),
  });
  await assertOk(response, "Não foi possível enviar a notificação de teste.");
  const result = await response.json().catch(() => ({ sent: 0 })) as { sent?: number };
  return Number(result.sent ?? 0);
}
