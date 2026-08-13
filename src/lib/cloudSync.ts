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

let refreshInFlight: Promise<AuthSession> | null = null;

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

  if (!normalizedEmail) throw new Error("Indica o email antes de continuar.");
  if (!EMAIL_PATTERN.test(normalizedEmail)) throw new Error("Indica um endereço de email válido.");
  if (options?.creatingAccount && !isUabStudentEmail(normalizedEmail)) throw new Error(`A criação de conta é exclusiva a estudantes da UAb. Utiliza o teu email @${UAB_STUDENT_EMAIL_DOMAIN}.`);
  if (!password) throw new Error("Indica a password antes de continuar.");
  if (options?.creatingAccount && password.length < 8) throw new Error("A password deve ter pelo menos 8 caracteres.");

  return { email: normalizedEmail, password };
}

function friendlyAuthError(json: unknown, fallback: string): string {
  const code = (getStringField(json, "code", "error_code") ?? "").toLowerCase();
  const rawMessage = (getStringField(json, "msg", "message", "error_description", "error") ?? fallback ?? "").toLowerCase();
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || code === "rate_limit_exceeded" || rawMessage.includes("request rate limit reached") || rawMessage.includes("rate limit") || rawMessage.includes("too many requests")) return "Foram efetuadas demasiadas tentativas num curto espaço de tempo. Aguarda alguns minutos antes de tentar novamente.";
  if (code === "pgrst303" || code === "bad_jwt" || rawMessage.includes("jwt expired") || rawMessage.includes("token has expired")) return "A sessão da cloud expirou. A aplicação tentou renová-la automaticamente. Se o problema continuar, sai da conta e volta a entrar; os dados locais serão mantidos.";
  if (code === "anonymous_provider_disabled") return "Indica um email e uma password válidos. A aplicação não cria contas anónimas.";
  if (code === "email_provider_disabled") return "A criação de contas por email está desativada no Supabase.";
  if (code === "signup_disabled") return "A criação de novas contas está desativada no Supabase.";
  if (code === "email_exists" || code === "user_already_exists") return "Já existe uma conta associada a este email.";
  if (code === "email_not_confirmed") return "O email ainda não foi confirmado. Abre o link enviado pelo Supabase.";
  if (code === "invalid_credentials") return "Email ou password incorretos.";
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
    if (!session) localStorage.removeItem(AUTH_KEY);
    else localStorage.setItem(AUTH_KEY, JSON.stringify({ url: normUrl(config.supabaseUrl), session }));
  } catch {
    // Sem impacto funcional quando o armazenamento local não está disponível.
  } finally {
    // `storage` só é emitido noutras abas. Este evento atualiza imediatamente
    // componentes da própria aba (por exemplo, o aviso de modo exploração).
    if (typeof window !== "undefined") window.dispatchEvent(new Event("academic-hub-auth-changed"));
  }
}

function headers(config: CloudConfig, session?: AuthSession | null) {
  assertNotServiceRoleKey(config.supabaseAnonKey);
  const h: Record<string, string> = { apikey: config.supabaseAnonKey, "Content-Type": "application/json" };
  if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
  return h;
}

async function parseResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? (JSON.parse(text) as unknown) : null; } catch { /* resposta não JSON */ }
  if (!res.ok) throw new Error(friendlyAuthError(json, res.statusText));
  return json;
}

async function postJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  return (await parseResponse(res)) as T;
}

async function parseRestError(res: Response, fallback: string): Promise<Error> {
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? (JSON.parse(text) as unknown) : null; } catch { /* texto bruto como fallback */ }
  return new Error(friendlyAuthError(json, text || res.statusText || fallback));
}

export type SignUpResult = { session: AuthSession | null; confirmationRequired: boolean };

export async function signUp(config: CloudConfig, email: string, password: string): Promise<SignUpResult> {
  const credentials = validateCredentials(email, password, { creatingAccount: true });
  const data = await postJson<{ access_token?: string; refresh_token?: string; token_type?: string; expires_in?: number; expires_at?: number; user?: AuthSession["user"] }>(`${normUrl(config.supabaseUrl)}/auth/v1/signup`, { method: "POST", headers: headers(config), body: JSON.stringify(credentials) });
  if (data.access_token && data.refresh_token && data.user) return { session: data as AuthSession, confirmationRequired: false };
  return { session: null, confirmationRequired: true };
}

