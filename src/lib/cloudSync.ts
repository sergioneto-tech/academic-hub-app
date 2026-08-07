import type { AppState } from "@/lib/types";

export type CloudConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function getStringField(value: unknown, ...keys: string[]): string | undefined {
  const record = asRecord(value);
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return undefined;
}

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  return atob(b64 + pad);
}

function getJwtRole(jwt: string): string | undefined {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return undefined;
    const payload = asRecord(JSON.parse(decodeBase64Url(parts[1])) as unknown);
    return typeof payload.role === "string" ? payload.role : undefined;
  } catch {
    return undefined;
  }
}

function assertNotServiceRoleKey(key: string) {
  const role = getJwtRole(key);
  if (role === "service_role") {
    throw new Error(
      "Configuração insegura: foi detetada uma service-role key no frontend. Usa SEMPRE a anon/publishable key (VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY).",
    );
  }
}

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  user: { id: string; email?: string };
};

type UserStateRow = {
  user_id: string;
  state: AppState;
  updated_at: string;
};

export type AccountMigrationStatus = {
  user_id: string;
  first_detected_at: string;
  deadline: string;
};

const AUTH_KEY = "academic_hub_cloud_auth";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const UAB_STUDENT_EMAIL_DOMAIN = "estudante.uab.pt";

export function isUabStudentEmail(email?: string | null): boolean {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) return false;
  return normalized.split("@")[1] === UAB_STUDENT_EMAIL_DOMAIN;
}

function normUrl(u: string) {
  return (u || "").trim().replace(/\/$/, "");
}

function validateCredentials(email: string, password: string, options?: { creatingAccount?: boolean }) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Indica o email antes de continuar.");
  }
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new Error("Indica um endereço de email válido.");
  }
  if (options?.creatingAccount && !isUabStudentEmail(normalizedEmail)) {
    throw new Error(`A criação de conta é exclusiva a estudantes da UAb. Utiliza o teu email @${UAB_STUDENT_EMAIL_DOMAIN}.`);
  }
  if (!password) {
    throw new Error("Indica a password antes de continuar.");
  }
  if (options?.creatingAccount && password.length < 8) {
    throw new Error("A password deve ter pelo menos 8 caracteres.");
  }

  return { email: normalizedEmail, password };
}

function friendlyAuthError(json: unknown, fallback: string): string {
  const code = (getStringField(json, "code", "error_code") ?? "").toLowerCase();
  const rawMessage = (getStringField(json, "msg", "message", "error_description", "error") ?? fallback ?? "").toLowerCase();

  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit" ||
    code === "rate_limit_exceeded" ||
    rawMessage.includes("request rate limit reached") ||
    rawMessage.includes("rate limit") ||
    rawMessage.includes("too many requests")
  ) {
    return "Foram efetuadas demasiadas tentativas num curto espaço de tempo. Aguarda alguns minutos antes de tentar novamente.";
  }
  if (code === "anonymous_provider_disabled") {
    return "Indica um email e uma password válidos. A aplicação não cria contas anónimas.";
  }
  if (code === "email_provider_disabled") {
    return "A criação de contas por email está desativada no Supabase.";
  }
  if (code === "signup_disabled") {
    return "A criação de novas contas está desativada no Supabase.";
  }
  if (code === "email_exists" || code === "user_already_exists") {
    return "Já existe uma conta associada a este email.";
  }
  if (code === "email_not_confirmed") {
    return "O email ainda não foi confirmado. Abre o link enviado pelo Supabase.";
  }
  if (code === "invalid_credentials") {
    return "Email ou password incorretos.";
  }

  return getStringField(json, "msg", "message", "error_description", "error") ?? fallback ?? "Erro";
}

export function getStoredSession(config: CloudConfig): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { url: string; session: AuthSession };
    if (!parsed?.session) return null;
    if (normUrl(parsed.url) !== normUrl(config.supabaseUrl)) return null;
    return parsed.session;
  } catch {
    return null;
  }
}

export function storeSession(config: CloudConfig, session: AuthSession | null) {
  try {
    if (!session) {
      localStorage.removeItem(AUTH_KEY);
      return;
    }
    localStorage.setItem(AUTH_KEY, JSON.stringify({ url: normUrl(config.supabaseUrl), session }));
  } catch {
    // Sem impacto funcional quando o armazenamento local não está disponível.
  }
}

function headers(config: CloudConfig, session?: AuthSession | null) {
  assertNotServiceRoleKey(config.supabaseAnonKey);
  const h: Record<string, string> = {
    apikey: config.supabaseAnonKey,
    "Content-Type": "application/json",
  };
  if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
  return h;
}

async function parseResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    // A resposta pode não ser JSON; o status HTTP continua a ser tratado.
  }
  if (!res.ok) {
    throw new Error(friendlyAuthError(json, res.statusText));
  }
  return json;
}

async function postJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  return (await parseResponse(res)) as T;
}

export type SignUpResult = {
  session: AuthSession | null;
  confirmationRequired: boolean;
};

export async function signUp(config: CloudConfig, email: string, password: string): Promise<SignUpResult> {
  const credentials = validateCredentials(email, password, { creatingAccount: true });
  const signupUrl = new URL(`${normUrl(config.supabaseUrl)}/auth/v1/signup`);

  if (typeof window !== "undefined" && window.location?.origin) {
    signupUrl.searchParams.set("redirect_to", window.location.origin);
  }

  const data = await postJson<Partial<AuthSession>>(signupUrl.toString(), {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify(credentials),
  });

  if (!data?.access_token) {
    return { session: null, confirmationRequired: true };
  }
  return { session: data as AuthSession, confirmationRequired: false };
}

