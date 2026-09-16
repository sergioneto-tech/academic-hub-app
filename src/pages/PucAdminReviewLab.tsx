import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchPendingPucSubmissions,
  isCurrentUserPucAdmin,
  reviewPucSubmission,
  type PucAdminSubmission,
} from "@/lib/pucAdminReview";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function PucAdminReviewLab() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [items, setItems] = useState<PucAdminSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const pendingCount = useMemo(() => items.length, [items]);

  const load = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const isAdmin = await isCurrentUserPucAdmin();
      setAllowed(isAdmin);
      if (!isAdmin) {
        setItems([]);
        return;
      }
      setItems(await fetchPendingPucSubmissions());
    } catch {
      setError("Não foi possível carregar as propostas pendentes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const decide = async (item: PucAdminSubmission, decision: "approve" | "reject") => {
    if (busyId) return;
    setBusyId(item.id);
    setError("");
    setMessage("");
    try {
      const result = await reviewPucSubmission(item.id, decision, notes[item.id] ?? "");
      if (result.submission_status === "approved") {
        setMessage(`Proposta aprovada. Foi criada a versão ${result.new_catalog_version} do catálogo; a versão anterior ficou preservada no histórico.`);
      } else if (result.submission_status === "rejected") {
        setMessage("Proposta rejeitada e decisão registada.");
      } else {
        setMessage("A proposta deixou de poder ser aplicada porque a versão-base já não é a versão ativa.");
      }
      await load();
    } catch (err) {
      const text = err instanceof Error ? err.message : "";
      if (text.includes("already_resolved")) setError("Esta proposta já foi decidida noutra sessão.");
      else if (text.includes("base")) setError("A versão-base já não está disponível ou deixou de coincidir. A proposta não foi aplicada.");
      else setError("Não foi possível concluir a decisão. Nenhuma alteração parcial foi mantida.");
    } finally {
      setBusyId("");
    }
  };

  if (loading && allowed === null) {
    return <Card className="premium-card"><CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />A verificar acesso administrativo…</CardContent></Card>;
  }

  if (allowed === false) {
    return <Card className="premium-card border-destructive/30"><CardContent className="p-5 text-sm text-destructive">Área restrita à conta administrativa do Academic Hub.</CardContent></Card>;
  }

  return (
    <div className="space-y-5 pb-6">
      <section className="premium-surface overflow-hidden">
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Administração · PUC</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Validação de correções PUC</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Aprovar nunca edita uma versão existente: é criada uma nova versão do catálogo e a anterior fica preservada.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading || Boolean(busyId)}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar</Button>
          </div>
        </div>
      </section>

      <Card className="premium-card">
        <CardContent className="flex items-center gap-3 p-4 text-sm">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <span><strong>{pendingCount}</strong> proposta{pendingCount === 1 ? "" : "s"} pendente{pendingCount === 1 ? "" : "s"}.</span>
        </CardContent>
      </Card>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200" role="status">{message}</div>}

      {!loading && items.length === 0 && <Card className="premium-card"><CardContent className="p-5 text-sm text-muted-foreground">Não existem propostas pendentes neste momento.</CardContent></Card>}

      <div className="space-y-4">
        {items.map((item) => {
          const changes = Array.isArray(item.proposed_payload?.changes) ? item.proposed_payload.changes : [];
          return (
            <Card key={item.id} className="premium-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{item.course_name} · {item.course_code}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border bg-background/55 p-3"><div className="font-semibold">Ano / edição</div><div className="mt-1 text-muted-foreground">{item.academic_year} · {item.edition}</div></div>
                  <div className="rounded-xl border bg-background/55 p-3"><div className="font-semibold">Versão-base</div><div className="mt-1 text-muted-foreground">{item.base_version ?? "—"}</div></div>
                  <div className="rounded-xl border bg-background/55 p-3"><div className="font-semibold">Recebida</div><div className="mt-1 text-muted-foreground">{formatDateTime(item.created_at)}</div></div>
                  <div className="rounded-xl border bg-background/55 p-3"><div className="font-semibold">Declaração</div><div className="mt-1 text-muted-foreground">{item.submitter_source_confirmed ? "Fonte oficial confirmada" : "Não confirmada"}</div></div>
                </div>

                {changes.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alterações propostas</div>
                    {changes.map((change, index) => (
                      <div key={`${item.id}-${index}`} className="rounded-xl border bg-background/55 p-3 text-xs">
                        <div className="font-semibold">{change.field}</div>
                        <div className="mt-1 text-muted-foreground">{change.before} → <span className="text-foreground">{change.after}</span></div>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-xs font-semibold" htmlFor={`note-${item.id}`}>Nota da decisão (opcional)</label>
                  <Textarea id={`note-${item.id}`} value={notes[item.id] ?? ""} maxLength={2000} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Regista uma justificação curta, se necessário." />
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" disabled={Boolean(busyId)} onClick={() => void decide(item, "reject")}><XCircle className="mr-2 h-4 w-4" />Rejeitar</Button>
                  <Button type="button" disabled={Boolean(busyId)} onClick={() => void decide(item, "approve")}>
                    {busyId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Aprovar e criar nova versão
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
