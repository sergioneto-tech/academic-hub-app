import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Database, Loader2, MessageSquareWarning, ShieldAlert } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import PucReviewDraft, { type PucCorrectionDeclaration, type PucDraftChange } from "@/components/PucReviewDraft";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/AppStore";
import { submitPucCorrection } from "@/lib/pucCorrections";
import type { PucImportDraft } from "@/lib/pucImportDraft";
import {
  buildSharedPucImportDraft,
  fetchSharedPucCatalogEntries,
  type SharedPucCatalogEntry,
} from "@/lib/pucCatalog";
import { acceptCurrentPucCatalogVersion } from "@/lib/pucVersionState";

function modelLabel(value: string) {
  const labels: Record<string, string> = {
    type1: "Tipologia 1",
    type2: "Tipologia 2",
    type3: "Tipologia 3",
    type4: "Tipologia 4",
    "exam-only": "Avaliação por exame",
    custom: "Configuração personalizada",
  };
  return labels[value] ?? value;
}

function formatPtDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function PucSharedReviewLab() {
  const [searchParams] = useSearchParams();
  const { state } = useAppStore();
  const courseId = searchParams.get("courseId") ?? "";
  const catalogId = searchParams.get("catalogId") ?? "";
  const targetCourse = useMemo(
    () => state.courses.find((course) => course.id === courseId),
    [state.courses, courseId],
  );

  const [entry, setEntry] = useState<SharedPucCatalogEntry | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [hasSaved, setHasSaved] = useState(false);
  const [acceptanceError, setAcceptanceError] = useState("");
  const [correctionPreview, setCorrectionPreview] = useState<{
    draft: PucImportDraft;
    changes: PucDraftChange[];
    declaration: PucCorrectionDeclaration;
  } | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [correctionMessage, setCorrectionMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!targetCourse?.code) {
      setStatus("error");
      setError("Não foi possível identificar a cadeira selecionada.");
      return () => { cancelled = true; };
    }

    setStatus("loading");
    setError("");
    setEntry(null);
    setHasSaved(false);
    setAcceptanceError("");
    setCorrectionPreview(null);
    setCorrectionStatus("idle");
    setCorrectionMessage("");

    fetchSharedPucCatalogEntries(targetCourse.code)
      .then((entries) => {
        if (cancelled) return;
        const selected = (catalogId ? entries.find((item) => item.id === catalogId) : null) ?? entries[0] ?? null;
        if (!selected) {
          setStatus("error");
          setError("A estrutura partilhada deixou de estar disponível. Podes voltar à cadeira e importar o PUC em PDF.");
          return;
        }

        if (selected.course_code !== targetCourse.code) {
          setStatus("error");
          setError("A estrutura partilhada não corresponde à cadeira selecionada e foi bloqueada por segurança.");
          return;
        }

        setEntry(selected);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        setError("Não foi possível carregar a estrutura partilhada. Nenhum dado foi alterado.");
      });

    return () => { cancelled = true; };
  }, [targetCourse?.code, catalogId]);

  const draft = useMemo(() => entry ? buildSharedPucImportDraft(entry) : null, [entry]);
  const backPath = targetCourse ? `/cadeiras/${encodeURIComponent(targetCourse.id)}` : "/cadeiras";
  const backLabel = targetCourse ? `Voltar a ${targetCourse.name}` : "Voltar às cadeiras";

  const registerUse = async () => {
    if (!entry) return;
    setHasSaved(true);
    setAcceptanceError("");
    try {
      await acceptCurrentPucCatalogVersion(entry.id, entry.version);
    } catch {
      setAcceptanceError("Os dados foram guardados na tua cadeira, mas não foi possível registar a versão partilhada utilizada. Volta à cadeira e atualiza antes de reutilizares estes dados.");
    }
  };

  const sendCorrection = async () => {
    if (!entry || !correctionPreview || correctionStatus === "sending" || correctionStatus === "sent") return;
    setCorrectionStatus("sending");
    setCorrectionMessage("");

    const result = await submitPucCorrection({
      entry,
      draft: correctionPreview.draft,
      changes: correctionPreview.changes,
      declaration: correctionPreview.declaration,
    });

    if (result.ok) {
      setCorrectionStatus("sent");
      setCorrectionMessage(result.message);
      return;
    }

    setCorrectionStatus("error");
    setCorrectionMessage(result.message);
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="min-w-0">
        <Button asChild variant="ghost" size="sm" className="max-w-full justify-start">
          <Link to={backPath} className="min-w-0 max-w-full">
            <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{backLabel}</span>
          </Link>
        </Button>
      </div>

      <section className="premium-surface overflow-hidden">
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">PUC · catálogo partilhado</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Rever dados disponíveis para esta UC</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Estes dados já foram validados para esta UC. Antes de serem gravados na tua cadeira, tens de os rever e confirmar explicitamente.</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
              <div className="flex items-center gap-2 font-semibold"><Database className="h-4 w-4" />Catálogo partilhado</div>
              <div className="mt-1 max-w-xs">A consulta não altera a tua cadeira. A gravação só acontece no botão final da revisão.</div>
            </div>
          </div>
        </div>
      </section>

      {status === "loading" && <Card className="premium-card"><CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground" role="status" aria-live="polite"><Loader2 className="h-5 w-5 animate-spin" />A carregar os dados partilhados desta UC…</CardContent></Card>}

      {status === "error" && <Card className="premium-card border-destructive/30"><CardContent className="flex items-start gap-3 p-5 text-sm text-destructive" role="alert"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><div className="font-semibold">Não foi possível abrir a revisão</div><div className="mt-1 text-xs leading-5">{error}</div></div></CardContent></Card>}

      {status === "ready" && entry && targetCourse && draft && (
        <>
          <Card className="premium-card">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-5 w-5 text-emerald-500" />Estrutura encontrada</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border bg-background/55 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Unidade curricular</div><div className="mt-1 break-words text-sm font-semibold">{entry.course_name}</div></div>
                <div className="rounded-xl border bg-background/55 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Código</div><div className="mt-1 text-sm font-semibold">{entry.course_code}</div></div>
                <div className="rounded-xl border bg-background/55 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ano letivo / edição</div><div className="mt-1 text-sm font-semibold">{entry.academic_year} · {entry.edition}</div></div>
                <div className="rounded-xl border bg-background/55 p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tipologia</div><div className="mt-1 text-sm font-semibold">{modelLabel(entry.evaluation_model)}</div></div>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">Versão {entry.version} · nenhuma alteração é aplicada antes da confirmação na revisão abaixo.</div>
            </CardContent>
          </Card>

          <PucReviewDraft
            initialDraft={draft}
            sourceKind="shared"
            defaultOpen
            courseId={targetCourse.id}
            courseName={targetCourse.name}
            courseCode={targetCourse.code}
            onSaved={() => { void registerUse(); }}
            onRequestCorrection={(nextDraft, changes, declaration) => {
              setCorrectionPreview({ draft: nextDraft, changes, declaration });
              setCorrectionStatus("idle");
              setCorrectionMessage("");
            }}
          />

          {correctionPreview && (
            <Card className="premium-card border-amber-500/30">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><MessageSquareWarning className="h-5 w-5 text-amber-500" />Proposta de correção preparada</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs leading-5 text-muted-foreground">Esta proposta é separada da tua gravação pessoal. Será enviada com a versão {entry.version} como base e ficará pendente de validação; não altera o catálogo nem os dados dos outros alunos automaticamente.</p>
                <div className="space-y-2">
                  {correctionPreview.changes.map((change) => <div key={`${change.field}-${change.before}-${change.after}`} className="rounded-xl border bg-background/55 p-3 text-xs"><div className="font-semibold">{change.field}</div><div className="mt-1 break-words text-muted-foreground">{change.before} → <span className="text-foreground">{change.after}</span></div></div>)}
                </div>
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
                  <div className="font-semibold">Declaração associada à proposta</div>
                  <div className="mt-1">Fonte oficial confirmada · versão {correctionPreview.declaration.version} · {formatPtDateTime(correctionPreview.declaration.acceptedAt)}</div>
                </div>

                {correctionMessage && (
                  <div className={`rounded-xl border p-3 text-xs leading-5 ${correctionStatus === "sent" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : "border-destructive/30 bg-destructive/10 text-destructive"}`} role={correctionStatus === "sent" ? "status" : "alert"} aria-live="polite">
                    {correctionMessage}
                  </div>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" disabled={correctionStatus === "sending"} onClick={() => {
                    setCorrectionPreview(null);
                    setCorrectionStatus("idle");
                    setCorrectionMessage("");
                  }}>Fechar proposta</Button>
                  <Button type="button" disabled={correctionStatus === "sending" || correctionStatus === "sent"} onClick={sendCorrection}>
                    {correctionStatus === "sending" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {correctionStatus === "sent" ? "Correção comunicada" : correctionStatus === "sending" ? "A comunicar…" : "Enviar correção para validação"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {hasSaved && !acceptanceError && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-800 dark:text-emerald-200">Dados confirmados e gravados na cadeira. A versão {entry.version} ficou associada à tua utilização. As datas oficiais de exame e recurso mantiveram-se inalteradas.</div>}
          {acceptanceError && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100" role="alert">{acceptanceError}</div>}
        </>
      )}
    </div>
  );
}
