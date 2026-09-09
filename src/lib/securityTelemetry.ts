import type { AuthSession, CloudConfig } from "@/lib/cloudSync";
import { APP_VERSION } from "@/lib/version";

type SecurityEventType = "login_success" | "login_failed" | "password_recovery" | "rate_limited";

type ReportArgs = {
  eventType: SecurityEventType;
  email?: string;
  session?: AuthSession | null;
  deviceLabel?: string;
};

function config(): CloudConfig | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

export async function reportAuthSecurityEvent(args: ReportArgs) {
  const cloud = config();
  if (!cloud) return;
  try {
    const headers: Record<string,string> = {
      apikey: cloud.supabaseAnonKey,
      "Content-Type": "application/json",
    };
    if (args.session?.access_token) headers.Authorization = `Bearer ${args.session.access_token}`;
    await fetch(`${cloud.supabaseUrl.replace(/\/$/, "")}/functions/v1/security-event`, {
      method: "POST",
      cache: "no-store",
      headers,
      body: JSON.stringify({
        eventType: args.eventType,
        email: args.email?.trim().toLowerCase() || undefined,
        deviceLabel: args.deviceLabel,
        appVersion: APP_VERSION,
      }),
    });
  } catch {
    // Telemetria de segurança nunca deve impedir o login normal do aluno.
  }
}
