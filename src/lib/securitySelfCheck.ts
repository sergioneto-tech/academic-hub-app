import { getStoredSession, refreshSession, storeSession, type AuthSession, type CloudConfig } from "@/lib/cloudSync";
import { currentPushSubscription, pushSupported, reconcilePushOnThisDevice } from "@/lib/pushNotifications";
import { APP_VERSION, PWA_REVISION } from "@/lib/version";

export type SecuritySelfCheckId =
  | "secure-context"
  | "app-integrity"
  | "service-worker"
  | "central-baseline"
  | "account-security"
  | "security-alerts";

export type SecuritySelfCheckStatus = "pending" | "running" | "pass" | "warning" | "fail";

export type SecuritySelfCheckResult = {
  id: SecuritySelfCheckId;
  label: string;
  status: SecuritySelfCheckStatus;
  detail: string;
  critical: boolean;
  fixable?: boolean;
};

export type SecurityOverallStatus = "pass" | "warning" | "fail";

type CentralSecurityStatus = {
  securityLevel?: string;
  lastAudit?: string;
  status?: "protected" | "attention" | "review";
  summary?: string;
  checks?: Array<{ status?: "pass" | "warning" | "fail" }>;
};

type ActivityItem = {
  severity?: number;
  incident_reference?: string | null;
  incident_status?: string | null;
};

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
const SERVICE_WORKER_REPLY_TIMEOUT_MS = 1800;
const REMOTE_CHECK_TIMEOUT_MS = 8000;

export const SECURITY_SELF_CHECKS: Array<{
  id: SecuritySelfCheckId;
  label: string;
  critical: boolean;
}> = [
  { id: "secure-context", label: "Ligação segura", critical: true },
  { id: "app-integrity", label: "Integridade da versão", critical: true },
  { id: "service-worker", label: "Motor de atualização", critical: false },
  { id: "central-baseline", label: "Baseline central de segurança", critical: true },
  { id: "account-security", label: "Conta e atividade de segurança", critical: true },
  { id: "security-alerts", label: "Alertas neste dispositivo", critical: false },
];

function cloudConfig(): CloudConfig | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const supabaseAnonKey = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