export async function signIn(config: CloudConfig, email: string, password: string): Promise<AuthSession> {
  const credentials = validateCredentials(email, password);
  const url = `${normUrl(config.supabaseUrl)}/auth/v1/token?grant_type=password`;
  return postJson<AuthSession>(url, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify(credentials),
  });
}

export async function refreshSession(config: CloudConfig, session: AuthSession): Promise<AuthSession> {
  const url = `${normUrl(config.supabaseUrl)}/auth/v1/token?grant_type=refresh_token`;
  return postJson<AuthSession>(url, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
}

export async function requestAccountEmailChange(
  config: CloudConfig,
  session: AuthSession,
  newEmail: string,
): Promise<void> {
  const normalizedEmail = newEmail.trim().toLowerCase();
  if (!isUabStudentEmail(normalizedEmail)) {
    throw new Error(`Indica o teu endereço institucional @${UAB_STUDENT_EMAIL_DOMAIN}.`);
  }

  const url = new URL(`${normUrl(config.supabaseUrl)}/auth/v1/user`);
  if (typeof window !== "undefined" && window.location?.origin) {
    url.searchParams.set("redirect_to", window.location.origin);
  }

  await postJson<unknown>(url.toString(), {
    method: "PUT",
    headers: headers(config, session),
    body: JSON.stringify({ email: normalizedEmail }),
  });
}

async function fetchMigrationStatus(config: CloudConfig, session: AuthSession): Promise<AccountMigrationStatus | null> {
  const url = `${normUrl(config.supabaseUrl)}/rest/v1/account_email_migration?user_id=eq.${session.user.id}&select=user_id,first_detected_at,deadline&limit=1`;
  const res = await fetch(url, { headers: headers(config, session), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      // Mantém a mensagem de fallback.
    }
    const msg = getStringField(json, "message", "hint", "details") ?? res.statusText ?? "Erro ao consultar regularização da conta";
    throw new Error(msg);
  }
  const rows = (await res.json()) as AccountMigrationStatus[];
  return rows?.[0] ?? null;
}

export async function getOrCreateAccountMigrationStatus(
  config: CloudConfig,
  session: AuthSession,
): Promise<AccountMigrationStatus | null> {
  if (isUabStudentEmail(session.user.email)) return null;

  const existing = await fetchMigrationStatus(config, session);
  if (existing) return existing;

  const url = `${normUrl(config.supabaseUrl)}/rest/v1/account_email_migration`;
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      ...headers(config, session),
      Prefer: "return=representation",
    },
    body: JSON.stringify({ user_id: session.user.id }),
  });

  if (res.status === 409) {
    return fetchMigrationStatus(config, session);
  }

  const json = await parseResponse(res);
  const rows = Array.isArray(json) ? (json as AccountMigrationStatus[]) : [];
  return rows[0] ?? fetchMigrationStatus(config, session);
}

export async function fetchRemoteState(config: CloudConfig, session: AuthSession): Promise<UserStateRow | null> {
  const url = `${normUrl(config.supabaseUrl)}/rest/v1/user_state?user_id=eq.${session.user.id}&select=state,updated_at,user_id&limit=1`;
  const res = await fetch(url, { headers: headers(config, session), cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || res.statusText);
  }
  const data = (await res.json()) as UserStateRow[];
  return data?.[0] ?? null;
}

export async function upsertRemoteState(config: CloudConfig, session: AuthSession, state: AppState): Promise<UserStateRow> {
  const url = `${normUrl(config.supabaseUrl)}/rest/v1/user_state?on_conflict=user_id`;
  const payload = {
    user_id: session.user.id,
    state,
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      ...headers(config, session),
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    // Mantém a mensagem de fallback.
  }
  if (!res.ok) {
    const msg = getStringField(json, "message", "hint", "details", "error") ?? res.statusText ?? "Erro";
    throw new Error(msg);
  }

  const rows = Array.isArray(json) ? (json as UserStateRow[]) : [];
  return rows[0] ?? (payload as UserStateRow);
}

export async function deleteUserAccount(config: CloudConfig, session: AuthSession): Promise<void> {
  const deleteStateUrl = `${normUrl(config.supabaseUrl)}/rest/v1/user_state?user_id=eq.${session.user.id}`;
  const deleteStateRes = await fetch(deleteStateUrl, {
    method: "DELETE",
    headers: headers(config, session),
  });

  if (!deleteStateRes.ok) {
    const text = await deleteStateRes.text();
    let json: unknown = null;
    try {
      json = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      // Mantém a mensagem de fallback.
    }
    const msg = getStringField(json, "message", "hint", "details", "error") ?? deleteStateRes.statusText ?? "Erro ao apagar dados";
    throw new Error(msg);
  }

  const deleteAuthUrl = `${normUrl(config.supabaseUrl)}/auth/v1/user`;
  const deleteAuthRes = await fetch(deleteAuthUrl, {
    method: "DELETE",
    headers: headers(config, session),
  });

  if (!deleteAuthRes.ok) {
    const text = await deleteAuthRes.text();
    let json: unknown = null;
    try {
      json = text ? (JSON.parse(text) as unknown) : null;
    } catch {
      // Mantém a mensagem de fallback.
    }
    const msg = getStringField(json, "message", "hint", "details", "error") ?? deleteAuthRes.statusText ?? "Erro ao apagar conta";
    throw new Error(msg);
  }
}
