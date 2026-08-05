import { useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  GraduationCap,
  LayoutGrid,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";

import DeadlineAlerts, { useDeadlineToasts } from "@/components/DeadlineAlerts";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/lib/AppStore";
import {
  courseStatusLabel,
  exam,
  getAssessments,
  globalStats,
  resit,
  totalEctsCompleted,
  totalEctsDegree,
  totalEFolios,
  totalEFoliosMax,
} from "@/lib/calculations";
import { formatPtDate } from "@/lib/date";
import { getDegreeAccent } from "@/lib/degreeTheme";
import { useUpdate } from "@/lib/UpdateProvider";
import { getCourseArea, getPlanCoursesForDegree } from "@/lib/uabPlan";
import { getExamDates } from "@/lib/uabExamDates";
import { formatPtNumber } from "@/lib/utils";

const UPDATE_DEFER_KEY = "academicHub:updateDeferred";

type TimelineItem = {
  key: string;
  className: string;
  text: string;
  daysLeft: number;
};

type Metric = {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof LayoutGrid;
};

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function datePart(value: string): string {
  return value.slice(0, 10);
}

function daysLeftFromToday(value: string): number | null {
  if (!value) return null;
  const target = parseYmd(value.includes("T") ? datePart(value) : value);
  if (!target) return null;
  return Math.round((startOfDay(target).getTime() - startOfDay(new Date()).getTime()) / 86400000);
}

function textClassForDaysLeft(daysLeft: number): string {
  if (daysLeft === 0) return "text-destructive";
  if (daysLeft >= 1 && daysLeft <= 5) return "text-warning";
  if (daysLeft > 5) return "text-emerald-700 dark:text-emerald-400";
  return "text-muted-foreground";
}

function surfaceClassForDaysLeft(daysLeft: number): string {
  if (daysLeft === 0) return "border-destructive/30 bg-destructive/10";
  if (daysLeft >= 1 && daysLeft <= 5) return "border-warning/35 bg-warning/10";
  return "border-border/70 bg-muted/35";
}

function formatDaysLeft(daysLeft: number): string {
  if (daysLeft === 0) return "hoje";
  if (daysLeft === 1) return "1 dia";
  return `${daysLeft} dias`;
}

function wasUpdateDeferred(): boolean {
  try {
    return Boolean(localStorage.getItem(UPDATE_DEFER_KEY));
  } catch {
    return false;
  }
}

function progressPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
}

