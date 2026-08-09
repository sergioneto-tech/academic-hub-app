import { useEffect, useMemo, useState } from "react";
import { History, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { useAppStore } from "@/lib/AppStore";
import { fetchCloudHistory, type CloudHistoryRow } from "@/lib/cloudHistory";
import { getStoredSession, upsertRemoteState, type CloudConfig } from "@/lib/cloudSync";
import { clearCloudConflict, getDeviceId, getDeviceLabel, setSyncBaseline } from "@/lib/cloudSyncState";
import type { AppState } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CloudRecoveryCard() {
  const { replaceState } = useAppStore();
  const [rows, setRows] = useState<CloudHistoryRow[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const cloudConfig = useMemo<CloudConfig | null>(() => {
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
    const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
    return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
  }, []);

  useEffect(() => {
    if (!cloudConfig) return;
    const session = getStoredSession(cloudConfig);
    if (!session) return;
    void fetchCloudHistory(cloudConfig, session).then(setRows).catch(() => undefined);
  }, [cloudConfig]);

  if (!cloudConfig || rows.length === 0) return null;

  const restore = async (row: CloudHistoryRow) => {
    const session = getStoredSession(cloudConfig);
    if (!session) return;
    try {
      setBusy(row.id);
      const restored = {
        ...row.state,
        meta: { ...(row.state.meta ?? {}), appVersion: APP_VERSION },
        sync: { ...(row.state.sync ?? { enabled: true }), enabled: true },
        syncMeta: { deviceId: getDeviceId(), deviceLabel: getDeviceLabel() },
      } as AppState;
      const saved = await upsertRemoteState(cloudConfig, session, restored);
      const finalState = { ...restored, sync: { ...restored.sync, enabled: true, lastSyncAt: saved.updated_at } } as AppState;
      setSyncBaseline(finalState);
      clearCloudConflict();
      replaceState(finalState);
      toast({ title: "Versão restaurada", description: `Foi recuperada a versão de ${formatDate(row.source_updated_at)}.` });
      setRows(await fetchCloudHistory(cloudConfig, session));
    } catch (error) {
      toast({ title: "Não foi possível restaurar", description: error instanceof Error ? error.message : "Erro inesperado.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="premium-card mb-6 border-emerald-500/25">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-emerald-600"/>Recuperação da cloud</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <p className="mb-3 text-xs text-muted-foreground">São mantidas automaticamente até 10 versões recentes dos teus dados.</p>
        {rows.slice(0, 5).map((row, index) => (
          <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div className="min-w-0"><div className="text-sm font-medium">{index === 0 ? "Versão mais recente" : formatDate(row.source_updated_at)}</div><div className="truncate text-xs text-muted-foreground">{row.device_label || "Dispositivo não identificado"}{row.app_version ? ` · v${row.app_version}` : ""}</div></div>
            {index > 0 && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void restore(row)}><RotateCcw className="mr-2 h-3.5 w-3.5"/>{busy === row.id ? "A restaurar…" : "Restaurar"}</Button>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
