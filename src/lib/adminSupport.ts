import {
  getStoredSession,
  refreshSession,
  storeSession,
  type AuthSession,
  type CloudConfig,
} from "@/lib/cloudSync";
import { getPublicSupabaseConfig } from "@/lib/publicSupabaseConfig";

export type AdminSupportLookup = {
  supportId: string;
  account: {
    exists: boolean;
    createdAt: string | null;
    emailVerified: boolean;
    lastSignInAt: string | null;
  };
  cloud: {
    hasState: boolean;
    updatedAt: string | null;
  };
  push: {
    subscriptions: number;
    enabledSubscriptions: number;
    lastUpdatedAt: string | null;
  };
  errors: {
    openCount: number;
    recentCount: number;
    latest: null | {
      error_code: string | null;
      route: string | null;
      app_version: string | null;
      occurrence_count: number | null;
      last_seen_at: string | null;
      status: string | null;
    };
  };
  feedback: {
    activeCount: number;
    recent: Array<{
      reference: string;
      status: string;
      app_version: string | null;
      created_at: string;
      updated_at: string;
    }>;
  };
  puc: {
    pendingCount: number;
    recentCount: number;
    latestStatus: string | null;
    latestUpdatedAt: string | null;
  };
};

function sessionNeedsRefresh(session: AuthSession) {
  const expiresAtMs = Number(session.expires_at ?? 0) * 1000;
  return Boolean(expiresAtMs && expiresAtMs <= Date.now() + 60_000);
}

async function freshSession(config: CloudConfig): Promise<AuthSession | null> {
  let session = getStoredSession(config);
  if (!session) return null;
  if (!sessionNeedsRefresh(session)) return session;
  try {
    session = await refreshSession(config, session);
    storeSession(config, session);
    return session;
  } catch {
    return null;
  }
}

async function callAdminSupport(body: Record<string, unknown>) {
  const config = getPublicSupabaseConfig();
  if (!config) return { status: 0, data: null as unknown };
  let session = await freshSession(config);
  if (!session) return { status: 401, data: { error: "unauthorized" } };

  const request = async (activeSession: AuthSession) => fetch(
    `${config.supabaseUrl.replace(/\/$/, "")}/functions/v1/admin-support-lookup`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${activeSession.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  let response = await request(session);
  if (response.status === 401) {
    try {
      session = await refreshSession(config, session);
      storeSession(config, session);
      response = await request(session);
    } catch {
      return { status: 401, data: { error: "unauthorized" } };
    }
  }

  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

export async function canAccessAdminSupport(): Promise<boolean> {
  const response = await callAdminSupport({ action: "access" });
  return response.status === 200 && Boolean((response.data as { allowed?: boolean } | null)?.allowed);
}

export function normalizeSupportId(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidSupportId(value: string) {
  return /^AH-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(normalizeSupportId(value));
}

export function normalizeSupportReason(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidSupportReason(value: string) {
  const reason = normalizeSupportReason(value);
  return reason.length >= 8 && reason.length <= 500;
}

export async function lookupAdminSupport(value: string, reasonValue: string): Promise<AdminSupportLookup> {
  const supportId = normalizeSupportId(value);
  const reason = normalizeSupportReason(reasonValue);
  if (!isValidSupportId(supportId)) throw new Error("invalid_support_id");
  if (!isValidSupportReason(reason)) throw new Error("invalid_reason");
  const response = await callAdminSupport({ supportId, reason });
  if (response.status === 404) throw new Error("not_found");
  if (response.status === 403) throw new Error("forbidden");
  if (response.status === 401) throw new Error("unauthorized");
  const apiError = (response.data as { error?: string } | null)?.error;
  if (apiError === "invalid_reason") throw new Error("invalid_reason");
  if (apiError === "audit_failed") throw new Error("audit_failed");
  if (response.status !== 200 || !response.data) throw new Error("lookup_failed");
  return response.data as AdminSupportLookup;
}
