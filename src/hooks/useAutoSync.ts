import { useEffect, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/AppStore";
import { APP_VERSION } from "@/lib/version";
import { CLOUD_SYNC_NOTICE_EVENT, type CloudSyncNoticeDetail } from "@/components/CloudSyncNotice";
import {
  CLOUD_CONFLICT_CHANGED_EVENT,
  CLOUD_CONFLICT_KEY,
  cloudStateFingerprint,
  getDeviceId,
  getDeviceLabel,
  getSyncBaseline,
  hasCloudConflict,
  isLocallyFresh,
  setSyncBaseline,
} from "@/lib/cloudSyncState";
import {
  type CloudConfig,
  type AuthSession,
  fetchRemoteState,
  getStoredSession,
  isUabStudentEmail,
  refreshSession,
  storeSession,
  upsertRemoteState,
} from "@/lib/cloudSync";
import type { AppState } from "@/lib/types";

const SESSION_REFRESH_MARGIN_SECONDS = 5 * 60;

function notify(detail: CloudSyncNoticeDetail) { window.dispatchEvent(new CustomEvent(CLOUD_SYNC_NOTICE_EVENT, { detail })); }

function sessionNeedsRefresh(session: AuthSession): boolean {
  if (!session.expires_at) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return session.expires_at <= nowSeconds + SESSION_REFRESH_MARGIN_SECONDS;
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

export function useAutoSync() {
  const { state, setSync, replaceState } = useAppStore();
  const cloudConfig: CloudConfig | null = useMemo(() => {
    const u = (import.meta.env.VITE_SUPABASE_URL || "").trim();
    const k = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
    return u && k ? { supabaseUrl: u, supabaseAnonKey: k } : null;
  }, []);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const pullingRef = useRef(false);
  const uploadingRef = useRef(false);
  const refreshingRef = useRef<Promise<AuthSession | null> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  const freshSession = useCallback(async () => {
    if (!cloudConfig) return null;
    const stored = getStoredSession(cloudConfig);
    if (!stored || !isUabStudentEmail(stored.user.email)) return null;

    // O access token continua válido durante a maior parte da sessão. Não há razão para
    // trocar o refresh token em cada foco, sincronização ou pequena alteração local.
    if (!sessionNeedsRefresh(stored)) return stored;

    // Deduplica pedidos simultâneos de refresh (ex.: focus + visibilitychange).
    if (refreshingRef.current) return refreshingRef.current;

    refreshingRef.current = (async () => {
      try {
        const fresh = await refreshSession(cloudConfig, stored);
        storeSession(cloudConfig, fresh);
        return fresh;
      } catch (error) {
        console.warn("[AutoSync] Session refresh failed; keeping current session:", error);
        return stored;
      } finally {
        refreshingRef.current = null;
      }
    })();

    return refreshingRef.current;
  }, [cloudConfig]);

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

  const pullLatest = useCallback(async () => {
    if (!cloudConfig || pullingRef.current || uploadingRef.current || hasCloudConflict()) return;
    const session = await freshSession();
    if (!session) return;
    pullingRef.current = true;
    try {
      const remote = await fetchRemoteState(cloudConfig, session);
      if (!remote?.state) return;
      const current = stateRef.current;
      const remoteState = remote.state as AppState & { syncMeta?: { deviceId?: string; deviceLabel?: string } };
      const localFp = cloudStateFingerprint(current);
      const remoteFp = cloudStateFingerprint(remoteState);
      const baseline = getSyncBaseline();

      if (localFp === remoteFp) {
        setSyncBaseline(remoteFp);
        if (current.sync?.lastSyncAt !== remote.updated_at && isMountedRef.current) setSync({ lastSyncAt: remote.updated_at });
        return;
      }

      if (!baseline) {
        if (isLocallyFresh(current)) {
          applyRemote(remoteState, remote.updated_at, remoteState.syncMeta?.deviceLabel);
          return;
        }
        persistConflict(current, remoteState, remote.updated_at);
        notify({ kind: "conflict", message: "Existem dados diferentes neste dispositivo e na cloud. Escolhe uma versão nas Definições." });
        return;
      }

      const localChanged = localFp !== baseline;
      const remoteChanged = remoteFp !== baseline;

      if (!localChanged && remoteChanged) {
        applyRemote(remoteState, remote.updated_at, remoteState.syncMeta?.deviceLabel);
        return;
      }
      if (localChanged && !remoteChanged) return;

      if (localChanged && remoteChanged) {
        persistConflict(current, remoteState, remote.updated_at);
        notify({ kind: "conflict", message: "Foram feitas alterações diferentes em dois dispositivos. Escolhe qual versão deve prevalecer nas Definições." });
      }
    } catch (error) {
      console.warn("[AutoSync] Download failed:", error);
      notify({ kind: "error", message: "Não foi possível verificar a versão mais recente da cloud. Os dados locais foram mantidos." });
    } finally { pullingRef.current = false; }
  }, [applyRemote, cloudConfig, freshSession, setSync]);

  const doUpload = useCallback(async () => {
    if (!cloudConfig || pullingRef.current || uploadingRef.current || hasCloudConflict()) return;
    const current = stateRef.current;
    if (!current.sync?.enabled) return;
    const session = await freshSession();
    if (!session) return;
    uploadingRef.current = true;
    try {
      const localFp = cloudStateFingerprint(current);
      const baseline = getSyncBaseline();
      const remote = await fetchRemoteState(cloudConfig, session);

      if (remote?.state) {
        const remoteState = remote.state as AppState & { syncMeta?: { deviceLabel?: string } };
        const remoteFp = cloudStateFingerprint(remoteState);

        if (localFp === remoteFp) {
          setSyncBaseline(remoteFp);
          if (isMountedRef.current) setSync({ lastSyncAt: remote.updated_at });
          return;
        }

        if (!baseline) {
          persistConflict(current, remoteState, remote.updated_at);
          notify({ kind: "conflict", message: "Existem dados diferentes neste dispositivo e na cloud. Escolhe uma versão nas Definições." });
          return;
        }

        const localChanged = localFp !== baseline;
        const remoteChanged = remoteFp !== baseline;
        if (remoteChanged) {
          if (!localChanged) {
            applyRemote(remoteState, remote.updated_at, remoteState.syncMeta?.deviceLabel);
            return;
          }
          persistConflict(current, remoteState, remote.updated_at);
          notify({ kind: "conflict", message: "Foram feitas alterações diferentes em dois dispositivos. Escolhe qual versão deve prevalecer nas Definições." });
          return;
        }
        if (!localChanged) return;
      }

      const stateForCloud = {
        ...current,
        meta: { ...(current.meta ?? {}), appVersion: APP_VERSION },
        sync: { ...(current.sync ?? { enabled: true }), enabled: true },
        syncMeta: { deviceId: getDeviceId(), deviceLabel: getDeviceLabel() },
      } as AppState;
      const saved = await upsertRemoteState(cloudConfig, session, stateForCloud);
      const syncedAt = saved.updated_at || new Date().toISOString();
      setSyncBaseline(stateForCloud);
      if (isMountedRef.current) setSync({ lastSyncAt: syncedAt });
    } catch (e) { console.warn("[AutoSync] Upload failed:", e); }
    finally { uploadingRef.current = false; }
  }, [applyRemote, cloudConfig, freshSession, setSync]);

  useEffect(() => {
    if (!cloudConfig) return;
    void pullLatest();
    const onFocus = () => void pullLatest();
    const onVisible = () => { if (document.visibilityState === "visible") void pullLatest(); };
    const onOnline = () => void pullLatest();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cloudConfig, pullLatest]);

  useEffect(() => {
    if (!state.sync?.enabled || !cloudConfig || hasCloudConflict()) return;
    const session = getStoredSession(cloudConfig);
    if (!session || !isUabStudentEmail(session.user.email)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void doUpload(); }, 1500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state.courses, state.assessments, state.degree, state.studyBlocks, state.rules, state.profile, state.appearance, state.notifications, state.lastSeenRelease, state.sync?.enabled, cloudConfig, doUpload]);
}
