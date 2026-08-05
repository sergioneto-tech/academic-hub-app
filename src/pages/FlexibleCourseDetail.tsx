import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";

import CourseEvaluationSettings from "@/components/CourseEvaluationSettings";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PtDateTimeInput } from "@/components/ui/pt-datetime-input";
import { useAppStore } from "@/lib/AppStore";
import {
  courseStatusLabel,
  getRegulationOutcome,
  getResitOutcome,
  resit as getResit,
} from "@/lib/calculations";
import type { CourseSession } from "@/lib/types";
import { formatPtNumber, parsePtNumber } from "@/lib/utils";

function makeSessionId(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function NumberInput({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: number | null;
  placeholder?: string;
  onCommit: (value: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : formatPtNumber(value));

  useEffect(() => {
    setText(value === null ? "" : formatPtNumber(value));
  }, [value]);

  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => onCommit(parsePtNumber(text))}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </div>
  );
}

export default function FlexibleCourseDetail({ courseId }: { courseId: string }) {
  const navigate = useNavigate();
  const {
    state,
    ensureAssessment,
    markCourseCompleted,
    setAssessmentDate,
    setAssessmentGrade,
    setAssessmentMaxPoints,
    updateCourse,
  } = useAppStore();

  const course = useMemo(
    () => state.courses.find((item) => item.id === courseId),
    [state.courses, courseId],
  );
  const outcome = useMemo(
    () => getRegulationOutcome(state, courseId),
    [state, courseId],
  );
  const status = useMemo(
    () => courseStatusLabel(state, courseId),
    [state, courseId],
  );
  const resit = useMemo(
    () => getResit(state, courseId),
    [state, courseId],
  );
  const resitOutcome = useMemo(
    () => getResitOutcome(state, courseId),
    [state, courseId],
  );

  useEffect(() => {
    ensureAssessment(courseId, "resit", "recurso");
  }, [courseId, ensureAssessment]);

  if (!course) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-6">
        <p className="text-sm text-muted-foreground">Cadeira não encontrada.</p>
        <Button className="mt-4" onClick={() => navigate("/cadeiras")}>Voltar</Button>
      </div>
    );
  }

  const sessions = [...(course.sessions ?? [])]
    .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  const sourceIsResit = outcome?.source === "resit";
  const canComplete = outcome?.kind === "passed";
  const needsAnotherAttempt = outcome?.kind === "resit" || outcome?.kind === "failed";

  const completeCourse = () => {
    markCourseCompleted(course.id);
    navigate("/", { replace: true });
  };

  const addSession = () => {
    const date = new Date().toISOString().slice(0, 10);
    const next: CourseSession[] = [
      ...(course.sessions ?? []),
      {
        id: makeSessionId(),
        title: "sessão",
        dateTime: `${date}T21:00`,
      },
    ];
    updateCourse(course.id, { sessions: next });
  };

  const updateSession = (sessionId: string, patch: Partial<CourseSession>) => {
    const next = (course.sessions ?? []).map((session) => (
      session.id === sessionId ? { ...session, ...patch } : session
    ));
    updateCourse(course.id, { sessions: next });
  };

  const removeSession = (sessionId: string) => {
    const next = (course.sessions ?? []).filter((session) => session.id !== sessionId);
    updateCourse(course.id, { sessions: next.length > 0 ? next : undefined });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <header className="premium-surface p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Button variant="ghost" className="-ml-3 mb-2" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted px-2 py-1 font-semibold">{course.code}</span>
              <span className="rounded-md border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold-soft))] px-2 py-1 font-semibold text-[hsl(var(--gold))]">
                Modelo flexível
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold leading-tight tracking-tight">{course.name}</h1>

            <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Label htmlFor="flex-course-year" className="text-xs">Ano</Label>
                <select
                  id="flex-course-year"
                  value={course.year ?? 1}
                  onChange={(event) => updateCourse(course.id, { year: Number(event.target.value) })}
                  className="rounded-lg border bg-background px-2 py-1.5 text-sm"
                >
                  {[1, 2, 3, 4].map((year) => <option key={year} value={year}>{year}º</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="flex-course-semester" className="text-xs">Semestre</Label>
                <select
                  id="flex-course-semester"
                  value={course.semester ?? 1}
                  onChange={(event) => updateCourse(course.id, { semester: Number(event.target.value) })}
                  className="rounded-lg border bg-background px-2 py-1.5 text-sm"
                >
                  {[1, 2].map((semester) => <option key={semester} value={semester}>{semester}º</option>)}
                </select>
              </div>
            </div>
          </div>
          <StatusBadge label={status.label} tone={status.badge} className="shrink-0" />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card className="premium-card">
          <CardContent className="flex min-h-36 flex-col items-center justify-center p-4 text-center">
            <div className="text-xs font-medium text-muted-foreground">Modelo selecionado</div>
            <div className="mt-1 text-lg font-semibold">{outcome?.modelLabel ?? "Por configurar"}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Confirma sempre os critérios no PUC.</p>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardContent className="flex min-h-36 flex-col items-center justify-center p-4 text-center">
            <div className="text-xs font-medium text-muted-foreground">Resultado atual</div>
            <div className="mt-1 text-2xl font-semibold">
              {outcome?.rounded === null || outcome?.rounded === undefined ? "—" : `${outcome.rounded} / 20`}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {sourceIsResit ? "Classificação obtida no recurso." : "Soma dos elementos obrigatórios."}
            </p>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardContent className="flex min-h-36 flex-col items-center justify-center p-4 text-center">
            <div className="text-xs font-medium text-muted-foreground">Próximo passo</div>
            <div className="mt-1 text-lg font-semibold">
              {canComplete
                ? "Concluir cadeira"
                : needsAnotherAttempt
                  ? "Preparar recurso"
                  : outcome?.kind === "incomplete"
                    ? "Corrigir configuração"
                    : "Registar avaliações"}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">O estado atualiza automaticamente.</p>
          </CardContent>
        </Card>
      </section>

      {canComplete && (
        <section className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50 md:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-background/70 p-2">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  Cadeira concluída com sucesso
                  <Sparkles className="h-4 w-4" />
                </div>
                <p className="mt-1 text-sm opacity-80">
                  Parabéns! A classificação final é {outcome?.rounded}/20 valores.
                </p>
              </div>
            </div>
            <Button type="button" onClick={completeCourse}>Concluir cadeira</Button>
          </div>
        </section>
      )}

      <CourseEvaluationSettings courseId={course.id} />

      <Card className="premium-card">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              Sessões
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Aberturas, sessões de acompanhamento, apresentações ou outras datas relevantes.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={addSession}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar sessão
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Sem sessões definidas.
            </div>
          ) : sessions.map((session) => (
            <div key={session.id} className="grid gap-3 rounded-2xl border p-3 sm:grid-cols-[1fr_260px_auto] sm:items-end md:p-4">
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <Input
                  value={session.title}
                  placeholder="sessão de acompanhamento"
                  onChange={(event) => updateSession(session.id, { title: event.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">Data e hora</Label>
                <PtDateTimeInput
                  value={session.dateTime}
                  onChange={(value) => updateSession(session.id, { dateTime: value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeSession(session.id)}
                aria-label={`Remover ${session.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-primary" />
            Recurso
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Usa apenas quando o PUC previr recurso ou substituição da classificação anterior.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!resit ? (
            <p className="text-sm text-muted-foreground">A preparar os campos de recurso…</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Data e hora</Label>
                  <PtDateTimeInput
                    value={resit.date}
                    onChange={(value) => setAssessmentDate(resit.id, { date: value })}
                  />
                </div>
                <NumberInput
                  label="Valor total"
                  value={resit.maxPoints}
                  placeholder="20"
                  onCommit={(value) => {
                    if (value !== null) setAssessmentMaxPoints(resit.id, value);
                  }}
                />
                <NumberInput
                  label="Nota obtida"
                  value={resit.grade}
                  placeholder="0,00"
                  onCommit={(value) => setAssessmentGrade(resit.id, value)}
                />
              </div>

              {resitOutcome && (
                <div className={`rounded-xl border p-4 ${resitOutcome.kind === "passed"
                  ? "border-emerald-300 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/35"
                  : resitOutcome.kind === "failed"
                    ? "border-rose-300 bg-rose-50/90 dark:border-rose-800 dark:bg-rose-950/35"
                    : "border-warning/35 bg-warning/10"}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <GraduationCap className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <div className="font-semibold">
                          {resitOutcome.kind === "passed" ? "Aprovado no recurso" : resitOutcome.kind === "failed" ? "Resultado insuficiente" : "Confirma os dados"}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Resultado: {resitOutcome.rounded}/20 valores.
                        </p>
                        {resitOutcome.issues.length > 0 && (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {resitOutcome.issues.map((issue) => <li key={issue}>{issue}</li>)}
                          </ul>
                        )}
                      </div>
                    </div>
                    {resitOutcome.kind === "passed" && (
                      <Button type="button" onClick={completeCourse}>Concluir cadeira</Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
