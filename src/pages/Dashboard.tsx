import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { useUpdate } from "@/lib/UpdateProvider";
import StatusBadge from "@/components/StatusBadge";
import DeadlineAlerts, { useDeadlineToasts } from "@/components/DeadlineAlerts";
import { useAppStore } from "@/lib/AppStore";
import { courseStatusLabel, exam, getAssessments, globalStats, resit, totalEctsCompleted, totalEctsDegree, totalEFolios, totalEFoliosMax } from "@/lib/calculations";
import { formatPtNumber } from "@/lib/utils";
import { getPlanCoursesForDegree, getCourseArea } from "@/lib/uabPlan";
import { getExamDates } from "@/lib/uabExamDates";

const UPDATE_DEFER_KEY = "academicHub:updateDeferred";

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
  if (daysLeft === 0) return "text-destructive";
  if (daysLeft >= 1 && daysLeft <= 5) return "text-warning";
  if (daysLeft > 5) return "text-emerald-600 dark:text-emerald-400";
  return "text-muted-foreground";
}

function boxClassForDaysLeft(daysLeft: number): string {
  // realçar prazos próximos (sem mudar cores globais da app)
  if (daysLeft === 0) return \"rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5\";
  if (daysLeft >= 1 && daysLeft <= 5) return \"rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5\";
  return \"\";
}

function fmtDaysLeft(daysLeft: number): string {
  if (daysLeft === 0) return "hoje";
  if (daysLeft === 1) return "1 dia";
  return `${daysLeft} dias`;
}

