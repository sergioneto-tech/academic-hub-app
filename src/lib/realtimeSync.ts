import type { AppState } from "@/lib/types";
import { cloudStateFingerprint } from "@/lib/cloudSyncState";

export type RealtimeUserStatePayload = {
  new?: {
    user_id?: string;
    state?: AppState & { syncMeta?: { deviceId?: string; deviceLabel?: string } };
    updated_at?: string;
  } | null;
};

export function isChangeFromAnotherDevice(
  payload: RealtimeUserStatePayload,
  currentUserId: string,
  currentDeviceId: string,
): boolean {
  const row = payload.new;
  if (!row || row.user_id !== currentUserId) return false;
  const sourceDeviceId = row.state?.syncMeta?.deviceId;
  return !sourceDeviceId || sourceDeviceId !== currentDeviceId;
}

export function hasSameCloudContent(local: AppState, remote: AppState): boolean {
  return cloudStateFingerprint(local) === cloudStateFingerprint(remote);
}
