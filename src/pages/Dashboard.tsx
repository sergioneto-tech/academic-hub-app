import { useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  GraduationCap,
  LayoutGrid,
  LockKeyhole,
  RefreshCw,
  Settings,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import DeadlineAlerts, { useDeadlineToasts } from "@/components/DeadlineAlerts";
import { ProfileAvatar } from "@/components/ProfileAvatarEditor";
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
import { getCourseRequirementStatuses } from "@/lib/courseRequirements";
import { formatPtDateTime } from "@/lib/date";
import { getDegreeAccent } from "@/lib/degreeTheme";
import { useUpdate } from "@/lib/UpdateProvider";
import { getCourseArea, getPlanCoursesForDegree } from "@/lib/uabPlan";
import { getExamDates } from "@/lib/uabExamDates";
import { formatPtNumber } from "@/lib/utils";

const UPDATE_DEFER_KEY = "academicHub:updateDeferred";

type TimelineItem = { key: string; className: string; text: string; daysLeft: number };
type Metric = { label: string; value: string | number; detail: string; icon: typeof LayoutGrid };

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function datePart(v: string) {
  return v.slice(0, 10);
}

function daysLeftFromToday(v: string) {
  if (!v) return null;
  const target = parseYmd(v.includes("T") ? datePart(v) : v);
  return target
    ? Math.round((startOfDay(target).getTime() - startOfDay(new Date()).getTime()) / 86400000)
    : null;
}

function textClassForDaysLeft(days: number) {
  return days === 0
    ? "text-destructive"
    : days <= 5 && days >= 1
      ? "text-warning"
      : days > 5
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-muted-foreground";
}

function surfaceClassForDaysLeft(days: number) {
  return days === 0
    ? "border-destructive/30 bg-destructive/10"
    : days <= 5 && days >= 1
      ? "border-warning/35 bg-warning/10"
      : "border-border/70 bg-muted/35";
}

function formatDaysLeft(days: number) {
  return days === 0 ? "hoje" : days === 1 ? "1 dia" : `${days} dias`;
}

function wasUpdateDeferred() {
  try {
    return Boolean(localStorage.getItem(UPDATE_DEFER_KEY));
  } catch {
    return false;
  }
}

function progressPercent(completed: number, total: number) {
  return total <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
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
  const requirementStatuses = useMemo(() => getCourseRequirementStatuses(state).filter((item) => !item.completed), [state]);
  useDeadlineToasts(state);

  const activeCourses = useMemo(
    () => state.courses
      .filter((course) => course.isActive && !course.isCompleted)
      .sort((a, b) => a.code.localeCompare(b.code, "pt-PT")),
    [state.courses],
  );

  const metrics: Metric[] = [
    { label: "Cadeiras ativas", value: stats.active, detail: stats.active === 1 ? "cadeira em frequência" : "cadeiras em frequência", icon: BookOpen },
    { label: "Concluídas", value: stats.completed, detail: stats.completed === 1 ? "cadeira terminada" : "cadeiras terminadas", icon: CheckCircle2 },
    { label: "Média atual", value: stats.completed ? formatPtNumber(stats.avg) : "—", detail: stats.completed ? "nas cadeiras concluídas" : "sem classificações finais", icon: TrendingUp },
    { label: "Eventos", value: stats.eventsCount, detail: "datas académicas registadas", icon: CalendarDays },
  ];

  const downloadBackup = () => {
    const blob = new Blob([exportData()], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `academic-hub-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  return (
    <div className="space-y-6">
      <section className="premium-surface relative overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: accent.color }} />
        <div className="relative grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-7">
          <div className="min-w-0 pr-24 sm:pr-28 md:pr-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[hsl(var(--gold))]"><Sparkles className="h-4 w-4" />Resumo académico</div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Olá, {displayName}</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Acompanha as cadeiras em frequência, os próximos prazos e a evolução da tua licenciatura num único espaço.</p>
            <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent.color }} />
              <span className="truncate font-medium">{state.degree?.name || "Licenciatura ainda não selecionada"}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <div className="absolute right-5 top-5 md:static"><ProfileAvatar className="h-20 w-20 text-lg sm:h-24 sm:w-24 md:h-20 md:w-20" /></div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button asChild><Link to="/cadeiras"><BookOpen className="mr-2 h-4 w-4" />Gerir cadeiras</Link></Button>
              <Button asChild variant="outline"><Link to="/calendario"><CalendarDays className="mr-2 h-4 w-4" />Ver calendário</Link></Button>
            </div>
          </div>
        </div>
      </section>

      {!state.degree && (
        <section className="premium-surface border-warning/35 bg-warning/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="font-semibold">Falta escolher a licenciatura</div><p className="mt-1 text-sm text-muted-foreground">Seleciona o curso nas Definições para carregar o plano de estudos e calcular o progresso.</p></div>
            <Button asChild size="sm" className="shrink-0"><Link to="/definicoes"><Settings className="mr-2 h-4 w-4" />Ir para Definições</Link></Button>
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className="premium-card">
              <CardContent className="dashboard-metric-card flex min-h-36 flex-col items-center justify-center gap-2 p-4 text-center">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                <div className="text-xs font-medium text-muted-foreground">{metric.label}</div>
                <div className="text-2xl font-semibold">{metric.value}</div>
                <div className="text-[11px] text-muted-foreground">{metric.detail}</div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="premium-surface p-4 md:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[hsl(var(--gold-soft))] text-[hsl(var(--gold))]"><GraduationCap className="h-5 w-5" /></div>
            <div><div className="text-sm font-semibold">Progresso da licenciatura</div><div className="text-xs text-muted-foreground">{ectsTotal > 0 ? `${ectsCompleted} de ${ectsTotal} ECTS concluídos` : "O progresso ficará disponível após escolheres a licenciatura."}</div></div>
          </div>
          <div className="text-2xl font-semibold text-[hsl(var(--gold))]">{ectsTotal > 0 ? `${ectsProgress}%` : "—"}</div>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${ectsProgress}%`, backgroundColor: accent.color }} /></div>
        <div className="mt-3 flex justify-end"><Button asChild variant="ghost" size="sm"><Link to="/plano">Consultar plano de estudos<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
      </section>

      {requirementStatuses.map((requirement) => (
        <Card key={requirement.courseCode} className={requirement.eligible ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}>
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 gap-2.5">
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${requirement.eligible ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
                  {requirement.eligible ? <CheckCircle2 className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pré-requisitos · {requirement.courseCode}</div>
                  <h2 className="mt-0.5 text-base font-semibold leading-tight">{requirement.courseName}</h2>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{requirement.eligible ? "Critérios académicos registados cumpridos. UC elegível para inscrição." : "Ainda não cumpres todos os critérios académicos indicados pela UAb."}</p>
                </div>
              </div>
              <Button asChild size="sm" variant={requirement.eligible ? "default" : "outline"} className="h-8 shrink-0 px-3 text-xs"><a href={requirement.sourceUrl} target="_blank" rel="noreferrer">Consultar UAb<ExternalLink className="ml-1.5 h-3 w-3" /></a></Button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {requirement.requirements.map((item) => (
                <div key={item.id} className="rounded-lg border bg-background/60 px-3 py-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.met ? "text-emerald-600" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium leading-snug">{item.label}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{item.detail}</div>
                      {item.missingCourses && item.missingCourses.length > 0 && <div className="mt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-400">Em falta: {item.missingCourses.map((course) => `${course.code} ${course.name}`).join(" · ")}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {requirement.note && <p className="mt-2 text-[10px] leading-snug text-muted-foreground">Nota: {requirement.note}</p>}
          </CardContent>
        </Card>
      ))}

      <DeadlineAlerts state={state} />

      {updateAvailable && wasUpdateDeferred() && (
        <Card>
          <CardContent className="flex flex-wrap gap-2 p-4">
            <Button variant="outline" onClick={downloadBackup}><Download className="mr-2 h-4 w-4" />Backup</Button>
            <Button onClick={() => void applyUpdate()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div><h2 className="text-lg font-semibold">Cadeiras ativas</h2><p className="text-xs text-muted-foreground">Notas, estados e acontecimentos mais próximos.</p></div>
          <Button variant="ghost" size="sm" asChild><Link to="/cadeiras">Ver todas<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>

        {activeCourses.length === 0 ? (
          <Card className="premium-card">
            <CardContent className="flex flex-col items-center py-9 text-center">
              <BookOpen className="h-6 w-6" />
              <div className="mt-3 font-medium">Nenhuma cadeira ativa</div>
              <p className="mt-1 text-sm text-muted-foreground">Ativa as cadeiras que estás a frequentar para acompanhares notas, datas e progresso no painel.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {activeCourses.map((course) => {
              const status = courseStatusLabel(state, course.id);
              const allAssessments = getAssessments(state, course.id);
              const continuousAssessments = course.evaluationRegime === "regulation-2026"
                ? allAssessments.filter((assessment) => (
                    assessment.required !== false
                    && assessment.type !== "exam"
                    && assessment.type !== "resit"
                    && assessment.type !== "special"
                  ))
                : getAssessments(state, course.id, "efolio");
              const continuousGrade = course.evaluationRegime === "regulation-2026"
                ? continuousAssessments.reduce((sum, assessment) => sum + (assessment.grade ?? 0), 0)
                : totalEFolios(state, course.id);
              const continuousMaximum = course.evaluationRegime === "regulation-2026"
                ? continuousAssessments.reduce((sum, assessment) => sum + Math.max(0, Number(assessment.maxPoints) || 0), 0)
                : totalEFoliosMax(state, course.id);
              const examAssessment = exam(state, course.id);
              const resitAssessment = resit(state, course.id);
              const planCourse = planCourses.find((item) => item.code === course.code);
              const examDates = getExamDates(course.code, planCourse?.semester);
              const effectiveExamDate = examAssessment?.date || examDates?.examDate || null;
              const effectiveResitDate = resitAssessment?.date || examDates?.resitDate || null;

              const assessmentTimeline: TimelineItem[] = allAssessments
                .filter((assessment) => assessment.type !== "exam" && assessment.type !== "resit" && assessment.type !== "special")
                .filter((assessment) => assessment.startDate || assessment.endDate || assessment.gradeReleaseDate || assessment.date)
                .map((assessment) => {
                  if (assessment.date) {
                    const days = daysLeftFromToday(assessment.date);
                    if (days !== null && days >= 0) {
                      return {
                        key: `${assessment.id}-date`,
                        className: textClassForDaysLeft(days),
                        text: days === 0 ? `${assessment.name} hoje` : `${assessment.name} em ${formatDaysLeft(days)}`,
                        daysLeft: days,
                      };
                    }
                  }

                  const start = assessment.startDate ? parseYmd(assessment.startDate) : null;
                  const end = assessment.endDate ? parseYmd(assessment.endDate) : null;
                  const gradeRelease = assessment.gradeReleaseDate ? parseYmd(assessment.gradeReleaseDate) : null;

                  if (start && today < startOfDay(start)) {
                    const days = Math.round((startOfDay(start).getTime() - today.getTime()) / 86400000);
                    return { key: `${assessment.id}-start`, className: textClassForDaysLeft(days), text: `${assessment.name} começa em ${formatDaysLeft(days)}`, daysLeft: days };
                  }
                  if (end && today <= startOfDay(end) && (!start || today >= startOfDay(start))) {
                    const days = Math.round((startOfDay(end).getTime() - today.getTime()) / 86400000);
                    return { key: `${assessment.id}-end`, className: textClassForDaysLeft(days), text: `${assessment.name} termina em ${formatDaysLeft(days)}`, daysLeft: days };
                  }
                  if (gradeRelease && today <= startOfDay(gradeRelease) && (!end || today > startOfDay(end))) {
                    const days = Math.round((startOfDay(gradeRelease).getTime() - today.getTime()) / 86400000);
                    return { key: `${assessment.id}-grade`, className: textClassForDaysLeft(days), text: `Nota de ${assessment.name} em ${formatDaysLeft(days)}`, daysLeft: days };
                  }
                  return null;
                })
                .filter((item): item is TimelineItem => item !== null);

              const examDays = effectiveExamDate ? daysLeftFromToday(effectiveExamDate) : null;
              const resitDays = status.label === "Recurso" && effectiveResitDate ? daysLeftFromToday(effectiveResitDate) : null;
              const timeline = [
                examDays !== null && examDays >= 0
                  ? { key: `${course.id}-exam`, className: textClassForDaysLeft(examDays), text: examDays === 0 ? "Exame hoje" : `Exame em ${formatDaysLeft(examDays)}`, daysLeft: examDays }
                  : null,
                resitDays !== null && resitDays >= 0
                  ? { key: `${course.id}-resit`, className: textClassForDaysLeft(resitDays), text: resitDays === 0 ? "Recurso hoje" : `Recurso em ${formatDaysLeft(resitDays)}`, daysLeft: resitDays }
                  : null,
                ...assessmentTimeline,
              ]
                .filter((item): item is TimelineItem => item !== null)
                .sort((a, b) => a.daysLeft - b.daysLeft)
                .slice(0, 3);
              const area = getCourseArea(planCourses, course.code);

              return (
                <Link key={course.id} to={`/cadeiras/${course.id}`} className="premium-card group block p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px]">{course.code}</span>
                      <h3 className="mt-2 font-semibold">{course.name}</h3>
                      {area && <div className="mt-1 text-xs text-muted-foreground">{area}</div>}
                    </div>
                    <StatusBadge label={status.label} tone={status.badge} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border bg-muted/25 p-3 text-xs">
                    <div><div className="text-muted-foreground">Avaliação contínua</div><b>{formatPtNumber(continuousGrade)} / {formatPtNumber(continuousMaximum)}</b></div>
                    <div><div className="text-muted-foreground">Exame</div><b>{effectiveExamDate ? formatPtDateTime(effectiveExamDate) : "Sem data"}</b></div>
                  </div>
                  {timeline.map((item) => (
                    <div key={item.key} className={`mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${surfaceClassForDaysLeft(item.daysLeft)} ${item.className}`}>
                      <Clock3 className="h-3.5 w-3.5" />{item.text}
                    </div>
                  ))}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
