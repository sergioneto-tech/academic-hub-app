import { useEffect, useMemo, useState } from "react";
import { Cloud, CloudOff, ShieldAlert } from "lucide-react";

import { useAppStore } from "@/lib/AppStore";
import { getStoredSession, type CloudConfig } from "@/lib/cloudSync";
import { CLOUD_CONFLICT_CHANGED_EVENT, hasCloudConflict } from "@/lib/cloudSyncState";

type CloudSyncStatusBadgeProps = {
  embedded?: boolean;
};

function getCloudConfig(): CloudConfig | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

function hasAccountSession(config: CloudConfig | null): boolean {
  return Boolean(config && getStoredSession(config));
}

export default function CloudSyncStatusBadge({ embedded = false }: CloudSyncStatusBadgeProps) {
  const { state } = useAppStore();
  const config = useMemo(getCloudConfig, []);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [conflict, setConflict] = useState(() => hasCloudConflict());
  const [authenticated, setAuthenticated] = useState(() => hasAccountSession(config));

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onConflict = () => setConflict(hasCloudConflict());
    const onAuthChanged = () => setAuthenticated(hasAccountSession(config));

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(CLOUD_CONFLICT_CHANGED_EVENT, onConflict);
    window.addEventListener("academic-hub-auth-changed", onAuthChanged);
    window.addEventListener("storage", onAuthChanged);
    window.addEventListener("focus", onAuthChanged);
    window.addEventListener("pageshow", onAuthChanged);

    onAuthChanged();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(CLOUD_CONFLICT_CHANGED_EVENT, onConflict);
      window.removeEventListener("academic-hub-auth-changed", onAuthChanged);
      window.removeEventListener("storage", onAuthChanged);
      window.removeEventListener("focus", onAuthChanged);
      window.removeEventListener("pageshow", onAuthChanged);
    };
  }, [config]);

  const syncEnabled = Boolean(state.sync?.enabled);
  const lastSync = state.sync?.lastSyncAt
    ? new Date(state.sync.lastSyncAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    : null;

  const status = !authenticated
    ? {
        Icon: CloudOff,
        label: "Sem conta · modo local",
        compactLabel: "Modo local",
        detail: "Não existe uma sessão de conta ativa neste dispositivo.",
        tone: "border-border/80 text-muted-foreground",
      }
    : !syncEnabled
      ? {
          Icon: CloudOff,
          label: "Conta ativa · dados locais",
          compactLabel: "Cloud desligada",
          detail: "A conta está ativa, mas a sincronização cloud está desligada.",
          tone: "border-sky-500/40 text-sky-700 dark:text-sky-300",
        }
      : conflict
        ? {
            Icon: ShieldAlert,
            label: "Conta ativa · conflito na cloud",
            compactLabel: "Conflito cloud",
            detail: "A conta está ativa, mas existe um conflito de sincronização que precisa de atenção.",
            tone: "border-amber-500/50 text-amber-700 dark:text-amber-300",
          }
        : !online
          ? {
              Icon: CloudOff,
              label: "Conta ativa · offline",
              compactLabel: "Offline",
              detail: "A conta está ativa. As alterações ficam locais até a ligação à Internet regressar.",
              tone: "border-amber-500/40 text-amber-700 dark:text-amber-300",
            }
          : {
              Icon: Cloud,
              label: lastSync ? `Conta ativa · Cloud ${lastSync}` : "Conta ativa · Cloud pronta",
              compactLabel: lastSync ? `Cloud · ${lastSync}` : "Cloud pronta",
              detail: lastSync
                ? `Conta ativa e sincronização cloud ligada. Última sincronização às ${lastSync}.`
                : "Conta ativa e sincronização cloud ligada.",
              tone: "border-emerald-500/35 text-emerald-700 dark:text-emerald-300",
            };

  const { Icon, label, compactLabel, detail, tone } = status;

  if (embedded) {
    return (
      <div
        className={`mt-5 inline-flex w-20 min-w-0 items-center justify-center gap-1 rounded-full border bg-background/90 px-2 py-1.5 text-center text-[9px] font-medium leading-tight shadow-sm backdrop-blur sm:w-24 sm:text-[10px] md:hidden ${tone}`}
        role="status"
        aria-live="polite"
        aria-label={detail}
        title={detail}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="min-w-0 break-words">{compactLabel}</span>
      </div>
    );
  }

  return (
    <div
      className={`fixed bottom-[8.25rem] left-4 z-50 hidden w-56 max-w-[calc(100vw-2rem)] min-w-0 items-center justify-center gap-1.5 rounded-xl border bg-sidebar/95 px-3 py-2 text-center text-[11px] font-medium leading-tight shadow-md backdrop-blur md:inline-flex ${tone}`}
      role="status"
      aria-live="polite"
      aria-label={detail}
      title={detail}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 break-words">{label}</span>
    </div>
  );
}
