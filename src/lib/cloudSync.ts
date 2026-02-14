import type { AppState } from "@/lib/types";

export type CloudConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

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

function normUrl(u: string) {
  return (u || "").trim().replace(/\/$/, "");
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
    const msg = json?.msg || json?.message || json?.error_description || json?.error || res.statusText || "Erro";
    throw new Error(String(msg));
  }
  return json as T;
}

export type SignUpResult = {
  session: AuthSession | null;
  confirmationRequired: boolean;
};

export async function signUp(config: CloudConfig, email: string, password: string): Promise<SignUpResult> {
  const url = `${normUrl(config.supabaseUrl)}/auth/v1/signup`;
  const data = await postJson<any>(url, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({ email, password }),
  });

  // When email confirmation is required, Supabase returns the user object
  // but without a valid access_token / refresh_token
  if (!data?.access_token) {
    return { session: null, confirmationRequired: true };
  }
  return { session: data as AuthSession, confirmationRequired: false };
}

export async function signIn(config: CloudConfig, email: string, password: string): Promise<AuthSession> {
  const url = `${normUrl(config.supabaseUrl)}/auth/v1/token?grant_type=password`;
  return postJson<AuthSession>(url, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({ email, password }),
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
  const res = await fetch(url, { headers: headers(config, session) });
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
