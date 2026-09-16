import { getStoredSession, type CloudConfig } from "@/lib/cloudSync";
import { APP_VERSION } from "@/lib/version";

export type ClientErrorCode =
  | "interface_chunk"
  | "update_failed"
  | "auth_confirmation"
  | "cloud_sync"
  | "unexpected_ui";

type ReportClientErrorArgs = {
  errorCode: ClientErrorCode;
  summary: string;
  route?: string;
  accessToken?: string | null;
};

function cloudConfig(): CloudConfig | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const supabaseAnonKey = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

function currentRoute() {
  return `${window.location.pathname}${window.location.hash || ""}`.slice(0, 240);
}

export async function reportClientError(args: ReportClientErrorArgs) {
  const config = cloudConfig();
  if (!config) return;

  const stored = getStoredSession(config);
  const accessToken = args.accessToken?.trim() || stored?.access_token || "";
  if (!accessToken) return;

  try {
    await fetch(`${config.supabaseUrl}/functions/v1/client-error-report`, {
      method: "POST",
      cache: "no-store",
      keepalive: true,
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        errorCode: args.errorCode,
        summary: String(args.summary || "Erro técnico").slice(0, 500),
        route: args.route || currentRoute(),
        appVersion: APP_VERSION,
      }),
    });
  } catch {
    // A telemetria nunca pode criar um segundo erro nem bloquear o aluno.
  }
}
