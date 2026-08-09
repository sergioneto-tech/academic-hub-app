import { useEffect, useState } from "react";
import { Cloud, CloudOff, ShieldAlert } from "lucide-react";

import { useAppStore } from "@/lib/AppStore";
import { CLOUD_CONFLICT_CHANGED_EVENT, hasCloudConflict } from "@/lib/cloudSyncState";

type CloudSyncStatusBadgeProps = {
  embedded?: boolean;
};

export default function CloudSyncStatusBadge({ embedded = false }: CloudSyncStatusBadgeProps) {
  const { state } = useAppStore();
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [conflict, setConflict] = useState(() => hasCloudConflict());

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onConflict = () => setConflict(hasCloudConflict());
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(CLOUD_CONFLICT_CHANGED_EVENT, onConflict);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(CLOUD_CONFLICT_CHANGED_EVENT, onConflict);
    };
  }, []);

  if (!state.sync?.enabled) return null;

  const lastSync = state.sync.lastSyncAt ? new Date(state.sync.lastSyncAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : null;
  const Icon = conflict ? ShieldAlert : online ? Cloud : CloudOff;
  const label = conflict ? "Conflito" : online ? (lastSync ? `Cloud ${lastSync}` : "Cloud ativa") : "Offline";
  const tone = conflict
    ? "border-amber-500/50 text-amber-700 dark:text-amber-300"
    : online
      ? "border-emerald-500/35 text-emerald-700 dark:text-emerald-300"
      : "text-muted-foreground";

  if (embedded) {
    return (
      <div className={`mt-2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-background/90 px-2.5 py-1 text-[10px] font-medium shadow-sm backdrop-blur md:hidden ${tone}`} role="status" aria-live="polite">
        <Icon className="h-3 w-3" />
        {label}
      </div>
    );
  }

  return (
    <div className={`fixed bottom-[8.25rem] left-4 z-50 hidden w-[16rem] items-center justify-center gap-1.5 rounded-xl border bg-sidebar/95 px-3 py-2 text-[11px] font-medium shadow-md backdrop-blur md:inline-flex ${tone}`} role="status" aria-live="polite">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}
