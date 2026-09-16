import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, FileCheck2, FileUp, ShieldCheck, X } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/AppStore";
import {
  fetchSharedPucCatalogEntries,
  selectUnambiguousSharedPucEntry,
  type SharedPucCatalogEntry,
} from "@/lib/pucCatalog";
import {
  buildPucUpdateDifferences,
  fetchMyPucUpdateAlerts,
  type PucUpdateAlert,
} from "@/lib/pucUpdateAlerts";

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
  const [updateAlert, setUpdateAlert] = useState<PucUpdateAlert | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!course?.code) return;

    setCatalogStatus("loading");
    setIgnored(false);
    setShowSharedDetails(false);

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

    fetchMyPucUpdateAlerts()
      .then((alerts) => {
        if (cancelled) return;
        setUpdateAlert(alerts.find((alert) => alert.course_code === course.code) ?? null);
      })
      .catch(() => {
        if (!cancelled) setUpdateAlert(null);
      });

    return () => { cancelled = true; };
  }, [course?.code]);

  const sharedEntry = selectUnambiguousSharedPucEntry(catalogEntries);
  const latestAcademicYear = catalogEntries[0]?.academic_year ?? null;
  const latestEntries = latestAcademicYear
    ? catalogEntries.filter((entry) => entry.academic_year === latestAcademicYear)
    : [];
  const hasAmbiguousEdition = latestEntries.length > 1 && new Set(latestEntries.map((entry) => entry.edition)).size > 1;
  const events = sharedEntry?.payload?.events ?? [];
  const finalAssessment = sharedEntry?.payload?.finalAssessment ?? null;
  const updateDifferences = updateAlert ? buildPucUpdateDifferences(updateAlert) : [];
  const showPdfAlternative = ignored || !sharedEntry;

  return (
    <section className="mx-auto mb-4 max-w-5xl space-y-3 px-4 md:px-6">
      {updateAlert && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Foram atualizados dados desta UC
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Utilizaste a versão <strong>{updateAlert.accepted_version}</strong> e está disponível a versão <strong>{updateAlert.active_version}</strong>. Nada será alterado automaticamente na tua cadeira.
              </p>
              {updateDifferences.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {updateDifferences.slice(0, 2).map((difference) => (
                    <div key={`${difference.label}-${difference.before}-${difference.after}`}>
                      <strong>{difference.label}:</strong> {difference.before} → {difference.after}
                    </div>
                  ))}
                  {updateDifferences.length > 2 && <div>+ {updateDifferences.length - 2} alteração(ões)</div>}
                </div>
              )}
            </div>
            <Button asChild className="shrink-0">
              <Link to={`/puc/atualizacoes?courseId=${encodeURIComponent(courseId)}`}>
                Rever atualização
              </Link>
            </Button>
          </div>
        </div>
      )}

      {hasAmbiguousEdition && !ignored && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm md:p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">Existem várias edições desta UC no catálogo</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Foram encontradas várias edições para o ano letivo {latestAcademicYear}. Como a cadeira local ainda não guarda a edição/turma UAb, o Academic Hub não vai escolher uma automaticamente. Usa o PDF do teu PUC para evitar associar dados da edição errada.
              </p>
            </div>
          </div>
        </div>
      )}

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

            <div className="flex shrink-0 flex-wrap gap-2" data-guest-allowed="true">
              <Button type="button" variant="outline" onClick={() => setIgnored(true)}>
                <X className="mr-2 h-4 w-4" />Usar PDF
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

              <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/25 bg-background/55 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs leading-5 text-muted-foreground">
                  Revê estes dados na mesma grelha editável usada pelo PDF. Só depois da tua confirmação explícita poderão ser gravados na cadeira.
                </div>
                <div data-guest-allowed="true">
                  <Button asChild className="shrink-0">
                    <Link to={`/puc/rever?courseId=${encodeURIComponent(courseId)}&catalogId=${encodeURIComponent(sharedEntry.id)}`}>
                      <FileCheck2 className="mr-2 h-4 w-4" />Rever e usar estes dados
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {catalogStatus === "error" && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          Não foi possível consultar o catálogo partilhado. O preenchimento por PDF e o método manual continuam disponíveis normalmente.
        </div>
      )}

      {showPdfAlternative && (
        <div className="rounded-2xl border border-[hsl(var(--gold)/0.35)] bg-card p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--gold-soft))] text-[hsl(var(--gold))]">
                  <FileUp className="h-4 w-4" />
                </div>
                <div className="font-semibold">Preencher a partir do PUC</div>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Se não existir uma estrutura partilhada adequada, importa o PDF do PUC para pré-preencher a tipologia, cotações e atividades. Antes de guardar, poderás rever e corrigir tudo. O preenchimento manual continua disponível.
              </p>
              <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>As datas de exame e recurso mantêm-se as do calendário oficial já usado pelo Academic Hub e não serão substituídas pelo PUC.</span>
              </div>
            </div>

            <Button asChild className="min-h-11 shrink-0 sm:min-w-40">
              <Link to={`/puc/importar?courseId=${encodeURIComponent(courseId)}`}>
                <FileUp className="mr-2 h-4 w-4" />
                Importar PUC
              </Link>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