function formatDatePt(ymd: string): string {
  const d = parseYmd(ymd);
  if (!d) return ymd;
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
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
    <div className="space-y-4">
      {/* Hero / painel compacto */}
      <div className="rounded-xl overflow-hidden border shadow-md text-white bg-gradient-to-br from-blue-700 to-blue-500 dark:from-slate-950 dark:to-slate-900">
        <div className="px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Painel do utilizador</h1>
            <div className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
              <span className="opacity-80">Licenciatura:</span>
              <span className="font-semibold truncate">
                {state.degree?.name ? state.degree.name : "Não selecionada"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm" className="text-xs">
              <Link to="/cadeiras">Gerir cadeiras</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="text-xs bg-white/10 text-white border-white/30 hover:bg-white/20">
              <Link to="/calendario">Calendário</Link>
            </Button>
          </div>
        </div>
      </div>

      {!state.degree && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="font-semibold text-sm">Falta escolher a tua licenciatura</div>
              <div className="text-xs text-muted-foreground">
                Vai a <span className="font-medium">Definições</span> e escolhe a licenciatura.
              </div>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link to="/definicoes">Ir a Definições</Link>
            </Button>
          </div>
        </div>
      )}

      {/* KPIs compactos — 5 em linha no desktop, 3+2 no mobile */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {[
          { label: "Ativas", value: stats.active },
          { label: "Concluídas", value: stats.completed },
          { label: "Média", value: stats.completed ? stats.avg : "—" },
          { label: "Eventos", value: stats.eventsCount },
          { label: "ECTS", value: `${ectsCompleted}${ectsTotal > 0 ? `/${ectsTotal}` : ""}` },
        ].map((kpi) => (
          <Card key={kpi.label} className="bg-card/70 backdrop-blur">
            <CardContent className="px-3 py-2">
              <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{kpi.label}</div>
              <div className="text-lg sm:text-xl font-semibold leading-tight mt-0.5">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DeadlineAlerts state={state} />

      {updateAvailable && localStorage.getItem(UPDATE_DEFER_KEY) && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">Atualização disponível (adiada)!</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={downloadBackup}>
                <Download className="mr-1 h-3 w-3" /> Backup
              </Button>
              <Button size="sm" onClick={applyUpdate}>
                <RefreshCw className="mr-1 h-3 w-3" /> Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cadeiras ativas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Cadeiras ativas</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/cadeiras">Ver todas →</Link>
          </Button>
        </div>

        {activeCourses.length === 0 ? (
          <Card className="bg-card/70 backdrop-blur">
            <CardContent className="py-4 text-sm text-muted-foreground">
              Nenhuma cadeira ativa. Vai a "Cadeiras" e ativa as que estás a frequentar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeCourses.map((c) => {
              const st = courseStatusLabel(state, c.id);
              const ef = totalEFolios(state, c.id);
              const efMax = totalEFoliosMax(state, c.id);
              const ex = exam(state, c.id);
              const rc = resit(state, c.id);

              // Get exam dates from UAb calendar
              const planCourse = planCourses.find(pc => pc.code === c.code);
              const semester = planCourse?.semester;
              const examDates = getExamDates(c.code, semester);

              // Determine effective exam/resit dates: prefer user-entered, fallback to calendar
              const effectiveExamDate = ex?.date || examDates?.examDate || null;
              const effectiveResitDate = rc?.date || examDates?.resitDate || null;

              const efolioLines = getAssessments(state, c.id, "efolio")
  .filter((a) => a.startDate || a.endDate || a.gradeReleaseDate)
  .map((a) => {
    const s = a.startDate ? parseYmd(a.startDate) : null;
    const e = a.endDate ? parseYmd(a.endDate) : null;
    const g = a.gradeReleaseDate ? parseYmd(a.gradeReleaseDate) : null;

    const ss = s ? startOfDay(s) : null;
    const ee = e ? startOfDay(e) : null;
    const gg = g ? startOfDay(g) : null;

    // 1) Antes do início -> contagem para começar
    if (ss && today < ss) {
      const daysLeft = Math.round((ss.getTime() - today.getTime()) / 86400000);
      const cls = toneClassForDaysLeft(daysLeft);
      const text = daysLeft === 0 ? `${a.name} começa hoje` : `${a.name} começa em ${fmtDaysLeft(daysLeft)}`;
      return { key: `${a.id}-pre`, cls, text, sort: daysLeft };
    }

    // 2) Durante -> contagem para entrega
    if (ss && ee && today >= ss && today <= ee) {
      const daysLeft = Math.round((ee.getTime() - today.getTime()) / 86400000);
      const cls = toneClassForDaysLeft(daysLeft);
      const text = daysLeft === 0 ? `Último dia: ${a.name}` : `${a.name} termina em ${fmtDaysLeft(daysLeft)}`;
      return { key: `${a.id}-during`, cls, text, sort: daysLeft };
    }

    // 3) Depois -> contagem para publicação da nota (se existir)
    if (ee && gg && today > ee && today <= gg) {
      const daysLeft = Math.round((gg.getTime() - today.getTime()) / 86400000);
      const cls = toneClassForDaysLeft(daysLeft);
      const text = daysLeft === 0 ? `Nota hoje: ${a.name}` : `Nota de ${a.name} em ${fmtDaysLeft(daysLeft)}`;
      return { key: `${a.id}-grade`, cls, text, sort: daysLeft };
    }

    return null;
  })
  .filter((x): x is { key: string; cls: string; text: string; sort: number } => Boolean(x))
  .sort((a, b) => a.sort - b.sort)
  .slice(0, 2)
  .map(({ key, cls, text, sort }) => ({ key, cls, text, daysLeft: sort }));

const examDays = effectiveExamDate ? daysLeftFromToday(effectiveExamDate) : null;
const examLine = examDays !== null && examDays >= 0
  ? { key: `${c.id}-exam`, cls: toneClassForDaysLeft(examDays), text: examDays === 0 ? "Exame hoje" : `Exame em ${fmtDaysLeft(examDays)}`, daysLeft: examDays }
  : null;

const showResit = st.label === "Recurso" && Boolean(effectiveResitDate);
const resitDays = showResit && effectiveResitDate ? daysLeftFromToday(effectiveResitDate) : null;
const resitLine = resitDays !== null && resitDays >= 0
  ? { key: `${c.id}-resit`, cls: toneClassForDaysLeft(resitDays), text: resitDays === 0 ? "Recurso hoje" : `Recurso em ${fmtDaysLeft(resitDays)}`, daysLeft: resitDays }
  : null;

// Ordenar por urgência (mais próximo primeiro)
const timeLines = [examLine, resitLine, ...efolioLines]
  .filter((x): x is { key: string; cls: string; text: string; daysLeft: number } => Boolean(x))
  .sort((a, b) => a.daysLeft - b.daysLeft);

              return (
                <Link
                  key={c.id}
                  to={`/cadeiras/${c.id}`}
                  className="block rounded-xl border bg-card/70 backdrop-blur p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm leading-tight truncate">{c.code} — {c.name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        E‑fólios: {formatPtNumber(ef)} / {formatPtNumber(efMax)}
                        {effectiveExamDate ? ` • Exame: ${formatDatePt(datePart(effectiveExamDate))}` : ""}
                        {effectiveResitDate && st.label === "Recurso" ? ` • Recurso: ${formatDatePt(datePart(effectiveResitDate))}` : ""}
                      </div>
                      {getCourseArea(planCourses, c.code) && (
                        <div className="mt-0.5 text-[10px] italic text-muted-foreground/70">
                          {getCourseArea(planCourses, c.code)}
                        </div>
                      )}

                      {timeLines.length > 0 && (
  <div className="mt-1.5 space-y-0.5">
    {timeLines.map((l) => (
      <div
        key={l.key}
        className={`text-[11px] font-medium ${l.cls} ${boxClassForDaysLeft(l.daysLeft)}`}
      >
        ⏳ {l.text}
      </div>
    ))}
  </div>
)}

                      {/* Show exam dates from UAb calendar when no countdown is active */}
                      {!examLine && !resitLine && examDates && (
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground/80">
                          {examDates.examDate && (
                            <span>📝 Normal: {formatDatePt(examDates.examDate)}{examDates.examPeriod ? ` (${examDates.examPeriod === "M" ? "10h" : "15h"})` : ""}</span>
                          )}
                          {examDates.resitDate && (
                            <span>🔄 Recurso: {formatDatePt(examDates.resitDate)}{examDates.resitPeriod ? ` (${examDates.resitPeriod === "M" ? "10h" : "15h"})` : ""}</span>
                          )}
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