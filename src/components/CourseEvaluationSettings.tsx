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
import { formatPtDateTime } from "@/lib/date";
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
  whenToUse: string;
}> = [
  {
    value: "custom",
    label: "A aguardar tipologia do PUC",
    description: "Estado provisório: o regime 2026 já está confirmado, mas ainda falta registar a tipologia indicada no PUC da unidade curricular.",
    whenToUse: "Mantém apenas até confirmares o PUC.",
  },
  {
    value: "type1",
    label: "Tipologia 1",
    description: "2 a 3 elementos assíncronos (6–8 valores no total) e 1 elemento síncrono (12–14 valores), com mínimo de 50% em cada componente e nota final mínima de 10/20.",
    whenToUse: "Seleciona quando o PUC indicar Tipologia 1.",
  },
  {
    value: "type2",
    label: "Tipologia 2",
    description: "2 a 4 atividades assíncronas articuladas. Pelo menos N−1 têm de atingir 40% da respetiva cotação e a classificação final tem de atingir 10/20.",
    whenToUse: "Seleciona quando o PUC indicar Tipologia 2.",
  },
  {
    value: "type3",
    label: "Tipologia 3",
    description: "2 a 4 atividades assíncronas autónomas. Pelo menos N−1 têm de atingir 40% da respetiva cotação e a classificação final tem de atingir 10/20.",
    whenToUse: "Seleciona quando o PUC indicar Tipologia 3.",
  },
  {
    value: "type4",
    label: "Tipologia 4",
    description: "Exatamente 1 elemento assíncrono (6–8 valores) e 1 elemento síncrono (12–14 valores), com mínimo de 50% em cada componente e nota final mínima de 10/20.",
    whenToUse: "Seleciona quando o PUC indicar Tipologia 4.",
  },
  {
    value: "exam-only",
    label: "Avaliação por exame",
    description: "Classificação obtida numa prova final síncrona cotada para 20 valores, apenas quando esta modalidade estiver prevista para a UC.",
    whenToUse: "Seleciona apenas quando o Guia/PUC disponibilizar avaliação por exame.",
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
    () => getAssessments(state, courseId).filter((assessment) => assessment.type !== "resit" && assessment.type !== "special"),
    [state, courseId],
  );
  const outcome = useMemo(() => getRegulationOutcome(state, courseId), [state, courseId]);

  if (!course) return null;

  const regime: EvaluationRegime = course.evaluationRegime ?? "legacy";
  const model: EvaluationModel = course.evaluationModel ?? "custom";
  const requiredMaximum = totalMaximum(assessments);
  const officialRegime = course.evaluationRegimeSource === "official";

  const setRegime = (next: EvaluationRegime) => {
    if (officialRegime) return;
    updateCourse(courseId, {
      evaluationRegime: next,
      evaluationRegimeSource: "manual",
      evaluationModel: course.evaluationModel ?? "custom",
    });
  };

  const setModel = (next: EvaluationModel) => {
    updateCourse(courseId, { evaluationRegime: "regulation-2026", evaluationModel: next });

    if (next === "exam-only") {
      assessments.forEach((assessment) => {
        if (assessment.type !== "exam" && assessment.required !== false) {
          updateAssessment(assessment.id, { required: false });
        }
      });
      const existingExam = assessments.find((assessment) => assessment.type === "exam");
      if (existingExam) {
        updateAssessment(existingExam.id, {
          name: "Exame",
          maxPoints: 20,
          mode: "synchronous",
          required: true,
        });
        return;
      }
      addAssessment(courseId, {
        type: "exam",
        name: "Exame",
        maxPoints: 20,
        grade: null,
        mode: "synchronous",
        required: true,
      });
      return;
    }

    if (next === "type2" || next === "type3") {
      assessments.forEach((assessment) => {
        if (assessment.required !== false) updateAssessment(assessment.id, { mode: "asynchronous" });
      });
    }
  };

  const addElement = () => {
    addAssessment(courseId, {
      type: "activity",
      name: `Atividade ${assessments.length + 1}`,
      maxPoints: 0,
      grade: null,
      mode: "asynchronous",
      required: true,
    });
  };

  return (
    <Card className="premium-card">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-[hsl(var(--gold))]" />
            Tipologia de avaliação
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            O regime é aplicado automaticamente quando a UC consta do anexo oficial. A tipologia concreta é a indicada no PUC.
          </p>
        </div>
        <div className="rounded-full border bg-muted/35 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          {regime === "legacy" ? "Regime anterior" : officialRegime ? "Regulamento 2026 · UAb" : "Regulamento 2026"}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid content-start gap-2">
            <Label>Regime aplicável</Label>
            <Select value={regime} disabled={officialRegime} onValueChange={(value) => setRegime(value as EvaluationRegime)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="legacy">Regime anterior</SelectItem>
                <SelectItem value="regulation-2026">Regulamento de avaliação 2026</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {officialRegime ? "Aplicado automaticamente a partir do Despacho n.º 9792/2026." : "Usa o regime oficialmente aplicável à UC."}
            </p>
          </div>

          <div className="grid content-start gap-2">
            <Label>Tipologia / modalidade</Label>
            <Select
              value={model}
              disabled={regime !== "regulation-2026"}
              onValueChange={(value) => setModel(value as EvaluationModel)}
            >
              <SelectTrigger><SelectValue placeholder="Seleciona a tipologia" /></SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {regime === "legacy"
                ? "O cálculo histórico permanece inalterado."
                : MODEL_OPTIONS.find((option) => option.value === model)?.description}
            </p>
          </div>
        </div>

        {regime === "regulation-2026" && (
          <div className="space-y-3 rounded-2xl border bg-muted/15 p-4">
            <div className="text-center">
              <div className="text-sm font-semibold">Como escolher a tipologia</div>
              <p className="mt-1 text-xs text-muted-foreground">
                A escolha não é pessoal: confirma o PUC. O Academic Hub valida depois a estrutura, as cotações e os mínimos do regulamento.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {MODEL_OPTIONS.filter((option) => option.value.startsWith("type")).map((option) => {
                const selected = option.value === model;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setModel(option.value)}
                    className={`flex min-h-40 flex-col items-center justify-center rounded-2xl border p-4 text-center transition-colors ${selected
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                      : "bg-card hover:bg-muted/35"}`}
                    aria-pressed={selected}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="text-base font-semibold">{option.label}</div>
                      {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />}
                    </div>
                    <p className="mt-2 max-w-md text-xs leading-5 text-muted-foreground">{option.description}</p>
                    <p className="mt-3 text-[11px] font-medium leading-5 text-foreground/80">{option.whenToUse}</p>
                  </button>
                );
              })}
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              As datas das provas normal e de recurso são obtidas do calendário oficial da UAb; aqui registas sobretudo os trabalhos e atividades definidos no PUC.
            </p>
          </div>
        )}

        {regime === "regulation-2026" && model !== "custom" && (
          <>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch">
              <div className={`flex min-h-24 flex-col items-center justify-center rounded-xl border p-4 text-center ${requiredMaximum === 20
                ? "border-emerald-500/35 bg-emerald-500/10"
                : "border-warning/40 bg-warning/10"}`}
              >
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-sm font-semibold">{requiredMaximum === 20 ? "Escala correta" : "Escala inválida"}</span>
                  <span className={requiredMaximum === 20 ? "text-emerald-700 dark:text-emerald-400" : "font-semibold text-warning"}>
                    {formatPtNumber(requiredMaximum)} / 20 valores
                  </span>
                </div>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  {requiredMaximum === 20
                    ? "Os elementos obrigatórios totalizam corretamente 20 valores."
                    : `Os elementos obrigatórios somam ${formatPtNumber(requiredMaximum)} valores. Ajusta-os de acordo com o PUC.`}
                </p>
              </div>
              <Button className="h-full min-h-24" type="button" variant="outline" onClick={addElement} disabled={model === "exam-only"}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar elemento
              </Button>
            </div>

            <div className="space-y-3">
              {assessments.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Ainda não existem elementos de avaliação configurados.</div>
              ) : assessments.map((assessment) => (
                <AssessmentEditor
                  key={assessment.id}
                  assessment={assessment}
                  model={model}
                  onChange={(patch) => updateAssessment(assessment.id, patch)}
                  onRemove={() => {
                    if (window.confirm(`Remover ${assessment.name}? As datas e a classificação também serão eliminadas.`)) removeAssessment(assessment.id);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {outcome && (
          <div className="rounded-2xl border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Verificação do regulamento</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {outcome.modelLabel}{outcome.rounded === null ? "" : ` · resultado atual ${outcome.rounded}/20`}
                </div>
              </div>
              <OutcomeBadge kind={outcome.kind} />
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {outcome.requirements.map((entry) => (
                <div key={entry.key} className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center ${!entry.met ? "bg-warning/5" : "bg-card"}`}>
                  {entry.met
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0 text-center">
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
      </CardContent>
    </Card>
  );
}

function AssessmentEditor({ assessment, model, onChange, onRemove }: {
  assessment: Assessment;
  model: EvaluationModel;
  onChange: (patch: Partial<Assessment>) => void;
  onRemove: () => void;
}) {
  const splitModel = model === "type1" || model === "type4";
  const timed = isTimedAssessment(assessment.type);
  const officialDate = timed && assessment.dateSource === "official" && Boolean(assessment.date);

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
            <SelectContent>{TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">Modalidade</Label>
          <Select
            value={assessment.mode ?? "asynchronous"}
            disabled={!splitModel}
            onValueChange={(value) => onChange({ mode: value as AssessmentMode })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="asynchronous">Assíncrona</SelectItem>
              <SelectItem value="synchronous">Síncrona</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label={`Remover ${assessment.name}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberEditor label="Valor máximo" value={assessment.maxPoints} placeholder="0,00" onCommit={(value) => { if (value !== null) onChange({ maxPoints: value }); }} />
        <NumberEditor label="Nota obtida" value={assessment.grade} placeholder="0,00" onCommit={(value) => onChange({ grade: value, status: value === null ? assessment.status : "graded" })} />
        <div className="flex items-end">
          <div className="flex w-full items-center justify-between rounded-xl border px-3 py-2.5">
            <div><div className="text-xs font-medium">Obrigatório</div><div className="text-[10px] text-muted-foreground">Incluído no cálculo</div></div>
            <Switch checked={assessment.required !== false} onCheckedChange={(checked) => onChange({ required: checked })} />
          </div>
        </div>
        <div className="flex items-end">
          <div className="w-full rounded-xl border px-3 py-2.5 text-xs">
            <div className="text-muted-foreground">Resultado</div>
            <div className="mt-0.5 font-semibold">{assessment.grade === null ? "Por classificar" : `${formatPtNumber(assessment.grade)} / ${formatPtNumber(assessment.maxPoints)}`}</div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {timed ? (
          <div className="sm:col-span-2">
            <Label className="mb-1 block text-[11px] text-muted-foreground">Data e hora</Label>
            {officialDate ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm">
                <div className="font-medium">{formatPtDateTime(assessment.date!)}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">Data oficial UAb · atualização automática</div>
              </div>
            ) : (
              <PtDateTimeInput value={assessment.date} onChange={(value) => onChange({ date: value, dateSource: "manual" })} />
            )}
          </div>
        ) : (
          <>
            <div><Label className="mb-1 block text-[11px] text-muted-foreground">Início</Label><PtDateInput value={assessment.startDate} onChange={(value) => onChange({ startDate: value })} /></div>
            <div><Label className="mb-1 block text-[11px] text-muted-foreground">Fim</Label><PtDateInput value={assessment.endDate} onChange={(value) => onChange({ endDate: value })} /></div>
          </>
        )}
        <div><Label className="mb-1 block text-[11px] text-muted-foreground">Publicação da nota</Label><PtDateInput value={assessment.gradeReleaseDate} onChange={(value) => onChange({ gradeReleaseDate: value })} /></div>
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
  return <span className={`w-fit rounded-full border px-3 py-1 text-[11px] font-semibold ${className}`}>{labels[kind]}</span>;
}
