import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Plus,
  Scale,
  Trash2,
} from "lucide-react";

import { PtDateInput } from "@/components/ui/pt-date-input";
import { PtDateTimeInput } from "@/components/ui/pt-datetime-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/AppStore";
import { getAssessments, getRegulationOutcome } from "@/lib/calculations";
import type {
  Assessment,
  AssessmentMode,
  AssessmentType,
  EvaluationModel,
  EvaluationRegime,
} from "@/lib/types";
import { formatPtNumber, parsePtNumber } from "@/lib/utils";

const MODEL_OPTIONS: Array<{
  value: EvaluationModel;
  label: string;
  description: string;
}> = [
  {
    value: "type1",
    label: "Modelo 1",
    description: "Componentes assíncrona e síncrona, com mínimos em ambas.",
  },
  {
    value: "type2",
    label: "Modelo 2",
    description: "Atividades obrigatórias e verificação da regra N−1.",
  },
  {
    value: "type3",
    label: "Modelo 3",
    description: "Atividades obrigatórias e verificação da regra N−1.",
  },
  {
    value: "type4",
    label: "Modelo 4",
    description: "Componentes assíncrona e síncrona, com mínimos em ambas.",
  },
  {
    value: "exam-only",
    label: "Avaliação final",
    description: "Classificação obtida exclusivamente numa prova final de 20 valores.",
  },
  {
    value: "custom",
    label: "Personalizado",
    description: "Elementos obrigatórios configurados manualmente, totalizando 20 valores.",
  },
];

const TYPE_OPTIONS: Array<{ value: AssessmentType; label: string }> = [
  { value: "efolio", label: "e-fólio" },
  { value: "activity", label: "Atividade" },
  { value: "project", label: "Projeto" },
  { value: "presentation", label: "Apresentação" },
  { value: "discussion", label: "Discussão" },
  { value: "exam", label: "Prova / exame" },
  { value: "other", label: "Outro" },
];

function isTimedAssessment(type: AssessmentType): boolean {
  return type === "exam" || type === "presentation" || type === "discussion";
}

function totalMaximum(assessments: Assessment[]): number {
  return assessments
    .filter((assessment) => assessment.required !== false)
    .reduce((total, assessment) => total + Math.max(0, Number(assessment.maxPoints) || 0), 0);
}

