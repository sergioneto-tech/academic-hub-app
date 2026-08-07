import { useEffect, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/AppStore";
import {
  type CloudConfig,
  type AuthSession,
  getStoredSession,
  isUabStudentEmail,
  refreshSession,
  storeSession,
  upsertRemoteState,
} from "@/lib/cloudSync";

/**
 * Hook that automatically uploads state to cloud when changes occur.
 * Debounces to avoid excessive uploads (waits 5s after last change).
 *
 * Contas antigas com email não-UAb não fazem upload automático: a regularização
 * é apresentada nas Definições antes de qualquer operação manual de cloud.
 */
export function useAutoSync() {
  const { state, setSync } = useAppStore();

  const cloudConfig: CloudConfig | null = useMemo(() => {
    const u = (import.meta.env.VITE_SUPABASE_URL || "").trim();
    const k = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
    if (!u || !k) return null;
    return { supabaseUrl: u, supabaseAnonKey: k };
  }, []);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUploadedRef = useRef<string>("");
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const doUpload = useCallback(async () => {
    if (!cloudConfig) return;
    if (!state.sync?.enabled) return;

    const session = getStoredSession(cloudConfig);
    if (!session) return;
    if (!isUabStudentEmail(session.user.email)) return;

    const fingerprint = JSON.stringify({
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

    if (fingerprint === lastUploadedRef.current) return;

    try {
      let fresh: AuthSession = session;
      try {
        fresh = await refreshSession(cloudConfig, session);
        storeSession(cloudConfig, fresh);
      } catch {
        // Use existing session
      }

      if (!isUabStudentEmail(fresh.user.email)) return;

      await upsertRemoteState(cloudConfig, fresh, state);
      lastUploadedRef.current = fingerprint;

      if (isMountedRef.current) {
        setSync({ lastSyncAt: new Date().toISOString() });
      }
    } catch (e) {
      console.warn("[AutoSync] Upload failed:", e);
    }
  }, [cloudConfig, state, setSync]);

  useEffect(() => {
    if (!state.sync?.enabled) return;
    if (!cloudConfig) return;

    const session = getStoredSession(cloudConfig);
    if (!session || !isUabStudentEmail(session.user.email)) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void doUpload();
    }, 5000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
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
