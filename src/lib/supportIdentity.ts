import { useCallback, useEffect, useState } from "react";

import {
  getStoredSession,
  refreshSession,
  storeSession,
  type AuthSession,
  type CloudConfig,
} from "@/lib/cloudSync";

export type SupportIdentityState = {
  supportId: string | null;
  loading: boolean;
  available: boolean;
};

export function getAcademicHubCloudConfig(): CloudConfig | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

function sessionNeedsRefresh(session: AuthSession) {
  const expiresAtMs = Number(session.expires_at ?? 0) * 1000;
  return Boolean(expiresAtMs && expiresAtMs <= Date.now() + 60_000);
}

async function requestSupportId(config: CloudConfig, session: AuthSession) {
  const url = new URL(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/user_support_identity`);
  url.searchParams.set("select", "support_id");
  url.searchParams.set("user_id", `eq.${session.user.id}`);
  url.searchParams.set("limit", "1");

  return fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
      Accept: "application/json",
    },
  });
}

export async function fetchMySupportId(config: CloudConfig, sourceSession: AuthSession): Promise<string | null> {
  let session = sourceSession;

  if (sessionNeedsRefresh(session)) {
    try {
      session = await refreshSession(config, session);
      storeSession(config, session);
    } catch {
      // A leitura abaixo pode ainda funcionar enquanto o token atual for aceite.
    }
  }

  let response = await requestSupportId(config, session);

  if (response.status === 401) {
    try {
      session = await refreshSession(config, session);
      storeSession(config, session);
      response = await requestSupportId(config, session);
    } catch {
      return null;
    }
  }

  if (!response.ok) return null;
  const rows = (await response.json().catch(() => [])) as Array<{ support_id?: unknown }>;
  const value = typeof rows[0]?.support_id === "string" ? rows[0].support_id.trim() : "";
  return /^AH-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(value) ? value : null;
}

export function useMySupportIdentity(): SupportIdentityState {
  const [state, setState] = useState<SupportIdentityState>({
    supportId: null,
    loading: true,
    available: false,
  });

  const reload = useCallback(() => {
    const config = getAcademicHubCloudConfig();
    if (!config) {
      setState({ supportId: null, loading: false, available: false });
      return;
    }

    const session = getStoredSession(config);
    if (!session) {
      setState({ supportId: null, loading: false, available: false });
      return;
    }

    setState((current) => ({ ...current, loading: true }));
    void fetchMySupportId(config, session)
      .then((supportId) => setState({ supportId, loading: false, available: Boolean(supportId) }))
      .catch(() => setState({ supportId: null, loading: false, available: false }));
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener("academic-hub-auth-changed", reload);
    return () => window.removeEventListener("academic-hub-auth-changed", reload);
  }, [reload]);

  return state;
}
