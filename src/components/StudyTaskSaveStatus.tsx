import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Cloud, CloudOff, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/AppStore";
import { saveState } from "@/lib/storage";

type SavePhase = "idle" | "local" | "pending-cloud" | "synced";

function formatMoment(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StudyTaskSaveStatus() {
  const { state } = useAppStore();
  const fingerprint = useMemo(() => JSON.stringify(state.studyBlocks ?? []), [state.studyBlocks]);
  const previousFingerprint = useRef(fingerprint);
  const changeAtRef = useRef<number | null>(null);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [phase, setPhase] = useState<SavePhase>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const cloudEnabled = Boolean(state.sync?.enabled);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (previousFingerprint.current === fingerprint) return;
    previousFingerprint.current = fingerprint;

    const now = new Date();
    changeAtRef.current = now.getTime();
    setSavedAt(now.toISOString());
    setPhase(cloudEnabled && online ? "pending-cloud" : "local");
  }, [fingerprint, cloudEnabled, online]);

  useEffect(() => {
    if (!state.sync?.lastSyncAt || changeAtRef.current === null) return;
    const syncedAt = new Date(state.sync.lastSyncAt).getTime();
    if (!Number.isFinite(syncedAt) || syncedAt + 1000 < changeAtRef.current) return;
    setSavedAt(state.sync.lastSyncAt);
    setPhase("synced");
    changeAtRef.current = null;
  }, [state.sync?.lastSyncAt]);

  useEffect(() => {
    if (phase === "local" && online && cloudEnabled && changeAtRef.current !== null) setPhase("pending-cloud");
  }, [phase, online, cloudEnabled]);

  const confirmSave = () => {
    saveState(state);
    const now = new Date().toISOString();

    if (phase === "pending-cloud") {
      setSavedAt(now);
      return;
    }

    if (cloudEnabled && online && state.sync?.lastSyncAt) {
      changeAtRef.current = null;
      setSavedAt(state.sync.lastSyncAt);
      setPhase("synced");
      return;
    }

    changeAtRef.current = cloudEnabled ? Date.now() : null;
    setSavedAt(now);
    setPhase("local");
  };

  const status = (() => {
    if (phase === "pending-cloud") {
      return { Icon: Loader2, spin: true, text: `Guardado neste dispositivo · a sincronizar${savedAt ? ` · ${formatMoment(savedAt)}` : ""}` };
    }
    if (phase === "synced") {
      return { Icon: Cloud, spin: false, text: `Sincronizado ✓${savedAt ? ` · ${formatMoment(savedAt)}` : ""}` };
    }
    if (phase === "local") {
      return { Icon: online ? CheckCircle2 : CloudOff, spin: false, text: online && !cloudEnabled
        ? `Guardado neste dispositivo ✓${savedAt ? ` · ${formatMoment(savedAt)}` : ""}`
        : `Guardado neste dispositivo ✓ · sincronização pendente${savedAt ? ` · ${formatMoment(savedAt)}` : ""}` };
    }
    if (state.sync?.lastSyncAt && cloudEnabled) {
      return { Icon: Cloud, spin: false, text: `Última sincronização · ${formatMoment(state.sync.lastSyncAt)}` };
    }
    return { Icon: CheckCircle2, spin: false, text: "As alterações são guardadas automaticamente" };
  })();

  return (
    <>
      <style>{`
        @media (max-width: 1023px) {
          .study-task-save-status + .grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .study-task-save-status + .grid > * {
            width: 100% !important;
            min-width: 0 !important;
          }
        }
      `}</style>
      <div className="study-task-save-status flex flex-col gap-2 rounded-xl border bg-card/70 p-3 sm:flex-row sm:items-center sm:justify-between" role="status" aria-live="polite">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <status.Icon className={`h-4 w-4 shrink-0 ${status.spin ? "animate-spin" : ""}`} />
          <span className="min-w-0">{status.text}</span>
        </div>
        <Button variant="outline" size="sm" className="w-full shrink-0 sm:w-auto" onClick={confirmSave}>
          <Save className="mr-2 h-4 w-4" />
          Gravar
        </Button>
      </div>
    </>
  );
}
