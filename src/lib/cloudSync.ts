import type { AppState } from "@/lib/types";

export type CloudConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  return atob(b64 + pad);
}

function getJwtRole(jwt: string): string | undefined {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return undefined;
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return payload?.role;
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

const AUTH_KEY = "academic_hub_cloud_auth";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normUrl(u: string) {
  return (u || "").trim().replace(/\/$/, "");
}

function validateCredentials(email: string, password: string, options?: { creatingAccount?: boolean }) {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    throw new Error("Indica o email antes de continuar.");
  }
  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw new Error("Indica um endereço de email válido.");
  }
  if (!password) {
    throw new Error("Indica a password antes de continuar.");
  }
  if (options?.creatingAccount && password.length < 8) {
    throw new Error("A password deve ter pelo menos 8 caracteres.");
  }

  return { email: normalizedEmail, password };
}

function friendlyAuthError(json: any, fallback: string): string {
  const code = String(json?.code || json?.error_code || "");

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

  return String(json?.msg || json?.message || json?.error_description || json?.error || fallback || "Erro");
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
    // ignore
  }
}

function headers(config: CloudConfig, session?: AuthSession | null) {
  // Nunca permitir service_role no cliente
  assertNotServiceRoleKey(config.supabaseAnonKey);
  const h: Record<string, string> = {
    apikey: config.supabaseAnonKey,
    "Content-Type": "application/json",
  };
  if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
  return h;
}

async function postJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    throw new Error(friendlyAuthError(json, res.statusText));
  }
  return json as T;
}

export type SignUpResult = {
  session: AuthSession | null;
  confirmationRequired: boolean;
};

export async function signUp(config: CloudConfig, email: string, password: string): Promise<SignUpResult> {
  const credentials = validateCredentials(email, password, { creatingAccount: true });
  const signupUrl = new URL(`${normUrl(config.supabaseUrl)}/auth/v1/signup`);

  // Garante que o link de confirmação regressa ao ambiente onde a conta foi criada.
  // Em Preview volta ao pages.dev; em produção volta ao domínio oficial.
  if (typeof window !== "undefined" && window.location?.origin) {
    signupUrl.searchParams.set("redirect_to", window.location.origin);
  }

  const data = await postJson<any>(signupUrl.toString(), {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify(credentials),
  });

  // When email confirmation is required, Supabase returns the user object
  // but without a valid access_token / refresh_token
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
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = json?.message || json?.hint || json?.details || json?.error || res.statusText || "Erro";
    throw new Error(String(msg));
  }

  const rows = (json as UserStateRow[]) ?? [];
  return rows[0] ?? (payload as unknown as UserStateRow);
}

export async function deleteUserAccount(config: CloudConfig, session: AuthSession): Promise<void> {
  // Primeiro, apagar os dados do utilizador na tabela user_state
  const deleteStateUrl = `${normUrl(config.supabaseUrl)}/rest/v1/user_state?user_id=eq.${session.user.id}`;
  const deleteStateRes = await fetch(deleteStateUrl, {
    method: "DELETE",
    headers: headers(config, session),
  });

  if (!deleteStateRes.ok) {
    const text = await deleteStateRes.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // ignore
    }
    const msg = json?.message || json?.hint || json?.details || json?.error || deleteStateRes.statusText || "Erro ao apagar dados";
    throw new Error(String(msg));
  }

  // Depois, apagar a conta de autenticação
  const deleteAuthUrl = `${normUrl(config.supabaseUrl)}/auth/v1/user`;
  const deleteAuthRes = await fetch(deleteAuthUrl, {
    method: "DELETE",
    headers: headers(config, session),
  });

  if (!deleteAuthRes.ok) {
    const text = await deleteAuthRes.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // ignore
    }
    const msg = json?.message || json?.hint || json?.details || json?.error || deleteAuthRes.statusText || "Erro ao apagar conta";
    throw new Error(String(msg));
  }
}
