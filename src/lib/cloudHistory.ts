import type { AppState } from "@/lib/types";
import type { AuthSession, CloudConfig } from "@/lib/cloudSync";

export type CloudHistoryRow = {
  id: number;
  user_id: string;
  state: AppState;
  source_updated_at: string;
  created_at: string;
  device_label?: string | null;
  app_version?: string | null;
};

function headers(config: CloudConfig, session: AuthSession) {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export async function fetchCloudHistory(config: CloudConfig, session: AuthSession): Promise<CloudHistoryRow[]> {
  const url = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/user_state_history?user_id=eq.${session.user.id}&select=id,user_id,state,source_updated_at,created_at,device_label,app_version&order=created_at.desc&limit=10`;
  const response = await fetch(url, { headers: headers(config, session), cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível consultar o histórico da cloud.");
  return (await response.json()) as CloudHistoryRow[];
}
