import { useEffect, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "@/lib/AppStore";
import {
  type CloudConfig,
  type AuthSession,
  getStoredSession,
  refreshSession,
  storeSession,
  upsertRemoteState,
} from "@/lib/cloudSync";

/**
 * Hook that automatically uploads state to cloud when changes occur.
 * Debounces to avoid excessive uploads (waits 5s after last change).
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

    // Create a fingerprint to avoid re-uploading the same state
    const fingerprint = JSON.stringify({
      courses: state.courses,
      assessments: state.assessments,
      degree: state.degree,
      studyBlocks: state.studyBlocks,
      rules: state.rules,
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

      await upsertRemoteState(cloudConfig, fresh, state);
      lastUploadedRef.current = fingerprint;

      if (isMountedRef.current) {
        setSync({ lastSyncAt: new Date().toISOString() });
      }
    } catch (e) {
      console.warn("[AutoSync] Upload failed:", e);
    }
  }, [cloudConfig, state, setSync]);

  // Debounced auto-upload whenever relevant state changes
  useEffect(() => {
    if (!state.sync?.enabled) return;
    if (!cloudConfig) return;
    if (!getStoredSession(cloudConfig)) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void doUpload();
    }, 5000); // 5 second debounce

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    state.courses,
    state.assessments,
    state.degree,
    state.studyBlocks,
    state.rules,
    state.sync?.enabled,
    cloudConfig,
    doUpload,
  ]);
}