function NumberEditor({
  value,
  label,
  placeholder,
  onCommit,
}: {
  value: number | null;
  label: string;
  placeholder?: string;
  onCommit: (value: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : formatPtNumber(value));

  return (
    <div className="grid gap-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onFocus={() => setText(value === null ? "" : formatPtNumber(value))}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const parsed = parsePtNumber(text);
          onCommit(parsed);
          setText(parsed === null ? "" : formatPtNumber(parsed));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </div>
  );
}

export default function CourseEvaluationSettings({ courseId }: { courseId: string }) {
  const {
    state,
    updateCourse,
    updateAssessment,
    addAssessment,
    removeAssessment,
  } = useAppStore();
  const course = state.courses.find((item) => item.id === courseId);
  const assessments = useMemo(
    () => getAssessments(state, courseId).filter((assessment) => assessment.type !== "resit"),
    [state, courseId],
  );
  const outcome = useMemo(() => getRegulationOutcome(state, courseId), [state, courseId]);

  if (!course) return null;

  const regime: EvaluationRegime = course.evaluationRegime ?? "legacy";
  const model: EvaluationModel = course.evaluationModel ?? "custom";
  const requiredMaximum = totalMaximum(assessments);

  const setRegime = (next: EvaluationRegime) => {
    updateCourse(courseId, {
      evaluationRegime: next,
      evaluationModel: course.evaluationModel ?? "custom",
    });
  };

  const setModel = (next: EvaluationModel) => {
    updateCourse(courseId, { evaluationRegime: "regulation-2026", evaluationModel: next });

    if (next !== "exam-only") return;
    const existingExam = assessments.find((assessment) => assessment.type === "exam");
    if (existingExam) {
      updateAssessment(existingExam.id, {
        maxPoints: 20,
        mode: "synchronous",
        required: true,
      });
      return;
    }

    addAssessment(courseId, {
      type: "exam",
      name: "Prova final",
      maxPoints: 20,
      grade: null,
      mode: "synchronous",
      required: true,
    });
  };

  const addElement = () => {
    const splitModel = model === "type1" || model === "type4";
    addAssessment(courseId, {
      type: "activity",
      name: `Atividade ${assessments.length + 1}`,
      maxPoints: 0,
      grade: null,
      mode: splitModel ? "asynchronous" : "asynchronous",
      required: true,
    });
  };

  return (
    <Card className="premium-card">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[hsl(var(--gold))]" />
            Modelo de avaliação
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            A escolha é feita por cadeira. Alterar o regime não elimina notas, datas ou elementos existentes.
          </p>
        </div>
        <div className="rounded-full border bg-muted/35 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          {regime === "legacy" ? "Regime anterior" : "Regulamento 2026"}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Regime aplicável</Label>
            <Select value={regime} onValueChange={(value) => setRegime(value as EvaluationRegime)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="legacy">Regime anterior — e-fólios + g-fólio</SelectItem>
                <SelectItem value="regulation-2026">Regulamento de avaliação 2026</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Modelo</Label>
            <Select
              value={model}
              disabled={regime !== "regulation-2026"}
              onValueChange={(value) => setModel(value as EvaluationModel)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleciona o modelo" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {regime === "legacy"
                ? "O cálculo atual permanece exatamente como estava."
                : MODEL_OPTIONS.find((option) => option.value === model)?.description}
            </p>
          </div>
        </div>

        {regime === "regulation-2026" && (
          <>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="rounded-xl border bg-muted/25 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">Escala configurada</span>
                  <span className={requiredMaximum === 20 ? "text-emerald-700 dark:text-emerald-400" : "text-warning"}>
                    {formatPtNumber(requiredMaximum)} / 20 valores
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Apenas os elementos marcados como obrigatórios entram no cálculo principal.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={addElement} disabled={model === "exam-only"}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar elemento
              </Button>
            </div>

            <div className="space-y-3">
              {assessments.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Ainda não existem elementos de avaliação configurados.
                </div>
              ) : assessments.map((assessment) => (
                <AssessmentEditor
                  key={assessment.id}
                  assessment={assessment}
                  model={model}
                  onChange={(patch) => updateAssessment(assessment.id, patch)}
                  onRemove={() => {
                    if (window.confirm(`Remover ${assessment.name}? As datas e a classificação também serão eliminadas.`)) {
                      removeAssessment(assessment.id);
                    }
                  }}
                />
              ))}
            </div>

            {outcome && (
              <div className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">Verificação do modelo</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {outcome.modelLabel}{outcome.rounded === null ? "" : ` · resultado atual ${outcome.rounded}/20`}
                    </div>
                  </div>
                  <OutcomeBadge kind={outcome.kind} />
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {outcome.requirements.map((entry) => (
                    <div key={entry.key} className="flex gap-2 rounded-xl border bg-card p-3">
                      {entry.met
                        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0">
                        <div className="text-xs font-medium">{entry.label}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{entry.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {outcome.issues.length > 0 && (
                  <div className="mt-3 rounded-xl border border-warning/35 bg-warning/10 p-3">
                    <div className="flex gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                        {outcome.issues.map((issue) => <li key={issue}>{issue}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AssessmentEditor({
  assessment,
  model,
  onChange,
  onRemove,
}: {
  assessment: Assessment;
  model: EvaluationModel;
  onChange: (patch: Partial<Assessment>) => void;
  onRemove: () => void;
}) {
  const splitModel = model === "type1" || model === "type4";
  const timed = isTimedAssessment(assessment.type);

  return (
    <div className="rounded-2xl border bg-card p-3 md:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_170px_170px_auto] lg:items-end">
        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">Designação</Label>
          <Input value={assessment.name} onChange={(event) => onChange({ name: event.target.value })} />
        </div>

        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">Tipo</Label>
          <Select value={assessment.type} onValueChange={(value) => onChange({ type: value as AssessmentType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">Modalidade</Label>
          <Select
            value={assessment.mode ?? "asynchronous"}
            disabled={!splitModel && model !== "custom"}
            onValueChange={(value) => onChange({ mode: value as AssessmentMode })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="asynchronous">Assíncrona</SelectItem>
              <SelectItem value="synchronous">Síncrona</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label={`Remover ${assessment.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberEditor
          label="Valor máximo"
          value={assessment.maxPoints}
          placeholder="0,00"
          onCommit={(value) => {
            if (value !== null) onChange({ maxPoints: value });
          }}
        />
        <NumberEditor
          label="Nota obtida"
          value={assessment.grade}
          placeholder="0,00"
          onCommit={(value) => onChange({ grade: value, status: value === null ? assessment.status : "graded" })}
        />

        <div className="flex items-end">
          <div className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5">
            <div>
              <div className="text-xs font-medium">Obrigatório</div>
              <div className="text-[10px] text-muted-foreground">Incluído no cálculo</div>
            </div>
            <Switch checked={assessment.required !== false} onCheckedChange={(checked) => onChange({ required: checked })} />
          </div>
        </div>

        <div className="flex items-end">
          <div className="w-full rounded-xl border px-3 py-2.5 text-xs">
            <div className="text-muted-foreground">Resultado</div>
            <div className="mt-0.5 font-semibold">
              {assessment.grade === null ? "Por classificar" : `${formatPtNumber(assessment.grade)} / ${formatPtNumber(assessment.maxPoints)}`}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {timed ? (
          <div className="sm:col-span-2">
            <Label className="mb-1 block text-[11px] text-muted-foreground">Data e hora</Label>
            <PtDateTimeInput value={assessment.date} onChange={(value) => onChange({ date: value })} />
          </div>
        ) : (
          <>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Início</Label>
              <PtDateInput value={assessment.startDate} onChange={(value) => onChange({ startDate: value })} />
            </div>
            <div>
              <Label className="mb-1 block text-[11px] text-muted-foreground">Fim</Label>
              <PtDateInput value={assessment.endDate} onChange={(value) => onChange({ endDate: value })} />
            </div>
          </>
        )}
        <div>
          <Label className="mb-1 block text-[11px] text-muted-foreground">Publicação da nota</Label>
          <PtDateInput value={assessment.gradeReleaseDate} onChange={(value) => onChange({ gradeReleaseDate: value })} />
        </div>
      </div>
    </div>
  );
}

function OutcomeBadge({ kind }: { kind: "in-progress" | "incomplete" | "passed" | "resit" | "failed" }) {
  const labels = {
    "in-progress": "Em curso",
    incomplete: "Configuração incompleta",
    passed: "Aprovado",
    resit: "Recurso",
    failed: "Reprovado",
  } as const;

  const className = kind === "passed"
    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-300"
    : kind === "resit" || kind === "failed"
      ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-300"
      : kind === "incomplete"
        ? "border-warning/35 bg-warning/10 text-warning"
        : "border-border bg-muted text-muted-foreground";

  return (
    <span className={`w-fit rounded-full border px-3 py-1 text-[11px] font-semibold ${className}`}>
      {labels[kind]}
    </span>
  );
}