export async function signIn(config: CloudConfig, email: string, password: string): Promise<AuthSession> {
  const credentials = validateCredentials(email, password);
  return await postJson<AuthSession>(`${normUrl(config.supabaseUrl)}/auth/v1/token?grant_type=password`, { method: "POST", headers: headers(config), body: JSON.stringify(credentials) });
}

export async function refreshSession(config: CloudConfig, session: AuthSession): Promise<AuthSession> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = postJson<AuthSession>(`${normUrl(config.supabaseUrl)}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: headers(config), body: JSON.stringify({ refresh_token: session.refresh_token }) }).finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function fetchRemoteState(config: CloudConfig, session: AuthSession): Promise<UserStateRow | null> {
  const res = await fetch(`${normUrl(config.supabaseUrl)}/rest/v1/user_states?user_id=eq.${encodeURIComponent(session.user.id)}&select=user_id,state,updated_at&limit=1`, { headers: headers(config, session) });
  if (!res.ok) throw await parseRestError(res, "Não foi possível carregar os dados da cloud.");
  const rows = (await res.json()) as UserStateRow[];
  return rows[0] ?? null;
}

export async function upsertRemoteState(config: CloudConfig, session: AuthSession, state: AppState): Promise<UserStateRow> {
  const res = await fetch(`${normUrl(config.supabaseUrl)}/rest/v1/user_states?on_conflict=user_id`, { method: "POST", headers: { ...headers(config, session), Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ user_id: session.user.id, state }) });
  if (!res.ok) throw await parseRestError(res, "Não foi possível guardar os dados na cloud.");
  const rows = (await res.json()) as UserStateRow[];
  if (!rows[0]) throw new Error("A cloud não devolveu confirmação da gravação.");
  return rows[0];
}

export async function getOrCreateAccountMigrationStatus(config: CloudConfig, session: AuthSession): Promise<AccountMigrationStatus> {
  const existing = await fetch(`${normUrl(config.supabaseUrl)}/rest/v1/account_migrations?user_id=eq.${encodeURIComponent(session.user.id)}&select=user_id,first_detected_at,deadline&limit=1`, { headers: headers(config, session) });
  if (!existing.ok) throw await parseRestError(existing, "Não foi possível consultar o estado da conta.");
  const rows = (await existing.json()) as AccountMigrationStatus[];
  if (rows[0]) return rows[0];
  const created = await fetch(`${normUrl(config.supabaseUrl)}/rest/v1/account_migrations`, { method: "POST", headers: { ...headers(config, session), Prefer: "return=representation" }, body: JSON.stringify({ user_id: session.user.id }) });
  if (!created.ok) throw await parseRestError(created, "Não foi possível registar o estado da conta.");
  const createdRows = (await created.json()) as AccountMigrationStatus[];
  if (!createdRows[0]) throw new Error("Não foi possível confirmar o estado da conta.");
  return createdRows[0];
}

export async function requestAccountEmailChange(config: CloudConfig, session: AuthSession, email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!isUabStudentEmail(normalized)) throw new Error(`Utiliza o teu email @${UAB_STUDENT_EMAIL_DOMAIN}.`);
  const res = await fetch(`${normUrl(config.supabaseUrl)}/auth/v1/user`, { method: "PUT", headers: headers(config, session), body: JSON.stringify({ email: normalized }) });
  if (!res.ok) throw await parseRestError(res, "Não foi possível iniciar a alteração de email.");
}

export async function deleteUserAccount(config: CloudConfig, session: AuthSession): Promise<void> {
  const res = await fetch(`${normUrl(config.supabaseUrl)}/functions/v1/delete-account`, { method: "POST", headers: headers(config, session) });
  if (!res.ok) throw await parseRestError(res, "Não foi possível eliminar a conta.");
}
