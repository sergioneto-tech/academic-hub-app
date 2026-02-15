import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { useUpdate } from "@/lib/UpdateProvider";
import StatusBadge from "@/components/StatusBadge";
import DeadlineAlerts, { useDeadlineToasts } from "@/components/DeadlineAlerts";
import { useAppStore } from "@/lib/AppStore";
import { courseStatusLabel, exam, getAssessments, globalStats, resit, totalEctsCompleted, totalEctsDegree, totalEFolios, totalEFoliosMax } from "@/lib/calculations";
import { formatPtNumber } from "@/lib/utils";
import { getPlanCoursesForDegree } from "@/lib/uabPlan";

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function datePart(v: string): string {
  return v.slice(0, 10);
}

function daysLeftFromToday(ymdOrDateTime: string): number | null {
  if (!ymdOrDateTime) return null;
  const ymd = ymdOrDateTime.includes("T") ? datePart(ymdOrDateTime) : ymdOrDateTime;
  const target = parseYmd(ymd);
  if (!target) return null;
  const today = startOfDay(new Date());

  const diff = startOfDay(target).getTime() - today.getTime();
  return Math.round(diff / 86400000);
}

function toneClassForDaysLeft(daysLeft: number): string {
  if (daysLeft === 0) return "text-rose-700";
  if (daysLeft >= 1 && daysLeft <= 5) return "text-amber-700";
  if (daysLeft > 5) return "text-emerald-700";
  return "text-muted-foreground";
}

function fmtDaysLeft(daysLeft: number): string {
  if (daysLeft === 0) return "hoje";
  if (daysLeft === 1) return "1 dia";
  return `${daysLeft} dias`;
}

