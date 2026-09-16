import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Database, FileUp, ShieldCheck, X } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/AppStore";
import {
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

function formatDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || "—";
}

export default function PucImportEntry({ courseId }: { courseId: string }) {
  const { state } = useAppStore();
  const course = useMemo(() => state.courses.find((item) => item.id === courseId), [state.courses, courseId]);
  const [catalogEntries, setCatalogEntries] = useState<SharedPucCatalogEntry[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [ignored, setIgnored] = useState(false);
  const [showSharedDetails, setShowSharedDetails] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!course?.code) return;

    setCatalogStatus("loading");
    fetchSharedPucCatalogEntries(course.code)
      .then((entries) => {
        if (cancelled) return;
        setCatalogEntries(entries);
        setCatalogStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setCatalogEntries([]);
        setCatalogStatus("error");
      });

    return () => { cancelled = true; };
  }, [course?.code]);

  const sharedEntry = catalogEntries[0] ?? null;
  const events = sharedEntry?.payload?.events ?? [];
  const finalAssessment = sharedEntry?.payload?.finalAssessment ?? null;

  return (
    <section className="mx-auto mb-4 max-w-5xl space-y-3 px-4 md:px-6">
      {sharedEntry && !ignored && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                <Database className="h-4 w-4 shrink-0" />
                Datas disponíveis para esta UC
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Já existe uma estrutura validada para <strong>{sharedEntry.course_name}</strong> ({sharedEntry.course_code}), ano letivo <strong>{sharedEntry.academic_year}</strong>, edição <strong>{sharedEntry.edition}</strong>. Podes rever estes dados sem voltar a carregar o PDF.
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{modelLabel(sharedEntry.evaluation_model)}</span>
                <span>Versão {sharedEntry.version}</span>
                <span>{events.length} elemento(s) contínuo(s){finalAssessment ? " + prova final" : ""}</span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setIgnored(true)}>
                <X className="mr-2 h-4 w-4" />Ignorar
              </Button>
              <Button type="button" onClick={() => setShowSharedDetails((current) => !current)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />{showSharedDetails ? "Ocultar dados" : "Ver dados"}
              </Button>
            </div>
          </div>

          {showSharedDetails && (
            <div className="mt-4 space-y-3 border-t border-emerald-500/20 pt-4">
              {events.map((event, index) => (
                <div key={`${event.name}-${index}`} className="rounded-xl border bg-background/55 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{event.name}</div>
                    <div className="text-xs font-semibold">{event.maxPoints ?? "—"} valores</div>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <div>Início: <strong className="text-foreground">{formatDate(event.startDate)}</strong></div>
                    <div>Entrega: <strong className="text-foreground">{formatDate(event.endDate)}</strong></div>
                    <div>Nota: <strong className="text-foreground">{formatDate(event.gradeReleaseDate)}</strong></div>
                  </div>
                </div>
              ))}

              {finalAssessment && (
                <div className="rounded-xl border bg-background/55 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{finalAssessment.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Apenas a cotação é partilhada. A data/hora continuam a vir do calendário oficial do Academic Hub.</div>
                    </div>
                    <div className="text-xs font-semibold">{finalAssessment.maxPoints ?? "—"} valores</div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
                <strong>Fase atual:</strong> esta vista serve apenas para validar o alerta e os dados partilhados. No próximo passo estes mesmos dados serão enviados para a revisão editável antes de qualquer gravação na cadeira.
              </div>
            </div>
          )}
        </div>
      )}

      {catalogStatus === "error" && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          O catálogo partilhado de teste não respondeu. O preenchimento por PDF continua disponível normalmente.
        </div>
      )}

      <div className="rounded-2xl border border-[hsl(var(--gold)/0.35)] bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--gold-soft))] text-[hsl(var(--gold))]">
                <FileUp className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold">Preencher a partir do PUC</div>
                <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Fase de teste
                </div>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Se ainda não existir uma estrutura partilhada adequada, importa o PDF do PUC para pré-preencher a tipologia, cotações e atividades. Antes de guardar, poderás rever e corrigir tudo. O preenchimento manual continua disponível.
            </p>
            <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>As datas de exame e recurso mantêm-se as do calendário oficial já usado pelo Academic Hub e não serão substituídas pelo PUC.</span>
            </div>
          </div>

          <Button asChild className="min-h-11 shrink-0 sm:min-w-40">
            <Link to={`/_teste/puc?courseId=${encodeURIComponent(courseId)}`}>
              <FileUp className="mr-2 h-4 w-4" />
              Importar PUC
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