function result(
  id: SecuritySelfCheckId,
  status: Exclude<SecuritySelfCheckStatus, "pending" | "running">,
  detail: string,
  options?: { fixable?: boolean },
): SecuritySelfCheckResult {
  const definition = SECURITY_SELF_CHECKS.find((item) => item.id === id)!;
  return {
    id,
    label: definition.label,
    critical: definition.critical,
    status,
    detail,
    fixable: options?.fixable,
  };
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = REMOTE_CHECK_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchCentralStatus(): Promise<CentralSecurityStatus> {
  const base = import.meta.env.BASE_URL ?? "/";
  const response = await fetchWithTimeout(`${base}security-status.json?check=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<CentralSecurityStatus>;
}

async function queryServiceWorkerVersion(registration: ServiceWorkerRegistration) {
  const worker = registration.active ?? navigator.serviceWorker.controller;
  if (!worker) return null;

  return new Promise<{ appVersion?: string; swVersion?: string } | null>((resolve) => {
    const channel = new MessageChannel();
    let settled = false;
    const finish = (value: { appVersion?: string; swVersion?: string } | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), SERVICE_WORKER_REPLY_TIMEOUT_MS);
    channel.port1.onmessage = (event) => finish(event.data ?? null);
    try {
      worker.postMessage({ type: "GET_VERSION" }, [channel.port2]);
    } catch {
      finish(null);
    }
  });
}

async function checkSecureContext() {
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  if ((window.isSecureContext && window.location.protocol === "https:") || localHost) {
    return result("secure-context", "pass", "A aplicação está a utilizar um contexto seguro HTTPS.");
  }
  return result("secure-context", "fail", "A ligação não está num contexto HTTPS seguro. Não introduzas credenciais neste estado.");
}

async function checkAppIntegrity() {
  const marker = document.querySelector('meta[name="academic-hub-version"]')?.getAttribute("content")?.trim();
  if (marker === APP_VERSION) {
    return result("app-integrity", "pass", `Interface e marcador do app-shell estão alinhados na versão ${APP_VERSION}.`);
  }
  return result(
    "app-integrity",
    "warning",
    `A interface indica v${APP_VERSION}, mas o app-shell${marker ? ` indica v${marker}` : " não apresenta versão"}.`,
    { fixable: true },
  );
}

async function checkServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return result("service-worker", "warning", "Este navegador não disponibiliza Service Worker. A aplicação continua acessível, mas sem o ciclo PWA completo.");
  }

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    return result("service-worker", "warning", "O Service Worker ainda não está registado neste dispositivo.", { fixable: true });
  }

  const version = await queryServiceWorkerVersion(registration);
  if (!version?.appVersion) {
    return result("service-worker", "warning", "O Service Worker está ativo, mas não respondeu à verificação de versão.", { fixable: true });
  }

  if (version.appVersion !== APP_VERSION || version.swVersion !== PWA_REVISION) {
    const activeRevision = version.swVersion ? ` (revisão ${version.swVersion})` : "";
    return result(
      "service-worker",
      "warning",
      `O motor PWA está em v${version.appVersion}${activeRevision} e a aplicação espera v${APP_VERSION} (revisão ${PWA_REVISION}). É recomendada uma atualização técnica neste dispositivo.`,
      { fixable: true },
    );
  }

  return result("service-worker", "pass", `Service Worker ativo e alinhado com v${APP_VERSION} · revisão ${PWA_REVISION}.`);
}

async function checkCentralBaseline() {
  try {
    const central = await fetchCentralStatus();
    const auditAt = central.lastAudit ? new Date(central.lastAudit).getTime() : Number.NaN;
    const stale = !Number.isFinite(auditAt) || Date.now() - auditAt > EIGHT_DAYS_MS;
    const failedControl = central.checks?.some((check) => check.status === "fail") ?? false;

    if (central.status === "review" || failedControl) {
      return result("central-baseline", "fail", "A vistoria central assinala um controlo de segurança que requer intervenção técnica.");
    }
    if (stale || central.status !== "protected") {
      return result("central-baseline", "warning", "A última vistoria central está desatualizada ou requer nova validação no servidor.");
    }
    return result(
      "central-baseline",
      "pass",
      `Baseline ${central.securityLevel ?? "ativa"} validada pela última vistoria automática.`,
    );
  } catch {
    return result("central-baseline", "warning", "Não foi possível consultar agora o resultado da vistoria central. Tenta novamente quando houver ligação.");
  }
}

async function fetchSecurityActivity(cfg: CloudConfig, session: AuthSession) {
  return fetchWithTimeout(`${cfg.supabaseUrl}/functions/v1/security-activity`, {
    method: "GET",
    cache: "no-store",
    headers: {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}

async function checkAccountSecurity() {
  const cfg = cloudConfig();
  if (!cfg) {
    return result("account-security", "warning", "A configuração Cloud não está disponível neste dispositivo.");
  }

  const storedSession = getStoredSession(cfg);
  if (!storedSession?.access_token) {
    return result("account-security", "pass", "Não existe sessão Cloud ativa neste dispositivo; não há token remoto a validar.");
  }

  try {
    let session = storedSession;
    let response = await fetchSecurityActivity(cfg, session);

    if (response.status === 401 && session.refresh_token) {
      try {
        session = await refreshSession(cfg, session);
        storeSession(cfg, session);
        response = await fetchSecurityActivity(cfg, session);
      } catch {
        return result("account-security", "warning", "A sessão Cloud expirou e não foi possível renová-la. Volta a iniciar sessão em Conta e Perfil; os dados locais não são afetados.");
      }
    }

    if (response.status === 401) {
      return result("account-security", "warning", "A sessão Cloud já não foi aceite. Volta a iniciar sessão em Conta e Perfil para renovar o acesso.");
    }
    if (!response.ok) {
      return result("account-security", "warning", "O serviço de atividade de segurança não respondeu normalmente neste momento.");
    }

    const payload = await response.json() as { activity?: ActivityItem[] };
    const activity = Array.isArray(payload.activity) ? payload.activity : [];
    const unresolvedIncident = activity.some((item) =>
      Boolean(
        item.incident_reference &&
        item.incident_status !== "resolved" &&
        item.incident_status !== "false_positive",
      ),
    );

    if (unresolvedIncident) {
      return result("account-security", "warning", "Existe atividade associada a um incidente ainda não encerrado. Consulta Segurança da conta.");
    }

    return result("account-security", "pass", "Sessão aceite e sem incidentes de segurança pendentes para esta conta.");
  } catch {
    return result("account-security", "warning", "Não foi possível validar agora a sessão e a atividade de segurança da conta.");
  }
}

async function checkSecurityAlerts() {
  if (!pushSupported()) {
    return result("security-alerts", "pass", "Este navegador não suporta Push; a proteção da conta continua ativa sem notificações do sistema.");
  }

  if (Notification.permission === "denied") {
    return result("security-alerts", "warning", "As notificações estão bloqueadas neste dispositivo. É uma recomendação opcional e não reduz a proteção base.");
  }
  if (Notification.permission !== "granted") {
    return result("security-alerts", "warning", "As notificações ainda não foram autorizadas neste dispositivo. É uma recomendação opcional.");
  }

  try {
    const subscription = await currentPushSubscription();
    if (!subscription) {
      return result("security-alerts", "warning", "A permissão Push está ativa, mas falta a subscrição deste dispositivo.", { fixable: true });
    }
    return result("security-alerts", "pass", "Este dispositivo está preparado para receber alertas Push, incluindo avisos de segurança aplicáveis.");
  } catch {
    return result("security-alerts", "warning", "Não foi possível confirmar a subscrição Push neste momento.", { fixable: true });
  }
}

export async function runSecuritySelfCheck(id: SecuritySelfCheckId): Promise<SecuritySelfCheckResult> {
  switch (id) {
    case "secure-context": return checkSecureContext();
    case "app-integrity": return checkAppIntegrity();
    case "service-worker": return checkServiceWorker();
    case "central-baseline": return checkCentralBaseline();
    case "account-security": return checkAccountSecurity();
    case "security-alerts": return checkSecurityAlerts();
  }
}

export function securityOverallStatus(results: SecuritySelfCheckResult[]): SecurityOverallStatus {
  const critical = results.filter((item) => item.critical);
  if (critical.some((item) => item.status === "fail")) return "fail";
  if (critical.some((item) => item.status === "warning")) return "warning";
  return "pass";
}

export function hasFixableSecurityIssue(results: SecuritySelfCheckResult[]) {
  return results.some((item) => item.fixable && item.status !== "pass");
}

export async function repairSecurityIssues(results: SecuritySelfCheckResult[]) {
  const ids = new Set(results.filter((item) => item.fixable && item.status !== "pass").map((item) => item.id));

  if ((ids.has("service-worker") || ids.has("app-integrity")) && "serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update().catch(() => {});
      const waiting = registration.waiting;
      if (waiting) {
        const changed = new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, 5000);
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            window.clearTimeout(timer);
            resolve();
          }, { once: true });
        });
        waiting.postMessage({ type: "SKIP_WAITING" });
        await changed;
      }
    }
  }

  if (ids.has("security-alerts") && pushSupported() && Notification.permission === "granted") {
    await reconcilePushOnThisDevice().catch(() => null);
  }
}
