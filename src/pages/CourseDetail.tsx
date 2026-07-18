import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, GraduationCap, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";

import { useAppStore } from "@/lib/AppStore";
import {
  type AssessmentOutcome,
  courseStatusLabel,
  exam as getExam,
  finalGradeRaw,
  finalGradeRounded,
  getAssessments,
  getExamOutcome,
  getResitOutcome,
  getRules,
  needsResit,
  resit as getResit,
  totalEFolios,
  totalEFoliosMax,
} from "@/lib/calculations";
import { formatPtNumber, parsePtNumber } from "@/lib/utils";
import { formatPtDate, formatPtDateTime } from "@/lib/date";
import { PtDateInput } from "@/components/ui/pt-date-input";
import { PtDateTimeInput } from "@/components/ui/pt-datetime-input";

function DateField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <PtDateInput value={value} onChange={onChange} />
    </div>
  );
}

function DateTimeField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <PtDateTimeInput value={value} onChange={onChange} />
    </div>
  );
}

type ResultCardProps = {
  outcome: AssessmentOutcome;
  courseName: string;
  breakdown: string;
  onComplete: () => void;
  onReview: () => void;
  onGoToResit?: () => void;
};

function FinalResultCard({
  outcome,
  courseName,
  breakdown,
  onComplete,
  onReview,
  onGoToResit,
}: ResultCardProps) {
  const isPassed = outcome.kind === "passed";
  const isIncomplete = outcome.kind === "incomplete";
  const needsAnotherAttempt = outcome.kind === "resit";
  const isFailed = outcome.kind === "failed";

  const toneClass = isPassed
    ? "border-emerald-300 bg-emerald-50/90 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50"
    : isIncomplete
      ? "border-amber-300 bg-amber-50/90 text-amber-950 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50"
      : needsAnotherAttempt
        ? "border-sky-300 bg-sky-50/90 text-sky-950 dark:border-sky-800 dark:bg-sky-950/35 dark:text-sky-50"
        : "border-rose-300 bg-rose-50/90 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50";

  const Icon = isPassed
    ? CheckCircle2
    : isIncomplete || isFailed
      ? AlertTriangle
      : needsAnotherAttempt
        ? RotateCcw
        : GraduationCap;

  const title = isPassed
    ? "Cadeira concluída com sucesso"
    : isIncomplete
      ? "Confirma os dados da avaliação"
      : needsAnotherAttempt
        ? "Ainda não foi desta — prepara o recurso"
        : "O recurso não permitiu concluir a cadeira";

  const description = isPassed
    ? `Parabéns! Concluíste ${courseName}. Confirma agora a conclusão da cadeira.`
    : isIncomplete
      ? "O resultado ainda não pode ser considerado definitivo porque existem dados por preencher ou valores por corrigir."
      : needsAnotherAttempt
        ? "O resultado atual ainda não permite concluir a cadeira, mas o recurso dá-te uma nova oportunidade."
        : "Este resultado ainda não permite concluir a cadeira. Revê as classificações e os critérios indicados no PUC.";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border p-4 shadow-sm md:p-5 ${toneClass}`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-background/70 p-2">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold leading-tight">{title}</h3>
              {isPassed && <Sparkles className="h-4 w-4" aria-hidden="true" />}
            </div>
            <p className="mt-1 text-sm opacity-85">{description}</p>
          </div>

          <div className="rounded-lg border border-current/15 bg-background/60 p-3">
            <div className="text-xs font-medium uppercase tracking-wide opacity-70">
              {isIncomplete ? "Resultado atual" : "Nota final"}
            </div>
            <div className="mt-1 text-3xl font-bold">
              {outcome.rounded} <span className="text-base font-medium opacity-70">/ 20 valores</span>
            </div>
            <p className="mt-1 text-xs opacity-75">{breakdown}</p>
          </div>

          {outcome.issues.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {outcome.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            {isPassed && (
              <Button type="button" onClick={onComplete}>
                Concluir cadeira
              </Button>
            )}
            {needsAnotherAttempt && onGoToResit && (
              <Button type="button" onClick={onGoToResit}>
                Registar nota de recurso
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onReview}>
              Rever classificações
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PtNumberInput({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: number | null;
  placeholder?: string;
  onCommit: (v: number | null) => void;
}) {
  const [txt, setTxt] = useState<string>("");

  useEffect(() => {
    setTxt(value === null ? "" : formatPtNumber(value));
  }, [value]);

  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        inputMode="decimal"
        placeholder={placeholder}
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => onCommit(parsePtNumber(txt))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </div>
  );
}

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const efoliosSectionRef = useRef<HTMLDivElement>(null);
  const resitSectionRef = useRef<HTMLDivElement>(null);
  const { state, addEFolio, ensureAssessment, removeAssessment, setAssessmentDate, setAssessmentGrade, setAssessmentMaxPoints, markCourseCompleted, updateCourse } = useAppStore();

  const course = useMemo(() => state.courses.find((c) => c.id === id), [state.courses, id]);
  const rules = useMemo(() => (id ? getRules(state, id) : null), [state, id]);

  // garantir itens padrão (para não ficar vazio)
  useEffect(() => {
    if (!id) return;
    ensureAssessment(id, "efolio", "e-fólio A");
    ensureAssessment(id, "efolio", "e-fólio B");
    ensureAssessment(id, "exam", "g-fólio");
    ensureAssessment(id, "resit", "recurso");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const efolios = useMemo(() => (id ? getAssessments(state, id, "efolio") : []), [state, id]);
  const exam = useMemo(() => (id ? getExam(state, id) : null), [state, id]);
  const resit = useMemo(() => (id ? getResit(state, id) : null), [state, id]);

  const efTotal = useMemo(() => (id ? totalEFolios(state, id) : 0), [state, id]);
  const efMax = useMemo(() => (id ? totalEFoliosMax(state, id) : 0), [state, id]);
  const configuredAssessmentMax = efMax + (exam?.maxPoints ?? 0);
  const assessmentScaleIsValid = Math.abs(configuredAssessmentMax - 20) < 0.001;

  const finRaw = useMemo(() => (id ? finalGradeRaw(state, id) : null), [state, id]);
  const finRounded = useMemo(() => (id ? finalGradeRounded(state, id) : null), [state, id]);

  const status = useMemo(() => (id ? courseStatusLabel(state, id) : { label: "—", badge: "neutral" as const }), [state, id]);
  const showResit = useMemo(() => (id ? needsResit(state, id) : false), [state, id]);
  const examOutcome = useMemo(() => (id ? getExamOutcome(state, id) : null), [state, id]);
  const resitOutcome = useMemo(() => (id ? getResitOutcome(state, id) : null), [state, id]);

  // Sessões (ex.: abertura, antes de e‑fólios, antes de exame)
  const sessions = useMemo(() => course?.sessions ?? [], [course?.sessions]);
  const sessionsSorted = useMemo(
    () => [...sessions].sort((a, b) => String(a.dateTime).localeCompare(String(b.dateTime))),
    [sessions],
  );

  if (!course || !id || !rules) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Cadeira não encontrada.</p>
        <Button className="mt-4" onClick={() => navigate("/cadeiras")}>Voltar</Button>
      </div>
    );
  }

  const badgeClass =
    status.badge === "success"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : status.badge === "warning"
      ? "bg-sky-100 text-sky-900 border-sky-200"
      : status.badge === "danger"
      ? "bg-rose-100 text-rose-900 border-rose-200"
      : "bg-slate-100 text-slate-900 border-slate-200";


  function completeCourse() {
    markCourseCompleted(course.id);
    navigate("/", { replace: true });
  }

  function scrollTo(ref: RefObject<HTMLDivElement>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function makeSessionId(): string {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function addSession() {
    const ymd = new Date().toISOString().slice(0, 10);
    const next = [
      ...sessions,
      { id: makeSessionId(), title: "sessão", dateTime: `${ymd}T21:00` },
    ];
    updateCourse(course.id, { sessions: next });
  }

  function updateSession(sessionId: string, patch: Partial<{ title: string; dateTime: string }>) {
    const next = sessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s));
    updateCourse(course.id, { sessions: next });
  }

  function removeSession(sessionId: string) {
    const next = sessions.filter((s) => s.id !== sessionId);
    updateCourse(course.id, { sessions: next.length ? next : undefined });
  }

  function formatSessionLine(dateTime: string, title: string) {
    const dateTimeLabel = formatPtDateTime(dateTime);
    return `${dateTimeLabel} - ${title}`;
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Button variant="ghost" className="-ml-2 mb-2" onClick={() => navigate(-1)}>
            ← Voltar
          </Button>
          <h1 className="text-xl md:text-2xl font-semibold leading-tight">
            {course.code} — {course.name}
          </h1>
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Label htmlFor="course-year" className="text-xs">Ano:</Label>
              <select
                id="course-year"
                value={course.year ?? 1}
                onChange={(e) => updateCourse(course.id, { year: Number(e.target.value) })}
                className="rounded border bg-background px-2 py-1 text-sm"
              >
                {[1, 2, 3, 4].map((y) => (
                  <option key={y} value={y}>{y}º</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="course-semester" className="text-xs">Semestre:</Label>
              <select
                id="course-semester"
                value={course.semester ?? 1}
                onChange={(e) => updateCourse(course.id, { semester: Number(e.target.value) })}
                className="rounded border bg-background px-2 py-1 text-sm"
              >
                {[1, 2].map((s) => (
                  <option key={s} value={s}>{s}º</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${badgeClass}`}>
          {status.label}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">E‑fólios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">
              {formatPtNumber(efTotal)} <span className="text-sm text-muted-foreground">/ {formatPtNumber(efMax)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo para exame: {formatPtNumber(rules.minAptoExame)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Exame</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">
              {formatPtNumber(exam?.grade ?? null) || "—"}{" "}
              <span className="text-sm text-muted-foreground">/ {formatPtNumber(exam?.maxPoints ?? 12)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo no exame: {formatPtNumber(rules.minExame)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Nota final</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">
              {finRounded === null ? "—" : String(finRounded)}{" "}
              <span className="text-sm text-muted-foreground">/ 20</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Cálculo: {finRaw === null ? "—" : `${formatPtNumber(finRaw)} → arredonda para ${finRounded}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card ref={efoliosSectionRef} className="scroll-mt-4 bg-card/80 backdrop-blur">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>E‑fólios</CardTitle>
            <p className="text-xs text-muted-foreground">
              Podes adicionar os e‑fólios necessários para esta cadeira. Define sempre o valor real indicado no PUC.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => addEFolio(course.id)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar e‑fólio
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!assessmentScaleIsValid && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              A avaliação configurada soma {formatPtNumber(configuredAssessmentMax)} pontos. Ajusta os valores dos e‑fólios e do g‑fólio para totalizarem 20 pontos.
            </div>
          )}

          {efolios.map((a) => (
            <div key={a.id} className="rounded-lg border p-3 md:p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="flex min-w-0 items-start justify-between gap-3 md:block">
                  <div className="min-w-0">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.endDate ? `Até ${formatPtDate(a.endDate)}` : "Defina as datas para lembretes/planeamento."}
                    </div>
                  </div>
                  {!["e-fólio A", "e-fólio B"].includes(a.name) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive md:hidden"
                      aria-label={`Remover ${a.name}`}
                      onClick={() => {
                        if (window.confirm(`Remover ${a.name}? As respetivas datas e nota serão eliminadas.`)) {
                          removeAssessment(a.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 md:flex md:gap-3 md:items-end">
                  <PtNumberInput
                    label="Valor (pts)"
                    value={a.maxPoints}
                    placeholder="4"
                    onCommit={(v) => {
                      if (v === null) return;
                      setAssessmentMaxPoints(a.id, v);
                    }}
                  />
                  <PtNumberInput
                    label="Nota"
                    value={a.grade}
                    placeholder="0,00"
                    onCommit={(v) => setAssessmentGrade(a.id, v)}
                  />
                  {!["e-fólio A", "e-fólio B"].includes(a.name) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="hidden shrink-0 text-muted-foreground hover:text-destructive md:inline-flex"
                      aria-label={`Remover ${a.name}`}
                      onClick={() => {
                        if (window.confirm(`Remover ${a.name}? As respetivas datas e nota serão eliminadas.`)) {
                          removeAssessment(a.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {a.maxPoints <= 0 && (
                <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
                  Define o valor deste e‑fólio para que a nota seja incluída nos totais.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <DateField
                  label="Início"
                  value={a.startDate}
                  onChange={(v) => setAssessmentDate(a.id, { startDate: v })}
                />
                <DateField
                  label="Fim"
                  value={a.endDate}
                  onChange={(v) => setAssessmentDate(a.id, { endDate: v })}
                />
                <DateField
                  label="Nota (publicação)"
                  value={a.gradeReleaseDate}
                  onChange={(v) => setAssessmentDate(a.id, { gradeReleaseDate: v })}
                />
              </div>
            </div>
          ))}
        </CardContent>
      
</Card>

      <Card className="bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle>Sessões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Adiciona sessões típicas do Moodle (abertura, antes dos e‑fólios e antes do exame). Serão incluídas no Calendário e na exportação (.ics).
          </p>

          <div className="space-y-3">
            {sessionsSorted.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem sessões definidas.</div>
            ) : (
              sessionsSorted.map((s) => (
                <div key={s.id} className="rounded-lg border p-3 md:p-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_260px_auto] sm:items-end">
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">Descrição</Label>
                      <Input
                        value={s.title}
                        placeholder="sessão de abertura"
                        onChange={(e) => updateSession(s.id, { title: e.target.value })}
                      />
                    </div>

                    <DateTimeField
                      label="Data/hora"
                      value={s.dateTime}
                      onChange={(v) => updateSession(s.id, { dateTime: v })}
                    />

                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => removeSession(s.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={addSession}>Adicionar sessão</Button>
          </div>

          {sessionsSorted.length > 0 && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs font-medium mb-2">Lista de sessões:</div>
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                {sessionsSorted.map((s) => (
                  <li key={s.id}>{formatSessionLine(s.dateTime, s.title)}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle>g‑Fólio (Exame)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!exam ? (
            <p className="text-sm text-muted-foreground">A criar exame…</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <DateTimeField
                label="Exame (data e hora de início)"
                value={exam.date}
                onChange={(v) => setAssessmentDate(exam.id, { date: v })}
              />

              <PtNumberInput
                label="Valor total (pts)"
                value={exam.maxPoints}
                placeholder="12"
                onCommit={(v) => {
                  if (v === null) return;
                  setAssessmentMaxPoints(exam.id, v);
                }}
              />

              <PtNumberInput
                label="Nota obtida"
                value={exam.grade}
                placeholder="0,00"
                onCommit={(v) => setAssessmentGrade(exam.id, v)}
              />
            </div>
          )}

          {examOutcome && (
            <FinalResultCard
              outcome={examOutcome}
              courseName={course.name}
              breakdown={`E‑fólios: ${formatPtNumber(efTotal)} + exame: ${formatPtNumber(exam?.grade ?? 0)} = ${formatPtNumber(examOutcome.raw)}`}
              onComplete={completeCourse}
              onReview={() => scrollTo(efoliosSectionRef)}
              onGoToResit={() => scrollTo(resitSectionRef)}
            />
          )}
        </CardContent>
      </Card>

      <Card ref={resitSectionRef} className="scroll-mt-4 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle>Recurso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {showResit
              ? "Disponível porque a avaliação atual ainda não permite concluir a cadeira."
              : "Preenche apenas se precisares de realizar recurso ou de substituir a classificação anterior."}
          </p>

          {!resit ? (
            <p className="text-sm text-muted-foreground">A criar recurso…</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <DateTimeField
                  label="Recurso (data e hora de início)"
                  value={resit.date}
                  onChange={(v) => setAssessmentDate(resit.id, { date: v })}
                />

                <PtNumberInput
                  label="Valor total (pts)"
                  value={resit.maxPoints}
                  placeholder="20"
                  onCommit={(v) => {
                    if (v === null) return;
                    setAssessmentMaxPoints(resit.id, v);
                  }}
                />

                <PtNumberInput
                  label="Nota obtida"
                  value={resit.grade}
                  placeholder="0,00"
                  onCommit={(v) => setAssessmentGrade(resit.id, v)}
                />
              </div>

              {resitOutcome && (
                <FinalResultCard
                  outcome={resitOutcome}
                  courseName={course.name}
                  breakdown={`Recurso: ${formatPtNumber(resitOutcome.raw)} → arredonda para ${resitOutcome.rounded}`}
                  onComplete={completeCourse}
                  onReview={() => scrollTo(efoliosSectionRef)}
                />
              )}

              {!showResit && !resitOutcome && (
                <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-950/30 dark:text-slate-200">
                  Neste momento, o recurso não é necessário. Podes deixar estes campos vazios.
                </div>
              )}
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
