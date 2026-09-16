import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Database, Loader2, MessageSquareWarning, ShieldAlert } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import PucReviewDraft, { type PucDraftChange } from "@/components/PucReviewDraft";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/AppStore";
import type { PucImportDraft } from "@/lib/pucImportDraft";
import {
  buildSharedPucImportDraft,
  fetchSharedPucCatalogEntries,
  type SharedPucCatalogEntry,
} from "@/lib/pucSharedCatalogTest";

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
  const [correctionPreview, setCorrectionPreview] = useState<{
    draft: PucImportDraft;
    changes: PucDraftChange[];
  } | null>(null);

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
    setCorrectionPreview(null);

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

  return (
    <div className="space-y-5 pb-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to={backPath}><ArrowLeft className="mr-2 h-4 w-4" />{backLabel}</Link>
        </Button>
      </div>

      <section className="premium-surface overflow-hidden">
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Teste privado · não publicar</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Rever dados partilhados do PUC</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Estes dados já foram extraídos e validados para esta UC. Antes de serem gravados na tua cadeira, tens de os rever e confirmar explicitamente.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
              <div className="flex items-center gap-2 font-semibold"><Database className="h-4 w-4" />Catálogo partilhado</div>
              <div className="mt-1 max-w-xs">A consulta não altera a tua cadeira. A gravação só acontece no botão final da revisão.</div>
            </div>
          </div>
        </div>
      </section>

      {status === "loading" && (
        <Card className="premium-card">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="h-5 w-5 animate-spin" />A carregar os dados partilhados desta UC…
          </CardContent>
        </Card>
      )}

      {status === "error" && (
        <Card className="premium-card border-destructive/30">
          <CardContent className="flex items-start gap-3 p-5 text-sm text-destructive" role="alert">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div><div className="font-semibold">Não foi possível abrir a revisão</div><div className="mt-1 text-xs leading-5">{error}</div></div>
          </CardContent>
        </Card>
      )}

      {status === "ready" && entry && targetCourse && draft && (
        <>
          <Card className="premium-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-5 w-5 text-emerald-500" />Estrutura encontrada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border bg-background/55 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Unidade curricular</div>
                  <div className="mt-1 text-sm font-semibold">{entry.course_name}</div>
                </div>
                <div className="rounded-xl border bg-background/55 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Código</div>
                  <div className="mt-1 text-sm font-semibold">{entry.course_code}</div>
                </div>
                <div className="rounded-xl border bg-background/55 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ano letivo / edição</div>
                  <div className="mt-1 text-sm font-semibold">{entry.academic_year} · {entry.edition}</div>
                </div>
                <div className="rounded-xl border bg-background/55 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tipologia</div>
                  <div className="mt-1 text-sm font-semibold">{modelLabel(entry.evaluation_model)}</div>
                </div>
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
            onSaved={() => setHasSaved(true)}
            onRequestCorrection={(nextDraft, changes) => setCorrectionPreview({ draft: nextDraft, changes })}
          />

          {correctionPreview && (
            <Card className="premium-card border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base"><MessageSquareWarning className="h-5 w-5 text-amber-500" />Proposta de correção preparada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  Esta proposta é separada da tua gravação pessoal. No funcionamento público será enviada com a versão {entry.version} como base e ficará pendente de validação; não altera o catálogo nem os dados dos outros alunos automaticamente.
                </p>
                <div className="space-y-2">
                  {correctionPreview.changes.map((change) => (
                    <div key={`${change.field}-${change.before}-${change.after}`} className="rounded-xl border bg-background/55 p-3 text-xs">
                      <div className="font-semibold">{change.field}</div>
                      <div className="mt-1 text-muted-foreground">{change.before} → <span className="text-foreground">{change.after}</span></div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
                  <strong>Teste atual:</strong> a branch de desenvolvimento não tem utilizadores autenticados copiados da produção. Por segurança, nesta fase validamos a deteção e a apresentação da proposta; o envio autenticado para a tabela de submissões será ligado no próximo passo, sem criar utilizadores artificiais na branch.
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" onClick={() => setCorrectionPreview(null)}>Fechar proposta</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {hasSaved && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
              Dados confirmados e gravados na cadeira neste teste. As datas oficiais de exame e recurso mantiveram-se inalteradas.
            </div>
          )}
        </>
      )}
    </div>
  );
}
