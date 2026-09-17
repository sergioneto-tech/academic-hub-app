import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Cloud, CloudOff, ShieldAlert } from "lucide-react";

import SupportIdentityBadge from "@/components/SupportIdentityBadge";
import { useAppStore } from "@/lib/AppStore";
import { getStoredSession, type CloudConfig } from "@/lib/cloudSync";
import { CLOUD_CONFLICT_CHANGED_EVENT, hasCloudConflict } from "@/lib/cloudSyncState";
import { getPublicSupabaseConfig } from "@/lib/publicSupabaseConfig";

type CloudSyncStatusBadgeProps = {
  embedded?: boolean;
};

function hasAccountSession(config: CloudConfig | null): boolean {
  return Boolean(config && getStoredSession(config));
}

export default function CloudSyncStatusBadge({ embedded = false }: CloudSyncStatusBadgeProps) {
  const { state } = useAppStore();
  const config = useMemo(getPublicSupabaseConfig, []);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [conflict, setConflict] = useState(() => hasCloudConflict());
  const [authenticated, setAuthenticated] = useState(() => hasAccountSession(config));
  const [sidebarMount, setSidebarMount] = useState<HTMLElement | null>(null);

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

  useEffect(() => {
    if (embedded || typeof document === "undefined") return;

    let mount: HTMLDivElement | null = null;
    let frame = 0;

    const attach = () => {
      const footer = document.querySelector<HTMLElement>("aside > div:last-child");
      if (!footer) {
        frame = window.requestAnimationFrame(attach);
        return;
      }

      mount = document.createElement("div");
      mount.dataset.cloudSidebarStatus = "true";
      footer.prepend(mount);
      setSidebarMount(mount);
    };

    frame = window.requestAnimationFrame(attach);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      setSidebarMount(null);
      mount?.remove();
    };
  }, [embedded]);

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
      <div className="flex max-w-[15rem] flex-col items-center">
        <div
          className={`mt-3 inline-flex min-w-0 items-center justify-center gap-1 rounded-full border bg-background/90 px-2 py-1 text-center text-[9px] font-medium leading-none shadow-sm backdrop-blur sm:mt-5 sm:px-2 sm:py-1.5 sm:text-[10px] md:hidden ${tone}`}
          role="status"
          aria-live="polite"
          aria-label={detail}
          title={detail}
        >
          <Icon className="h-3 w-3 shrink-0 max-sm:h-2.5 max-sm:w-2.5" />
          <span className="whitespace-nowrap">{compactLabel}</span>
        </div>
        {authenticated && <SupportIdentityBadge compact className="mt-1.5" />}
      </div>
    );
  }

  if (!sidebarMount) return null;

  return createPortal(
    <div
      className={`inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-xl border bg-sidebar-accent/25 px-3 py-2 text-center text-[11px] font-medium leading-tight ${tone}`}
      role="status"
      aria-live="polite"
      aria-label={detail}
      title={detail}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 break-words">{label}</span>
    </div>,
    sidebarMount,
  );
}