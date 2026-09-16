import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import PucReviewDraft from "@/components/PucReviewDraft";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/AppStore";
import { buildSharedPucImportDraft, type SharedPucCatalogEntry } from "@/lib/pucCatalog";
import {
  acceptPucUpdate,
  buildPucUpdateDifferences,
  fetchMyPucUpdateAlerts,
  type PucUpdateAlert,
} from "@/lib/pucUpdateAlerts";

function activeEntry(item: PucUpdateAlert): SharedPucCatalogEntry {
  const events = (item.active_payload?.events ?? []).map((event) => ({
    name: event.name ?? "",
    maxPoints: event.maxPoints ?? null,
    startDate: event.startDate ?? "",
    endDate: event.endDate ?? "",
    gradeReleaseDate: event.gradeReleaseDate ?? "",
  }));
  const finalAssessment = item.active_payload?.finalAssessment
    ? {
        name: item.active_payload.finalAssessment.name ?? "Prova / exame final",
        maxPoints: item.active_payload.finalAssessment.maxPoints ?? null,
      }
    : null;

  return {
    id: item.active_catalog_id,
    course_code: item.course_code,
    course_name: item.course_name,
    academic_year: item.academic_year,
    edition: item.edition,
    evaluation_model: item.active_evaluation_model,
    payload: { events, finalAssessment },
    version: item.active_version,
    validated_at: item.active_validated_at,
    updated_at: item.active_validated_at,
  };
}

export default function PucUpdateAlertsLab() {
  const [searchParams] = useSearchParams();
  const { state } = useAppStore();
  const courseId = searchParams.get("courseId") ?? "";
  const targetCourse = useMemo(
    () => state.courses.find((course) => course.id === courseId),
    [state.courses, courseId],
  );

  const [items, setItems] = useState<PucUpdateAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const visibleItems = useMemo(
    () => targetCourse ? items.filter((item) => item.course_code === targetCourse.code) : items,
    [items, targetCourse],
  );
  const count = visibleItems.length;

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

  const registerAcceptedUpdate = async (item: PucUpdateAlert) => {
    if (busyId) return;
    setBusyId(item.active_catalog_id);
    setError("");
    setMessage("");
    try {
      await acceptPucUpdate(item);
      setMessage(`A versão ${item.active_version} da UC ${item.course_code} ficou associada à tua cadeira depois da revisão e gravação explícitas.`);
      setReviewingId("");
      await load();
    } catch {
      setError("Os dados foram guardados na cadeira, mas não foi possível registar a nova versão utilizada. Atualiza a página antes de voltares a aplicar esta atualização.");
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
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">PUC · versões</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Atualizações do PUC</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Quando uma versão que já utilizaste for corrigida, podes comparar as diferenças e decidir se queres aplicar a nova versão à tua cadeira. Nada é alterado automaticamente.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading || Boolean(busyId)}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar</Button>
          </div>
        </div>
      </section>

      <Card className="premium-card">
        <CardContent className="flex items-center gap-3 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <span><strong>{count}</strong> atualização{count === 1 ? "" : "ões"} pendente{count === 1 ? "" : "s"}{targetCourse ? " nesta UC" : " para esta conta"}.</span>
        </CardContent>
      </Card>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200" role="status">{message}</div>}

      {loading && <Card className="premium-card"><CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />A verificar versões utilizadas por esta conta…</CardContent></Card>}

      {!loading && visibleItems.length === 0 && (
        <Card className="premium-card">
          <CardContent className="p-5 text-sm text-muted-foreground">Não existem atualizações pendentes para as versões de PUC utilizadas{targetCourse ? " nesta UC" : " por esta conta"}.</CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {visibleItems.map((item) => {
          const differences = buildPucUpdateDifferences(item);
          const entry = activeEntry(item);
          const draft = buildSharedPucImportDraft(entry);
          const isReviewing = reviewingId === item.active_catalog_id;
          const course = state.courses.find((candidate) => candidate.code === item.course_code);

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
                    <div className="rounded-xl border bg-background/55 p-3 text-xs text-muted-foreground">A versão foi atualizada, mas não existem diferenças nos campos apresentados.</div>
                  ) : differences.map((difference, index) => (
                    <div key={`${difference.label}-${index}`} className="rounded-xl border bg-background/55 p-3 text-xs">
                      <div className="font-semibold">{difference.label}</div>
                      <div className="mt-1 text-muted-foreground">{difference.before} → <span className="text-foreground">{difference.after}</span></div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
                  <strong>Nada muda automaticamente.</strong> A nova versão só é aplicada depois de abrires a revisão e usares “Guardar na cadeira”. Se mantiveres a versão anterior, os teus dados pessoais não são alterados.
                </div>

                {!isReviewing && (
                  <div className="flex justify-end">
                    <Button type="button" disabled={!course || Boolean(busyId)} onClick={() => setReviewingId(item.active_catalog_id)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />Rever e aplicar atualização
                    </Button>
                  </div>
                )}

                {isReviewing && course && (
                  <PucReviewDraft
                    initialDraft={draft}
                    sourceKind="shared"
                    defaultOpen
                    courseId={course.id}
                    courseName={course.name}
                    courseCode={course.code}
                    onSaved={() => { void registerAcceptedUpdate(item); }}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
