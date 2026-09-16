import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  acceptPucUpdate,
  buildPucUpdateDifferences,
  fetchMyPucUpdateAlerts,
  type PucUpdateAlert,
} from "@/lib/pucUpdateAlerts";

export default function PucUpdateAlertsLab() {
  const [items, setItems] = useState<PucUpdateAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const count = useMemo(() => items.length, [items]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await fetchMyPucUpdateAlerts());
    } catch {
      setError("Não foi possível verificar atualizações do PUC neste momento.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const accept = async (item: PucUpdateAlert) => {
    if (busyId) return;
    setBusyId(item.active_catalog_id);
    setError("");
    setMessage("");
    try {
      await acceptPucUpdate(item);
      setMessage(`Nova versão da UC ${item.course_code} aceite neste teste. A cadeira pessoal não foi alterada automaticamente.`);
      await load();
    } catch {
      setError("Não foi possível registar a aceitação da nova versão. Nenhum dado pessoal foi alterado.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <section className="premium-surface overflow-hidden">
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Teste privado · não publicar</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Atualizações do PUC</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Só aparecem aqui UCs em que utilizaste uma versão anterior e existe agora uma versão validada mais recente. Nada é alterado automaticamente.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading || Boolean(busyId)}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar</Button>
          </div>
        </div>
      </section>

      <Card className="premium-card">
        <CardContent className="flex items-center gap-3 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span><strong>{count}</strong> atualização{count === 1 ? "" : "ões"} pendente{count === 1 ? "" : "s"} para esta conta.</span>
        </CardContent>
      </Card>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200" role="status">{message}</div>}

      {loading && <Card className="premium-card"><CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />A verificar versões utilizadas por esta conta…</CardContent></Card>}

      {!loading && items.length === 0 && (
        <Card className="premium-card">
          <CardContent className="p-5 text-sm text-muted-foreground">Não existem atualizações pendentes para as versões de PUC utilizadas por esta conta.</CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {items.map((item) => {
          const differences = buildPucUpdateDifferences(item);
          return (
            <Card key={`${item.accepted_catalog_id}-${item.active_catalog_id}`} className="premium-card border-amber-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Foram atualizados dados desta UC</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border bg-background/55 p-3"><div className="font-semibold">Unidade curricular</div><div className="mt-1 text-muted-foreground">{item.course_name} · {item.course_code}</div></div>
                  <div className="rounded-xl border bg-background/55 p-3"><div className="font-semibold">Ano / edição</div><div className="mt-1 text-muted-foreground">{item.academic_year} · {item.edition}</div></div>
                  <div className="rounded-xl border bg-background/55 p-3"><div className="font-semibold">Versão utilizada</div><div className="mt-1 text-muted-foreground">v{item.accepted_version}</div></div>
                  <div className="rounded-xl border bg-background/55 p-3"><div className="font-semibold">Nova versão</div><div className="mt-1 text-muted-foreground">v{item.active_version}</div></div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">O que mudou</div>
                  {differences.length === 0 ? (
                    <div className="rounded-xl border bg-background/55 p-3 text-xs text-muted-foreground">A versão foi atualizada, mas não existem diferenças nos campos apresentados neste teste.</div>
                  ) : differences.map((difference, index) => (
                    <div key={`${difference.label}-${index}`} className="rounded-xl border bg-background/55 p-3 text-xs">
                      <div className="font-semibold">{difference.label}</div>
                      <div className="mt-1 text-muted-foreground">{difference.before} → <span className="text-foreground">{difference.after}</span></div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
                  <strong>Nada muda automaticamente.</strong> Se não aceitares a nova versão, continuas associado à versão que utilizaste. Neste teste, aceitar regista apenas a escolha no catálogo; a integração com os dados pessoais da cadeira continua isolada até ao ponto próprio do plano.
                </div>

                <div className="flex justify-end">
                  <Button type="button" disabled={Boolean(busyId)} onClick={() => void accept(item)}>
                    {busyId === item.active_catalog_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Aceitar nova versão
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