export default function Dashboard() {
  const { state, exportData } = useAppStore();
  const { updateAvailable, applyUpdate } = useUpdate();
  const stats = globalStats(state);
  const accent = getDegreeAccent(state.degree);
  const planCourses = useMemo(() => getPlanCoursesForDegree(state.degree), [state.degree]);
  const ectsCompleted = useMemo(() => totalEctsCompleted(state, planCourses), [state, planCourses]);
  const ectsTotal = useMemo(() => totalEctsDegree(planCourses), [planCourses]);
  const ectsProgress = progressPercent(ectsCompleted, ectsTotal);
  const today = startOfDay(new Date());
  const displayName = state.profile?.displayName?.trim() || "Aluno";

  useDeadlineToasts(state);

  const activeCourses = useMemo(
    () => state.courses
      .filter((course) => course.isActive && !course.isCompleted)
      .sort((a, b) => a.code.localeCompare(b.code, "pt-PT")),
    [state.courses],
  );

  const metrics: Metric[] = [
    {
      label: "Cadeiras ativas",
      value: stats.active,
      detail: stats.active === 1 ? "cadeira em frequência" : "cadeiras em frequência",
      icon: BookOpen,
    },
    {
      label: "Concluídas",
      value: stats.completed,
      detail: stats.completed === 1 ? "cadeira terminada" : "cadeiras terminadas",
      icon: CheckCircle2,
    },
    {
      label: "Média atual",
      value: stats.completed ? formatPtNumber(stats.avg) : "—",
      detail: stats.completed ? "nas cadeiras concluídas" : "sem classificações finais",
      icon: TrendingUp,
    },
    {
      label: "Eventos",
      value: stats.eventsCount,
      detail: "datas académicas registadas",
      icon: CalendarDays,
    },
  ];

  const downloadBackup = () => {
    const json = exportData();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `academic-hub-backup-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  return (
    <div className="space-y-6">
      <section className="premium-surface relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ backgroundColor: accent.color }}
          aria-hidden="true"
        />
        <div className="relative grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-7">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[hsl(var(--gold))]">
              <Sparkles className="h-4 w-4" />
              Resumo académico
            </div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Olá, {displayName}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Acompanha as cadeiras em frequência, os próximos prazos e a evolução da tua licenciatura num único espaço.
            </p>
            <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent.color }} />
              <span className="truncate font-medium">{state.degree?.name || "Licenciatura ainda não selecionada"}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button asChild>
              <Link to="/cadeiras">
                <BookOpen className="mr-2 h-4 w-4" />
                Gerir cadeiras
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/calendario">
                <CalendarDays className="mr-2 h-4 w-4" />
                Ver calendário
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {!state.degree && (
        <section className="premium-surface border-warning/35 bg-warning/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold">Falta escolher a licenciatura</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Seleciona o curso nas Definições para carregar o plano de estudos e calcular o progresso.
              </p>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link to="/definicoes">Abrir Definições</Link>
            </Button>
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="premium-card">
              <CardContent className="dashboard-metric-card flex min-h-36 flex-col items-center justify-center gap-2 p-4 text-center">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 text-center">
                  <div className="text-xs font-medium text-muted-foreground">{metric.label}</div>
                  <div className="mt-0.5 text-2xl font-semibold tracking-tight">{metric.value}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{metric.detail}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="premium-surface p-4 md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[hsl(var(--gold-soft))] text-[hsl(var(--gold))]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Progresso da licenciatura</div>
              <div className="text-xs text-muted-foreground">
                {ectsTotal > 0 ? `${ectsCompleted} de ${ectsTotal} ECTS concluídos` : "O progresso ficará disponível após escolheres a licenciatura."}
              </div>
            </div>
          </div>
          <div className="text-2xl font-semibold text-[hsl(var(--gold))]">{ectsTotal > 0 ? `${ectsProgress}%` : "—"}</div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${ectsProgress}%`, backgroundColor: accent.color }}
            role="progressbar"
            aria-label="Progresso da licenciatura"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={ectsProgress}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button asChild variant="ghost" size="sm">
            <Link to="/plano">
              Consultar plano de estudos
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <DeadlineAlerts state={state} />

      {updateAvailable && wasUpdateDeferred() && (
        <Card className="border-warning/40 bg-warning/10">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Atualização adiada</div>
              <div className="text-xs text-muted-foreground">Podes criar um backup antes de instalar a nova versão.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={downloadBackup}>
                <Download className="mr-2 h-4 w-4" />
                Backup
              </Button>
              <Button size="sm" onClick={() => void applyUpdate()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Cadeiras ativas</h2>
            <p className="text-xs text-muted-foreground">Notas, estados e acontecimentos mais próximos.</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/cadeiras">
              Ver todas
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {activeCourses.length === 0 ? (
          <Card className="premium-card">
            <CardContent className="flex flex-col items-center py-9 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <BookOpen className="h-6 w-6" />
              </div>
              <div className="mt-3 font-medium">Nenhuma cadeira ativa</div>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Ativa as cadeiras que estás a frequentar para acompanhares notas, datas e progresso no painel.
              </p>
              <Button asChild className="mt-4" size="sm">
                <Link to="/cadeiras">Gerir cadeiras</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {activeCourses.map((course) => {
              const status = courseStatusLabel(state, course.id);
              const efolioGrade = totalEFolios(state, course.id);
              const efolioMaximum = totalEFoliosMax(state, course.id);
              const examAssessment = exam(state, course.id);
              const resitAssessment = resit(state, course.id);
              const planCourse = planCourses.find((item) => item.code === course.code);
              const examDates = getExamDates(course.code, planCourse?.semester);
              const effectiveExamDate = examAssessment?.date || examDates?.examDate || null;
              const effectiveResitDate = resitAssessment?.date || examDates?.resitDate || null;

              const assessmentTimeline: TimelineItem[] = getAssessments(state, course.id, "efolio")
                .filter((assessment) => assessment.startDate || assessment.endDate || assessment.gradeReleaseDate)
                .map((assessment): TimelineItem | null => {
                  const start = assessment.startDate ? parseYmd(assessment.startDate) : null;
                  const end = assessment.endDate ? parseYmd(assessment.endDate) : null;
                  const gradeRelease = assessment.gradeReleaseDate ? parseYmd(assessment.gradeReleaseDate) : null;
                  const startDay = start ? startOfDay(start) : null;
                  const endDay = end ? startOfDay(end) : null;
                  const gradeDay = gradeRelease ? startOfDay(gradeRelease) : null;

                  if (startDay && today < startDay) {
                    const daysLeft = Math.round((startDay.getTime() - today.getTime()) / 86400000);
                    return {
                      key: `${assessment.id}-start`,
                      className: textClassForDaysLeft(daysLeft),
                      text: `${assessment.name} começa em ${formatDaysLeft(daysLeft)}`,
                      daysLeft,
                    };
                  }

                  if (startDay && endDay && today >= startDay && today <= endDay) {
                    const daysLeft = Math.round((endDay.getTime() - today.getTime()) / 86400000);
                    return {
                      key: `${assessment.id}-end`,
                      className: textClassForDaysLeft(daysLeft),
                      text: daysLeft === 0 ? `Último dia: ${assessment.name}` : `${assessment.name} termina em ${formatDaysLeft(daysLeft)}`,
                      daysLeft,
                    };
                  }

                  if (endDay && gradeDay && today > endDay && today <= gradeDay) {
                    const daysLeft = Math.round((gradeDay.getTime() - today.getTime()) / 86400000);
                    return {
                      key: `${assessment.id}-grade`,
                      className: textClassForDaysLeft(daysLeft),
                      text: daysLeft === 0 ? `Nota hoje: ${assessment.name}` : `Nota de ${assessment.name} em ${formatDaysLeft(daysLeft)}`,
                      daysLeft,
                    };
                  }

                  return null;
                })
                .filter((item): item is TimelineItem => item !== null)
                .sort((a, b) => a.daysLeft - b.daysLeft)
                .slice(0, 2);

              const examDays = effectiveExamDate ? daysLeftFromToday(effectiveExamDate) : null;
              const examTimeline: TimelineItem | null = examDays !== null && examDays >= 0
                ? {
                    key: `${course.id}-exam`,
                    className: textClassForDaysLeft(examDays),
                    text: examDays === 0 ? "Exame hoje" : `Exame em ${formatDaysLeft(examDays)}`,
                    daysLeft: examDays,
                  }
                : null;

              const showResit = status.label === "Recurso" && Boolean(effectiveResitDate);
              const resitDays = showResit && effectiveResitDate ? daysLeftFromToday(effectiveResitDate) : null;
              const resitTimeline: TimelineItem | null = resitDays !== null && resitDays >= 0
                ? {
                    key: `${course.id}-resit`,
                    className: textClassForDaysLeft(resitDays),
                    text: resitDays === 0 ? "Recurso hoje" : `Recurso em ${formatDaysLeft(resitDays)}`,
                    daysLeft: resitDays,
                  }
                : null;

              const timeline = [examTimeline, resitTimeline, ...assessmentTimeline]
                .filter((item): item is TimelineItem => item !== null)
                .sort((a, b) => a.daysLeft - b.daysLeft)
                .slice(0, 3);

              const area = getCourseArea(planCourses, course.code);

              return (
                <Link
                  key={course.id}
                  to={`/cadeiras/${course.id}`}
                  className="premium-card group block p-4 hover:-translate-y-0.5 hover:border-primary/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                        <span className="rounded-md bg-muted px-2 py-0.5">{course.code}</span>
                        {course.evaluationRegime === "regulation-2026" && (
                          <span className="rounded-md border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold-soft))] px-2 py-0.5 text-[hsl(var(--gold))]">
                            Modelo 2026
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 line-clamp-2 font-semibold leading-snug group-hover:text-primary">{course.name}</h3>
                      {area && <div className="mt-1 text-xs text-muted-foreground">{area}</div>}
                    </div>
                    <StatusBadge label={status.label} tone={status.badge} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border bg-muted/25 p-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Avaliação contínua</div>
                      <div className="mt-0.5 font-semibold">{formatPtNumber(efolioGrade)} / {formatPtNumber(efolioMaximum)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Exame</div>
                      <div className="mt-0.5 font-semibold">
                        {effectiveExamDate ? formatPtDate(datePart(effectiveExamDate)) : "Sem data"}
                      </div>
                    </div>
                  </div>

                  {timeline.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {timeline.map((item) => (
                        <div
                          key={item.key}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium ${surfaceClassForDaysLeft(item.daysLeft)} ${item.className}`}
                        >
                          <Clock3 className="h-3.5 w-3.5 shrink-0" />
                          <span>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : examDates ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {examDates.examDate && (
                        <span className="rounded-lg border bg-muted/25 px-2.5 py-1.5">
                          Normal: {formatPtDate(examDates.examDate)}{examDates.examPeriod ? ` · ${examDates.examPeriod === "M" ? "10h" : "15h"}` : ""}
                        </span>
                      )}
                      {examDates.resitDate && (
                        <span className="rounded-lg border bg-muted/25 px-2.5 py-1.5">
                          Recurso: {formatPtDate(examDates.resitDate)}{examDates.resitPeriod ? ` · ${examDates.resitPeriod === "M" ? "10h" : "15h"}` : ""}
                        </span>
                      )}
                    </div>
                  ) : null}

                  <div className="mt-4 flex items-center justify-end text-xs font-medium text-primary">
                    Abrir cadeira
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
