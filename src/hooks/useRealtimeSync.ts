import { useCallback, useEffect, useRef } from "react";

import { CLOUD_SYNC_NOTICE_EVENT } from "@/components/CloudSyncNotice";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/lib/AppStore";
import { fetchRemoteState, getStoredSession, isUabStudentEmail, type CloudConfig } from "@/lib/cloudSync";
import {
  CLOUD_CONFLICT_CHANGED_EVENT,
  CLOUD_CONFLICT_KEY,
  cloudStateFingerprint,
  getDeviceId,
  getSyncBaseline,
  hasCloudConflict,
  setSyncBaseline,
} from "@/lib/cloudSyncState";
import { isChangeFromAnotherDevice, type RealtimeUserStatePayload } from "@/lib/realtimeSync";
import type { AppState } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";

function notify(detail: { kind: "updated" | "conflict"; updatedAt?: string; deviceLabel?: string; message?: string }) {
  window.dispatchEvent(new CustomEvent(CLOUD_SYNC_NOTICE_EVENT, { detail }));
}

function persistConflict(localState: AppState, remoteState: AppState & { syncMeta?: { deviceLabel?: string } }, remoteUpdatedAt: string) {
  localStorage.setItem(CLOUD_CONFLICT_KEY, JSON.stringify({
    createdAt: new Date().toISOString(),
    localState,
    remoteState,
    localUpdatedAt: localState.sync?.lastSyncAt,
    remoteUpdatedAt,
    remoteDeviceLabel: remoteState.syncMeta?.deviceLabel,
  }));
  window.dispatchEvent(new Event(CLOUD_CONFLICT_CHANGED_EVENT));
}

export function useRealtimeSync() {
  const { state, setSync, replaceState } = useAppStore();
  const stateRef = useRef(state);
  stateRef.current = state;

  const cloudConfig: CloudConfig | null = (() => {
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
    const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
    return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
  })();

  const applyRemote = useCallback((remoteState: AppState, updatedAt: string, deviceLabel?: string) => {
    const next: AppState = {
      ...remoteState,
      meta: { ...(remoteState.meta ?? {}), appVersion: APP_VERSION },
      sync: { ...(remoteState.sync ?? { enabled: true }), enabled: true, lastSyncAt: updatedAt },
    };
    setSyncBaseline(next);
    replaceState(next);
    notify({ kind: "updated", updatedAt, deviceLabel });
  }, [replaceState]);

  useEffect(() => {
    if (!cloudConfig || !state.sync?.enabled || typeof navigator === "undefined" || !navigator.onLine) return;
    const session = getStoredSession(cloudConfig);
    if (!session || !isUabStudentEmail(session.user.email)) return;

    const deviceId = getDeviceId();
    let cancelled = false;
    void supabase.realtime.setAuth(session.access_token);

    const handleRemoteChange = async (payload: RealtimeUserStatePayload) => {
      if (cancelled || hasCloudConflict()) return;
      if (!isChangeFromAnotherDevice(payload, session.user.id, deviceId)) return;

      try {
        const remote = await fetchRemoteState(cloudConfig, session);
        if (!remote?.state || cancelled) return;

        const current = stateRef.current;
        const remoteState = remote.state as AppState & { syncMeta?: { deviceLabel?: string } };
        const localFp = cloudStateFingerprint(current);
        const remoteFp = cloudStateFingerprint(remoteState);
        const baseline = getSyncBaseline();

        if (localFp === remoteFp) {
          setSyncBaseline(remoteFp);
          setSync({ lastSyncAt: remote.updated_at });
          return;
        }

        if (baseline && localFp === baseline) {
          applyRemote(remoteState, remote.updated_at, remoteState.syncMeta?.deviceLabel);
          return;
        }

        if (baseline && remoteFp === baseline) return;

        persistConflict(current, remoteState, remote.updated_at);
        notify({ kind: "conflict", message: "Foram feitas alterações diferentes em dois dispositivos. Escolhe qual versão deve prevalecer nas Definições." });
      } catch (error) {
        console.warn("[RealtimeSync] Não foi possível aplicar alteração remota:", error);
      }
    };

    const channel = supabase
      .channel(`academic-hub-user-state-${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_state", filter: `user_id=eq.${session.user.id}` },
        (payload) => void handleRemoteChange(payload as RealtimeUserStatePayload),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [applyRemote, cloudConfig?.supabaseUrl, state.sync?.enabled, setSync]);
}
