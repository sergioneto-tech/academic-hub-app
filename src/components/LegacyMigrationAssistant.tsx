import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CloudUpload, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useAppStore } from "@/lib/AppStore";
import {
  type CloudConfig,
  fetchRemoteState,
  getOrCreateAccountMigrationStatus,
  getStoredSession,
  isUabStudentEmail,
  refreshSession,
  storeSession,
  upsertRemoteState,
} from "@/lib/cloudSync";
import {
  clearCloudConflict,
  getDeviceId,
  getDeviceLabel,
  normalizeCloudState,
  setSyncBaseline,
} from "@/lib/cloudSyncState";
import { getLocalMigrationSummary, hasMeaningfulLocalMigrationData } from "@/lib/legacyMigration";
import {
  isMigrationNoticePending,
  MIGRATION_NOTICE_DISMISSED_EVENT,
} from "@/lib/migrationNoticeState";
import type { AppState } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";

type Eligibility = "checking" | "hidden" | "eligible" | "migrated";

export default function LegacyMigrationAssistant() {
  const navigate = useNavigate();
  const { state, exportData, replaceState } = useAppStore();
  const [noticeDismissed, setNoticeDismissed] = useState(() => !isMigrationNoticePending());
  const [eligibility, setEligibility] = useState<Eligibility>("checking");
  const [busy, setBusy] = useState(false);

  const cloudConfig: CloudConfig | null = useMemo(() => {
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
    const supabaseAnonKey = (
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      ""
    ).trim();
    return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
  }, []);

  const summary = useMemo(() => getLocalMigrationSummary(state), [state]);

  useEffect(() => {
    const onDismissed = () => setNoticeDismissed(true);
    window.addEventListener(MIGRATION_NOTICE_DISMISSED_EVENT, onDismissed);
    return () => window.removeEventListener(MIGRATION_NOTICE_DISMISSED_EVENT, onDismissed);
  }, []);

  useEffect(() => {
    if (!noticeDismissed || !cloudConfig || !hasMeaningfulLocalMigrationData(state)) {
      setEligibility("hidden");
      return;
    }

    const session = getStoredSession(cloudConfig);
    if (!session || isUabStudentEmail(session.user.email)) {
      setEligibility("hidden");
      return;
    }

    let cancelled = false;
    setEligibility("checking");

    void (async () => {
      try {
        const migration = await getOrCreateAccountMigrationStatus(cloudConfig, session);
        if (!migration || new Date(migration.deadline).getTime() <= Date.now()) {
          if (!cancelled) setEligibility("hidden");
          return;
        }

        const remote = await fetchRemoteState(cloudConfig, session);
        if (!cancelled) setEligibility(remote?.state ? "hidden" : "eligible");
      } catch (error) {
        console.warn("[LegacyMigrationAssistant] eligibility check failed:", error);
        if (!cancelled) setEligibility("hidden");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cloudConfig, noticeDismissed, state]);

  const migrateNow = async () => {
    if (!cloudConfig || busy) return;
    const stored = getStoredSession(cloudConfig);
    if (!stored || isUabStudentEmail(stored.user.email)) return;

    try {
      setBusy(true);
      const fresh = await refreshSession(cloudConfig, stored).catch(() => stored);
      storeSession(cloudConfig, fresh);

      const remoteBeforeUpload = await fetchRemoteState(cloudConfig, fresh);
      if (remoteBeforeUpload?.state) {
        setEligibility("hidden");
        toast({
          title: "Migração já existente",
          description: "Esta conta já tem dados na nova cloud. Nenhum dado foi substituído.",
        });
        return;
      }

      const raw = normalizeCloudState(JSON.parse(exportData()));
      if (!hasMeaningfulLocalMigrationData(raw)) {
        setEligibility("hidden");
        toast({
          title: "Não foram encontrados dados antigos",
          description: "Importa primeiro o teu backup JSON neste dispositivo e volta a tentar.",
          variant: "destructive",
        });
        return;
      }

      const prepared = {
        ...raw,
        meta: { ...(raw.meta ?? {}), appVersion: APP_VERSION },
        sync: { ...(raw.sync ?? { enabled: true }), enabled: true },
        syncMeta: { deviceId: getDeviceId(), deviceLabel: getDeviceLabel() },
      } as AppState;

      const saved = await upsertRemoteState(cloudConfig, fresh, prepared);
      const migratedState = {
        ...prepared,
        sync: {
          ...(prepared.sync ?? { enabled: true }),
          enabled: true,
          lastSyncAt: saved.updated_at || new Date().toISOString(),
        },
      } as AppState;

      setSyncBaseline(migratedState);
      clearCloudConflict();
      replaceState(migratedState);
      setEligibility("migrated");
      toast({
        title: "Dados migrados com sucesso",
        description: "Os dados deste dispositivo já estão guardados na nova base de dados.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível concluir a migração",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (eligibility === "checking" || eligibility === "hidden") return null;

  return (
    <div className="fixed inset-0 z-[105] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="legacy-migration-title">
      <div className="w-full max-w-xl rounded-3xl border border-[hsl(var(--gold)/0.5)] bg-background shadow-2xl">
        <div className="border-b bg-primary/5 px-6 py-6 sm:px-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/70 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950 dark:border-amber-500/60 dark:bg-amber-400/15 dark:text-amber-200">
            <ShieldCheck className="h-4 w-4" />
            Migração segura disponível
          </div>
          <h2 id="legacy-migration-title" className="text-xl font-semibold sm:text-2xl">
            {eligibility === "migrated" ? "Os teus dados já estão na nova cloud" : "Encontrámos os teus dados antigos neste dispositivo"}
          </h2>
        </div>

        <div className="space-y-4 p-6 sm:p-8">
          {eligibility === "eligible" ? (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                A tua conta antiga ainda não tem dados na nova base. Podemos copiar agora os dados que já existem neste dispositivo, sem substituir qualquer registo remoto existente.
              </p>
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                <div className="rounded-xl border bg-muted/25 p-3"><div className="text-lg font-semibold">{summary.courses}</div><div className="text-xs text-muted-foreground">Cadeiras</div></div>
                <div className="rounded-xl border bg-muted/25 p-3"><div className="text-lg font-semibold">{summary.assessments}</div><div className="text-xs text-muted-foreground">Avaliações</div></div>
                <div className="rounded-xl border bg-muted/25 p-3"><div className="text-lg font-semibold">{summary.completedCourses}</div><div className="text-xs text-muted-foreground">Concluídas</div></div>
                <div className="rounded-xl border bg-muted/25 p-3"><div className="text-lg font-semibold">{summary.studyBlocks}</div><div className="text-xs text-muted-foreground">Blocos de estudo</div></div>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs leading-5 text-muted-foreground">
                Antes do envio, a aplicação confirma novamente que a cloud está vazia. Se já existirem dados, a migração é interrompida para evitar sobrescritas.
              </div>
              <Button className="w-full" onClick={migrateNow} disabled={busy}>
                <CloudUpload className="mr-2 h-4 w-4" />
                {busy ? "A migrar dados…" : "Migrar os meus dados agora"}
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-sm leading-6">A cópia para a nova base foi concluída. Falta apenas regularizar o email da conta para o endereço institucional @estudante.uab.pt.</p>
              </div>
              <Button className="w-full" onClick={() => navigate("/definicoes")}>
                Continuar para a regularização da conta
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
