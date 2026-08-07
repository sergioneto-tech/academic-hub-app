import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CloudDownload, MonitorSmartphone, Upload } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { useAppStore } from "@/lib/AppStore";
import { getStoredSession, isUabStudentEmail, type CloudConfig, upsertRemoteState } from "@/lib/cloudSync";
import type { AppState } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";

export const CLOUD_CONFLICT_KEY = "academic_hub_cloud_conflict";
export const CLOUD_CONFLICT_CHANGED_EVENT = "academic-hub:cloud-conflict-changed";

type ConflictPayload = {
  createdAt: string;
  localState: AppState;
  remoteState: AppState & { syncMeta?: { deviceId?: string; deviceLabel?: string } };
  localUpdatedAt?: string;
  remoteUpdatedAt: string;
  remoteDeviceLabel?: string;
};

function parseConflict(): ConflictPayload | null {
  try {
    const raw = localStorage.getItem(CLOUD_CONFLICT_KEY);
    return raw ? (JSON.parse(raw) as ConflictPayload) : null;
  } catch {
    return null;
  }
}

function formatDateTime(value?: string) {
  if (!value) return "Sem data registada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summary(state: AppState) {
  const completed = state.courses.filter((course) => course.isCompleted).length;
  const active = state.courses.filter((course) => course.isActive).length;
  const graded = state.assessments.filter((item) => item.grade !== null).length;
  return `${completed} concluídas · ${active} ativas · ${graded} avaliações com nota`;
}

function currentDeviceLabel() {
  const ua = navigator.userAgent.toLowerCase();
  const type = /ipad|tablet/.test(ua) ? "tablet" : /mobi|android|iphone/.test(ua) ? "telemóvel" : "computador";
  return `${type} · ${navigator.platform || "dispositivo"}`;
}

export default function CloudConflictPanel() {
  const location = useLocation();
  const { replaceState } = useAppStore();
  const [conflict, setConflict] = useState<ConflictPayload | null>(() => parseConflict());
  const [busy, setBusy] = useState<"local" | "remote" | null>(null);

  const cloudConfig: CloudConfig | null = useMemo(() => {
    const u = (import.meta.env.VITE_SUPABASE_URL || "").trim();
    const k = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
    return u && k ? { supabaseUrl: u, supabaseAnonKey: k } : null;
  }, []);

  useEffect(() => {
    const refresh = () => setConflict(parseConflict());
    window.addEventListener(CLOUD_CONFLICT_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    refresh();
    return () => {
      window.removeEventListener(CLOUD_CONFLICT_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [location.pathname]);

  if (location.pathname !== "/definicoes" || !conflict) return null;

  const clearConflict = () => {
    localStorage.removeItem(CLOUD_CONFLICT_KEY);
    window.dispatchEvent(new Event(CLOUD_CONFLICT_CHANGED_EVENT));
    setConflict(null);
  };

  const chooseVersion = async (choice: "local" | "remote") => {
    if (!cloudConfig) return;
    const session = getStoredSession(cloudConfig);
    if (!session || !isUabStudentEmail(session.user.email)) {
      toast({ title: "Sessão necessária", description: "Inicia sessão com a conta UAb antes de resolver o conflito.", variant: "destructive" });
      return;
    }

    try {
      setBusy(choice);
      const now = new Date().toISOString();
      const selected = choice === "local" ? conflict.localState : conflict.remoteState;
      const next = {
        ...selected,
        meta: { ...(selected.meta ?? {}), appVersion: APP_VERSION },
        sync: { ...(selected.sync ?? { enabled: true }), enabled: true, lastSyncAt: now },
        syncMeta: { deviceLabel: currentDeviceLabel() },
      } as AppState;

      replaceState(next);
      await upsertRemoteState(cloudConfig, session, next);
      localStorage.setItem("academic_hub_last_remote_applied", now);
      clearConflict();
      toast({
        title: choice === "local" ? "Versão deste dispositivo escolhida" : "Versão da cloud escolhida",
        description: "A versão escolhida foi aplicada e gravada automaticamente na cloud.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível concluir",
        description: error instanceof Error ? error.message : "Erro inesperado ao resolver o conflito.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto mb-6 w-full max-w-5xl px-4 sm:px-6">
      <Card className="border-amber-500/45 bg-amber-500/[0.04] shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/12 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Escolher a versão dos dados</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Foram encontradas alterações diferentes neste dispositivo e na cloud. Escolhe qual versão deve ficar válida. Depois da escolha, o Academic Hub grava-a automaticamente na cloud.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border bg-background p-4">
            <div className="flex items-center gap-2 font-semibold"><MonitorSmartphone className="h-4 w-4" /> Este dispositivo</div>
            <div className="mt-2 text-sm text-muted-foreground">Última referência: {formatDateTime(conflict.localUpdatedAt)}</div>
            <div className="mt-1 text-sm">{summary(conflict.localState)}</div>
            <Button className="mt-4 w-full" variant="outline" disabled={busy !== null} onClick={() => void chooseVersion("local")}>
              <Upload className="mr-2 h-4 w-4" />
              {busy === "local" ? "A guardar…" : "Usar esta versão"}
            </Button>
          </section>

          <section className="rounded-xl border bg-background p-4">
            <div className="flex items-center gap-2 font-semibold"><CloudDownload className="h-4 w-4" /> Versão da cloud</div>
            <div className="mt-2 text-sm text-muted-foreground">Gravada: {formatDateTime(conflict.remoteUpdatedAt)}</div>
            {conflict.remoteDeviceLabel ? <div className="mt-1 text-xs text-muted-foreground">Origem: {conflict.remoteDeviceLabel}</div> : null}
            <div className="mt-1 text-sm">{summary(conflict.remoteState)}</div>
            <Button className="mt-4 w-full" disabled={busy !== null} onClick={() => void chooseVersion("remote")}>
              <CloudDownload className="mr-2 h-4 w-4" />
              {busy === "remote" ? "A aplicar…" : "Usar versão da cloud"}
            </Button>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
