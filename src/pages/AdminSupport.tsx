import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Cloud,
  Fingerprint,
  Loader2,
  MessageSquareText,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  canAccessAdminSupport,
  isValidSupportId,
  isValidSupportReason,
  lookupAdminSupport,
  normalizeSupportId,
  normalizeSupportReason,
  type AdminSupportLookup,
} from "@/lib/adminSupport";

function formatDateTime(value: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function StatusValue({ ok, yes = "Sim", no = "Não" }: { ok: boolean; yes?: string; no?: string }) {
  return <span className={ok ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-amber-700 dark:text-amber-300"}>{ok ? yes : no}</span>;
}

export default function AdminSupportPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [supportId, setSupportId] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<AdminSupportLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const supportIdRef = useRef<HTMLInputElement | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void canAccessAdminSupport().then((value) => {
      if (!cancelled) setAllowed(value);
    }).catch(() => {
      if (!cancelled) setAllowed(false);
    });
    return () => { cancelled = true; };
  }, []);

  const normalized = useMemo(() => normalizeSupportId(supportId), [supportId]);
  const normalizedReason = useMemo(() => normalizeSupportReason(reason), [reason]);
  const valid = isValidSupportId(normalized);
  const validReason = isValidSupportReason(normalizedReason, normalized);

  const focusField = (element: HTMLInputElement | HTMLTextAreaElement | null) => {
    if (!element || document.activeElement === element) return;
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  };

  const search = async () => {
    if (!valid || !validReason || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await lookupAdminSupport(normalized, normalizedReason));
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "lookup_failed";
      if (code === "not_found") setError("Não existe nenhuma conta associada a este ID Academic Hub.");
      else if (code === "invalid_reason") setError("Indica um motivo concreto para a consulta, entre 8 e 500 caracteres. O próprio ID não é aceite como motivo.");
      else if (code === "audit_failed") setError("A consulta não foi disponibilizada porque não foi possível criar o registo de auditoria.");
      else if (code === "forbidden" || code === "unauthorized") setError("A sessão atual não tem autorização para consultar esta área.");
      else setError("Não foi possível consultar os diagnósticos deste ID. Tenta novamente.");
    } finally {
      setBusy(false);
    }
  };

  if (allowed === null) {
    return <Card className="premium-card"><CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />A verificar acesso administrativo…</CardContent></Card>;
  }

  if (!allowed) {
    return <Card className="premium-card border-destructive/30"><CardContent className="p-5 text-sm text-destructive">Área restrita à conta administrativa do Academic Hub.</CardContent></Card>;
  }

  return (
    <div className="space-y-5 pb-6">
      <section className="premium-surface overflow-hidden">
        <div className="p-5 sm:p-7">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Administração · Suporte</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Consulta por ID Academic Hub</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Usa apenas o ID pseudónimo fornecido pelo aluno. Esta área não mostra nome, email, número de estudante, UUID interno, chaves Push, endereço IP ou conteúdo académico.</p>
        </div>
      </section>

      <Card className="premium-card">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Fingerprint className="h-4 w-4 text-primary" />Identificar conta</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="support-id" className="mb-2 block text-xs font-semibold">ID Academic Hub</label>
            <Input
              ref={supportIdRef}
              id="support-id"
              type="text"
              inputMode="text"
              enterKeyHint="next"
              autoCapitalize="characters"
              autoCorrect="off"
              value={supportId}
              onPointerDown={() => focusField(supportIdRef.current)}
              onTouchStart={() => focusField(supportIdRef.current)}
              onChange={(event) => {
                setSupportId(event.target.value.toUpperCase());
                setResult(null);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  focusField(reasonRef.current);
                }
              }}
              placeholder="AH-XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase [touch-action:manipulation] [user-select:text] [-webkit-user-select:text]"
              aria-label="ID Academic Hub"
            />
            {supportId && !valid && <p className="mt-1.5 text-xs text-muted-foreground">Formato esperado: AH-XXXX-XXXX-XXXX.</p>}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="support-reason" className="text-xs font-semibold">Motivo da consulta</label>
              <span className="text-[10px] text-muted-foreground">{normalizedReason.length}/500</span>
            </div>
            <Textarea
              ref={reasonRef}
              id="support-reason"
              inputMode="text"
              enterKeyHint="done"
              autoCapitalize="sentences"
              autoCorrect="on"
              value={reason}
              onPointerDown={() => focusField(reasonRef.current)}
              onTouchStart={() => focusField(reasonRef.current)}
              onChange={(event) => {
                setReason(event.target.value.slice(0, 500));
                setResult(null);
                setError("");
              }}
              placeholder="Ex.: Verificar falha de sincronização comunicada pelo utilizador."
              rows={3}
              maxLength={500}
              className="text-base [touch-action:manipulation] [user-select:text] [-webkit-user-select:text] md:text-sm"
            />
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">Obrigatório. A consulta só é disponibilizada se ficar registado quem consultou, qual o ID, o motivo, os campos devolvidos e a data/hora.</p>
          </div>

          <Button type="button" onClick={() => void search()} disabled={!valid || !validReason || busy} className="w-full sm:w-auto">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Consultar e registar acesso
          </Button>

          {reason && !validReason && <p className="text-xs text-muted-foreground">Descreve um motivo real em pelo menos 8 caracteres; o ID Academic Hub, sozinho, não é aceite.</p>}
          {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card className="premium-card border-emerald-500/25">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-medium text-muted-foreground">Conta consultada</div>
                <div className="mt-1 font-mono text-base font-semibold">{result.supportId}</div>
              </div>
              <div className="flex flex-col gap-1 text-xs sm:items-end">
                <div className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-4 w-4" />Identificação pseudónima</div>
                <div className="text-muted-foreground">Acesso registado no histórico administrativo</div>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="premium-card"><CardContent className="p-4"><div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-emerald-500" />Conta</div><div className="mt-3 space-y-1.5 text-xs text-muted-foreground"><div>Email confirmado: <StatusValue ok={result.account.emailVerified} /></div><div>Criada: <span className="text-foreground">{formatDateTime(result.account.createdAt)}</span></div><div>Último login: <span className="text-foreground">{formatDateTime(result.account.lastSignInAt)}</span></div></div></CardContent></Card>
            <Card className="premium-card"><CardContent className="p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Cloud className="h-4 w-4 text-sky-500" />Cloud</div><div className="mt-3 space-y-1.5 text-xs text-muted-foreground"><div>Estado guardado: <StatusValue ok={result.cloud.hasState} /></div><div>Última alteração: <span className="text-foreground">{formatDateTime(result.cloud.updatedAt)}</span></div></div></CardContent></Card>
            <Card className="premium-card"><CardContent className="p-4"><div className="flex items-center gap-2 text-sm font-semibold"><BellRing className="h-4 w-4 text-primary" />Notificações</div><div className="mt-3 space-y-1.5 text-xs text-muted-foreground"><div>Subscrições ativas: <span className="font-semibold text-foreground">{result.push.enabledSubscriptions}</span></div><div>Total registado: <span className="text-foreground">{result.push.subscriptions}</span></div><div>Atualização: <span className="text-foreground">{formatDateTime(result.push.lastUpdatedAt)}</span></div></div></CardContent></Card>
            <Card className="premium-card"><CardContent className="p-4"><div className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert className="h-4 w-4 text-amber-500" />Erros</div><div className="mt-3 space-y-1.5 text-xs text-muted-foreground"><div>Abertos: <span className="font-semibold text-foreground">{result.errors.openCount}</span></div><div>Recentes encontrados: <span className="text-foreground">{result.errors.recentCount}</span></div><div>Último: <span className="text-foreground">{formatDateTime(result.errors.latest?.last_seen_at ?? null)}</span></div></div></CardContent></Card>
          </section>

          {result.errors.latest && (
            <Card className="premium-card">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-500" />Último diagnóstico técnico</CardTitle></CardHeader>
              <CardContent className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border bg-background/55 p-3"><div className="text-muted-foreground">Código</div><div className="mt-1 font-mono font-semibold">{result.errors.latest.error_code || "—"}</div></div>
                <div className="rounded-xl border bg-background/55 p-3"><div className="text-muted-foreground">Área</div><div className="mt-1 font-semibold">{result.errors.latest.route || "—"}</div></div>
                <div className="rounded-xl border bg-background/55 p-3"><div className="text-muted-foreground">Versão</div><div className="mt-1 font-semibold">{result.errors.latest.app_version || "—"}</div></div>
                <div className="rounded-xl border bg-background/55 p-3"><div className="text-muted-foreground">Ocorrências</div><div className="mt-1 font-semibold">{result.errors.latest.occurrence_count ?? 1}</div></div>
                <div className="rounded-xl border bg-background/55 p-3"><div className="text-muted-foreground">Estado</div><div className="mt-1 font-semibold">{result.errors.latest.status || "—"}</div></div>
              </CardContent>
            </Card>
          )}

          <section className="grid gap-3 lg:grid-cols-2">
            <Card className="premium-card">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><MessageSquareText className="h-4 w-4 text-primary" />Feedback</CardTitle></CardHeader>
              <CardContent>
                <div className="mb-3 text-xs text-muted-foreground">Pedidos ativos: <strong className="text-foreground">{result.feedback.activeCount}</strong></div>
                {result.feedback.recent.length === 0 ? <p className="text-xs text-muted-foreground">Sem pedidos recentes.</p> : <div className="space-y-2">{result.feedback.recent.map((item) => <div key={item.reference} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background/55 px-3 py-2 text-xs"><span className="font-mono font-semibold">{item.reference}</span><span className="text-muted-foreground">{item.status} · {formatDateTime(item.updated_at)}</span></div>)}</div>}
              </CardContent>
            </Card>
            <Card className="premium-card">
              <CardHeader className="pb-2"><CardTitle className="text-base">Propostas PUC</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div>Pendentes: <strong className="text-foreground">{result.puc.pendingCount}</strong></div>
                <div>Registos recentes encontrados: <strong className="text-foreground">{result.puc.recentCount}</strong></div>
                <div>Último estado: <strong className="text-foreground">{result.puc.latestStatus || "—"}</strong></div>
                <div>Última alteração: <strong className="text-foreground">{formatDateTime(result.puc.latestUpdatedAt)}</strong></div>
              </CardContent>
            </Card>
          </section>

          <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4 text-xs leading-5 text-muted-foreground">
            Esta consulta devolve apenas informação operacional necessária ao suporte. Não devolve email, nome, número de aluno, UUID interno, notas, avaliações, conteúdos do perfil, endpoints/chaves Push ou mensagens de feedback. Qualquer futuro acesso excecional a dados identificativos deverá ser uma operação separada, explicitamente justificada e auditada.
          </div>
        </>
      )}
    </div>
  );
}
