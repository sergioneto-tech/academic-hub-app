import { useEffect, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/AppStore";
import { APP_VERSION } from "@/lib/version";
import { CLOUD_SYNC_NOTICE_EVENT, type CloudSyncNoticeDetail } from "@/components/CloudSyncNotice";
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

const DEVICE_ID_KEY = "academic_hub_device_id";
const DEVICE_LABEL_KEY = "academic_hub_device_label";
const LAST_REMOTE_APPLIED_KEY = "academic_hub_last_remote_applied";

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getDeviceLabel() {
  let label = localStorage.getItem(DEVICE_LABEL_KEY);
  if (label) return label;
  const ua = navigator.userAgent.toLowerCase();
  const type = /ipad|tablet/.test(ua) ? "tablet" : /mobi|android|iphone/.test(ua) ? "telemóvel" : "computador";
  label = `${type} · ${navigator.platform || "dispositivo"}`;
  localStorage.setItem(DEVICE_LABEL_KEY, label);
  return label;
}

function notify(detail: CloudSyncNoticeDetail) {
  window.dispatchEvent(new CustomEvent(CLOUD_SYNC_NOTICE_EVENT, { detail }));
}

function comparableState(state: AppState) {
  return JSON.stringify({
    courses: state.courses,
    assessments: state.assessments,
    degree: state.degree,
    studyBlocks: state.studyBlocks,
    rules: state.rules,
    profile: state.profile,
    appearance: state.appearance,
    notifications: state.notifications,
    lastSeenRelease: state.lastSeenRelease,
  });
}

/**
 * Sincronização bidirecional:
 * - ao abrir/retomar a app consulta primeiro a cloud;
 * - aplica automaticamente uma versão remota mais recente;
 * - alterações locais continuam a ser enviadas após 5 s;
 * - nunca substitui silenciosamente duas versões divergentes já alteradas.
 */
export function useAutoSync() {
  const { state, setSync, replaceState } = useAppStore();

  const cloudConfig: CloudConfig | null = useMemo(() => {
    const u = (import.meta.env.VITE_SUPABASE_URL || "").trim();
    const k = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
    if (!u || !k) return null;
    return { supabaseUrl: u, supabaseAnonKey: k };
  }, []);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUploadedRef = useRef<string>("");
  const isMountedRef = useRef(true);
  const pullingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const freshSession = useCallback(async () => {
    if (!cloudConfig) return null;
    const stored = getStoredSession(cloudConfig);
    if (!stored || !isUabStudentEmail(stored.user.email)) return null;
    try {
      const fresh = await refreshSession(cloudConfig, stored);
      storeSession(cloudConfig, fresh);
      return fresh;
    } catch {
      return stored;
    }
  }, [cloudConfig]);

  const pullLatest = useCallback(async () => {
    if (!cloudConfig || pullingRef.current) return;
    const session = await freshSession();
    if (!session) return;

    pullingRef.current = true;
    try {
      const remote = await fetchRemoteState(cloudConfig, session);
      if (!remote?.state) return;

      const current = stateRef.current;
      const remoteState = remote.state as AppState & { syncMeta?: { deviceId?: string; deviceLabel?: string } };
      const localFingerprint = comparableState(current);
      const remoteFingerprint = comparableState(remoteState);
      if (localFingerprint === remoteFingerprint) {
        lastUploadedRef.current = remoteFingerprint;
        localStorage.setItem(LAST_REMOTE_APPLIED_KEY, remote.updated_at);
        return;
      }

      const lastApplied = localStorage.getItem(LAST_REMOTE_APPLIED_KEY);
      const localSyncTime = current.sync?.lastSyncAt ? new Date(current.sync.lastSyncAt).getTime() : 0;
      const remoteTime = new Date(remote.updated_at).getTime();
      const lastAppliedTime = lastApplied ? new Date(lastApplied).getTime() : 0;

      // Num dispositivo novo, ou quando a cloud é inequivocamente mais recente, a cloud vence.
      const localLooksFresh = !current.degree && current.courses.length === 0 && current.assessments.length === 0;
      const remoteIsNewer = remoteTime > Math.max(localSyncTime, lastAppliedTime);

      if (localLooksFresh || remoteIsNewer) {
        const appliedAt = new Date().toISOString();
        const next: AppState = {
          ...remoteState,
          meta: { ...(remoteState.meta ?? {}), appVersion: APP_VERSION },
          sync: { ...(remoteState.sync ?? { enabled: true }), enabled: true, lastSyncAt: appliedAt },
        };
        lastUploadedRef.current = comparableState(next);
        localStorage.setItem(LAST_REMOTE_APPLIED_KEY, remote.updated_at);
        replaceState(next);
        notify({
          kind: "updated",
          updatedAt: remote.updated_at,
          deviceLabel: remoteState.syncMeta?.deviceLabel,
        });
        return;
      }

      notify({ kind: "conflict" });
    } catch (error) {
      console.warn("[AutoSync] Download failed:", error);
      notify({ kind: "error", message: "Não foi possível verificar a versão mais recente da cloud. Os dados locais foram mantidos." });
    } finally {
      pullingRef.current = false;
    }
  }, [cloudConfig, freshSession, replaceState]);

  const doUpload = useCallback(async () => {
    if (!cloudConfig) return;
    const current = stateRef.current;
    if (!current.sync?.enabled) return;

    const session = await freshSession();
    if (!session) return;

    const fingerprint = comparableState(current);
    if (fingerprint === lastUploadedRef.current) return;

    try {
      // Antes de escrever, confirma se outro dispositivo publicou uma versão mais recente.
      const remote = await fetchRemoteState(cloudConfig, session);
      const remoteTime = remote?.updated_at ? new Date(remote.updated_at).getTime() : 0;
      const localSyncTime = current.sync?.lastSyncAt ? new Date(current.sync.lastSyncAt).getTime() : 0;
      if (remote?.state && remoteTime > localSyncTime && comparableState(remote.state as AppState) !== fingerprint) {
        await pullLatest();
        return;
      }

      const now = new Date().toISOString();
      const stateForCloud = {
        ...current,
        sync: { ...(current.sync ?? { enabled: true }), enabled: true, lastSyncAt: now },
        syncMeta: { deviceId: getDeviceId(), deviceLabel: getDeviceLabel() },
      } as AppState;
      await upsertRemoteState(cloudConfig, session, stateForCloud);
      lastUploadedRef.current = fingerprint;
      localStorage.setItem(LAST_REMOTE_APPLIED_KEY, now);
      if (isMountedRef.current) setSync({ lastSyncAt: now });
    } catch (e) {
      console.warn("[AutoSync] Upload failed:", e);
    }
  }, [cloudConfig, freshSession, pullLatest, setSync]);

  // Verifica a cloud no arranque, no regresso à app e quando volta a existir rede.
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
    if (!state.sync?.enabled || !cloudConfig) return;
    const session = getStoredSession(cloudConfig);
    if (!session || !isUabStudentEmail(session.user.email)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void doUpload(); }, 5000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [
    state.courses,
    state.assessments,
    state.degree,
    state.studyBlocks,
    state.rules,
    state.profile,
    state.appearance,
    state.notifications,
    state.lastSeenRelease,
    state.sync?.enabled,
    cloudConfig,
    doUpload,
  ]);
}