export default function Dashboard() {
  const { state, exportData } = useAppStore();
  const { updateAvailable, applyUpdate } = useUpdate();
  const stats = globalStats(state);
  const planCourses = useMemo(() => getPlanCoursesForDegree(state.degree), [state.degree]);
  const ectsCompleted = useMemo(() => totalEctsCompleted(state, planCourses), [state, planCourses]);
  const ectsTotal = useMemo(() => totalEctsDegree(planCourses), [planCourses]);
  const today = startOfDay(new Date());
  useDeadlineToasts(state);

  const downloadBackup = () => {
    const json = exportData();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `academic-hub-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const activeCourses = state.courses
    .filter((c) => c.isActive && !c.isCompleted)
    .sort((a, b) => a.code.localeCompare(b.code, "pt-PT"));

  return (
    <div className="space-y-6">
      {/* Hero / cabeçalho */}
      <div className="rounded-2xl overflow-hidden border shadow-lg text-white bg-gradient-to-br from-blue-700 to-blue-500 dark:from-slate-950 dark:to-slate-900">
        <div className="p-5 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Painel do utilizador</h1>
            <p className="text-sm text-white/80">
              Visão geral rápida das cadeiras, e‑fólios e datas importantes.
            </p>

            <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs sm:text-sm">
              <span className="opacity-90">Licenciatura:</span>
              <span className="font-semibold truncate">
                {state.degree?.name ? state.degree.name : "Não selecionada"}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link to="/cadeiras">Gerir cadeiras</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto bg-white/10 text-white border-white/30 hover:bg-white/20">
              <Link to="/calendario">Ver calendário</Link>
            </Button>
          </div>
        </div>
      </div>

      
      {!state.degree && (
        <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="font-semibold">Falta escolher a tua licenciatura</div>
              <div className="text-xs text-muted-foreground">
                Vai a <span className="font-medium">Definições</span> e escolhe a licenciatura que estás a tirar. Assim o plano automático fica correto.
              </div>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link to="/definicoes">Ir a Definições</Link>
            </Button>
          </div>
        </div>
      )}

      <DeadlineAlerts state={state} />

      {updateAvailable && (
        <Card className="border-warning/40 bg-warning/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Atualização disponível</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Podes atualizar a aplicação quando quiseres. Os teus dados ficam guardados localmente, mas é boa prática exportar um backup antes.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={downloadBackup}>
                <Download className="mr-2 h-4 w-4" />
                Exportar backup
              </Button>
              <Button size="sm" onClick={applyUpdate}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar versão
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

{/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="bg-card/70 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ativas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.active}</CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Concluídas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.completed}</CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Média (concluídas)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.completed ? stats.avg : "—"}</CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Eventos (datas)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.eventsCount}</CardContent>
        </Card>

        <Card className="bg-card/70 backdrop-blur col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">ECTS concluídos</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {ectsCompleted}{ectsTotal > 0 && <span className="text-sm font-normal text-muted-foreground"> / {ectsTotal}</span>}
          </CardContent>
        </Card>
      </div>

      {/* Cadeiras ativas (sem "campo" extra — já aparecem aqui) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Cadeiras ativas</h2>
          <Button variant="ghost" asChild>
            <Link to="/cadeiras">Ver todas →</Link>
          </Button>
        </div>

        {activeCourses.length === 0 ? (
          <Card className="bg-card/70 backdrop-blur">
            <CardContent className="py-6 text-sm text-muted-foreground">
              Nenhuma cadeira ativa. Vai a “Cadeiras” e ativa as que estás a frequentar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeCourses.map((c) => {
              const st = courseStatusLabel(state, c.id);
              const ef = totalEFolios(state, c.id);
              const efMax = totalEFoliosMax(state, c.id);
              const ex = exam(state, c.id);
              const rc = resit(state, c.id);

              const efolioLines = getAssessments(state, c.id, "efolio")
                .filter((a) => a.startDate && a.endDate)
                .map((a) => {
                  const s = parseYmd(a.startDate!);
                  const e = parseYmd(a.endDate!);
                  if (!s || !e) return null;
                  const ss = startOfDay(s);
                  const ee = startOfDay(e);
                  if (today < ss || today > ee) return null;
                  const daysLeft = Math.round((ee.getTime() - today.getTime()) / 86400000);
                  const cls = toneClassForDaysLeft(daysLeft);
                  const text = daysLeft === 0 ? `Último dia: ${a.name}` : `${a.name} termina em ${fmtDaysLeft(daysLeft)}`;
                  return { key: a.id, cls, text };
                })
                .filter((x): x is { key: string; cls: string; text: string } => Boolean(x));

              const examDays = ex?.date ? daysLeftFromToday(ex.date) : null;
              const examLine = examDays !== null && examDays >= 0
                ? { cls: toneClassForDaysLeft(examDays), text: examDays === 0 ? "Exame hoje" : `Exame em ${fmtDaysLeft(examDays)}` }
                : null;

              const showResit = st.label === "Recurso" && Boolean(rc?.date);
              const resitDays = showResit && rc?.date ? daysLeftFromToday(rc.date) : null;
              const resitLine = resitDays !== null && resitDays >= 0
                ? { cls: toneClassForDaysLeft(resitDays), text: resitDays === 0 ? "Recurso hoje" : `Recurso em ${fmtDaysLeft(resitDays)}` }
                : null;

              return (
                <Link
                  key={c.id}
                  to={`/cadeiras/${c.id}`}
                  className="block rounded-xl border bg-white/70 backdrop-blur p-4 hover:bg-white/90 dark:bg-slate-900/40 dark:hover:bg-slate-900/55"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold leading-tight truncate">{c.code} — {c.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        E‑fólios: {formatPtNumber(ef)} / {formatPtNumber(efMax)}
                        {ex?.date ? ` • Exame: ${datePart(ex.date)}` : ""}
                      </div>

                      {(examLine || resitLine || efolioLines.length > 0) && (
                        <div className="mt-2 space-y-1">
                          {examLine && (
                            <div className={`text-xs font-medium ${examLine.cls}`}>⏳ {examLine.text}</div>
                          )}
                          {resitLine && (
                            <div className={`text-xs font-medium ${resitLine.cls}`}>⏳ {resitLine.text}</div>
                          )}
                          {efolioLines.map((l) => (
                            <div key={l.key} className={`text-xs font-medium ${l.cls}`}>⏳ {l.text}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      <StatusBadge label={st.label} tone={st.badge} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
