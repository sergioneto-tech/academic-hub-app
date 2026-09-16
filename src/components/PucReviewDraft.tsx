import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, RotateCcw, Save, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PtDateInput } from "@/components/ui/pt-date-input";
import { useAppStore } from "@/lib/AppStore";
import { applyPucImportToState } from "@/lib/pucImportApply";
import { buildPucImportDraft, type PucImportDraftEvent } from "@/lib/pucImportDraft";
import type { PucParseResult } from "@/lib/pucParser";
import type { EvaluationModel } from "@/lib/types";

const MODEL_OPTIONS: Array<{ value: EvaluationModel; label: string }> = [
  { value: "custom", label: "Por confirmar" },
  { value: "type1", label: "Tipologia 1" },
  { value: "type2", label: "Tipologia 2" },
  { value: "type3", label: "Tipologia 3" },
  { value: "type4", label: "Tipologia 4" },
  { value: "exam-only", label: "Avaliação por exame" },
];

function toNullableNumber(rawValue: string): number | null {
  const raw = rawValue.trim();
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function PucReviewDraft({
  result,
  rawText,
  courseId,
  courseName,
  courseCode,
  onSaved,
}: {
  result: PucParseResult;
  rawText: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  onSaved?: () => void;
}) {
  const { state, replaceState } = useAppStore();
  const importDraft = useMemo(() => buildPucImportDraft(result, rawText), [result, rawText]);
  const [isOpen, setIsOpen] = useState(false);
  const [draftModel, setDraftModel] = useState<EvaluationModel>(importDraft.model);
  const [draftEvents, setDraftEvents] = useState<PucImportDraftEvent[]>(importDraft.events);
  const [draftFinalPoints, setDraftFinalPoints] = useState<number | null>(importDraft.finalAssessment?.maxPoints ?? null);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [replaceConfirmation, setReplaceConfirmation] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  const resetDraft = () => {
    setDraftModel(importDraft.model);
    setDraftEvents(importDraft.events.map((event) => ({ ...event })));
    setDraftFinalPoints(importDraft.finalAssessment?.maxPoints ?? null);
    setSaveErrors([]);
    setReplaceConfirmation(false);
    setSavedMessage("");
  };

  const openReview = () => {
    resetDraft();
    setIsOpen(true);
  };

  const updateEvent = (key: string, patch: Partial<PucImportDraftEvent>) => {
    setSavedMessage("");
    setSaveErrors([]);
    setReplaceConfirmation(false);
    setDraftEvents((current) => current.map((event) => event.key === key ? { ...event, ...patch } : event));
  };

  const saveDraft = (allowReplaceExisting = false) => {
    setSaveErrors([]);
    setReplaceConfirmation(false);
    setSavedMessage("");

    const applied = applyPucImportToState(state, courseId, {
      model: draftModel,
      events: draftEvents.map((event) => ({
        name: event.name,
        maxPoints: event.maxPoints,
        startDate: event.startDate,
        endDate: event.endDate,
        gradeReleaseDate: event.gradeReleaseDate,
      })),
      finalAssessmentName: importDraft.finalAssessment?.name,
      finalAssessmentMaxPoints: draftFinalPoints,
    }, { allowReplaceExisting });

    if (applied.ok === false) {
      if (applied.reason === "replace-confirmation") setReplaceConfirmation(true);
      setSaveErrors(applied.errors);
      return;
    }

    replaceState(applied.nextState);
    setSavedMessage(
      applied.summary.finalAssessmentUpdated
        ? `Dados guardados na cadeira: ${applied.summary.importedEvents} elemento(s) importado(s) e cotação da prova final atualizada. As datas oficiais de exame e recurso não foram alteradas.`
        : `Dados guardados na cadeira: ${applied.summary.importedEvents} elemento(s) importado(s).`,
    );
    onSaved?.();
  };

  if (!isOpen) {
    return (
      <section className="rounded-2xl border border-primary/25 bg-primary/[0.035] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileCheck2 className="h-4 w-4 text-primary" />
              Rever antes de importar
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              O PUC corresponde a {courseName} ({courseCode}). Abre a revisão para confirmares tipologia, cotações e datas antes de qualquer gravação.
            </p>
          </div>
          <Button type="button" className="shrink-0" onClick={openReview}>
            <CheckCircle2 className="mr-2 h-4 w-4" />Rever dados
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-base font-semibold">Pré-visualização da importação</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Confirma ou corrige os dados abaixo. O botão de gravação permanece sempre dentro desta revisão e só aplica os valores que estiverem visíveis aqui.
          </p>
        </div>
        <div className="rounded-full border bg-muted/35 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          {courseName} · {courseCode}
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-muted/15 p-3 sm:p-4">
        <Label htmlFor="puc-review-model" className="text-xs text-muted-foreground">Tipologia / modalidade</Label>
        <select
          id="puc-review-model"
          value={draftModel}
          onChange={(event) => {
            setDraftModel(event.target.value as EvaluationModel);
            setSavedMessage("");
            setSaveErrors([]);
            setReplaceConfirmation(false);
          }}
          className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm sm:max-w-sm"
        >
          {MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      {importDraft.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {importDraft.warnings.map((warning) => (
            <div key={warning} className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {draftEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
            O PUC não contém atividades importáveis com datas estruturadas. A prova final pode ainda ter uma cotação própria indicada abaixo.
          </div>
        ) : draftEvents.map((event) => (
          <div key={event.key} className="rounded-2xl border bg-background/45 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.3fr)_150px_1fr_1fr_1fr] xl:items-end">
              <div className="grid gap-1 sm:col-span-2 xl:col-span-1">
                <Label className="text-[11px] text-muted-foreground">Designação</Label>
                <Input value={event.name} onChange={(change) => updateEvent(event.key, { name: change.target.value })} />
              </div>
              <div className="grid gap-1">
                <Label className="text-[11px] text-muted-foreground">Valor máximo</Label>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  inputMode="decimal"
                  value={event.maxPoints ?? ""}
                  placeholder="Confirmar"
                  onChange={(change) => updateEvent(event.key, { maxPoints: toNullableNumber(change.target.value) })}
                />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Início</Label>
                <PtDateInput value={event.startDate} onChange={(value) => updateEvent(event.key, { startDate: value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Fim / entrega</Label>
                <PtDateInput value={event.endDate} onChange={(value) => updateEvent(event.key, { endDate: value })} />
              </div>
              <div>
                <Label className="mb-1 block text-[11px] text-muted-foreground">Publicação da nota</Label>
                <PtDateInput value={event.gradeReleaseDate} onChange={(value) => updateEvent(event.key, { gradeReleaseDate: value })} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {importDraft.finalAssessment && (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/[0.045] p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cotação da prova final</div>
              <div className="mt-1 text-sm font-semibold">{importDraft.finalAssessment.name}</div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                Apenas esta cotação vem do PUC. A data e a hora do exame, bem como o recurso, continuam ligadas ao calendário oficial já usado pelo Academic Hub.
              </p>
            </div>
            <div className="grid w-full gap-1 sm:w-44 sm:shrink-0">
              <Label htmlFor="puc-final-points" className="text-[11px] text-muted-foreground">Valor máximo</Label>
              <Input
                id="puc-final-points"
                type="number"
                min="0"
                max="20"
                step="0.5"
                inputMode="decimal"
                value={draftFinalPoints ?? ""}
                placeholder="Confirmar"
                onChange={(change) => {
                  setDraftFinalPoints(toNullableNumber(change.target.value));
                  setSavedMessage("");
                  setSaveErrors([]);
                  setReplaceConfirmation(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
        <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>As datas e horas de exame e recurso não são importadas do PUC. Permanecem sempre associadas ao calendário oficial que o Academic Hub já utiliza; desta prova apenas será guardada a cotação confirmada pelo aluno.</span></div>
      </div>

      {saveErrors.length > 0 && (
        <div className={`mt-4 rounded-xl border p-3 text-xs leading-5 ${replaceConfirmation ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200" : "border-destructive/30 bg-destructive/10 text-destructive"}`} role="alert">
          <div className="font-semibold">{replaceConfirmation ? "Confirmação adicional necessária" : "Não foi possível guardar"}</div>
          <div className="mt-1 space-y-1">
            {saveErrors.map((error) => <div key={error}>• {error}</div>)}
          </div>
          {replaceConfirmation && (
            <Button type="button" variant="outline" className="mt-3" onClick={() => saveDraft(true)}>
              Confirmar substituição e guardar
            </Button>
          )}
        </div>
      )}

      {savedMessage && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-800 dark:text-emerald-200" role="status" aria-live="polite">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{savedMessage}</span>
        </div>
      )}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={resetDraft}>
            <RotateCcw className="mr-2 h-4 w-4" />Repor dados do PUC
          </Button>
          <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Fechar revisão</Button>
        </div>
        <Button type="button" disabled={Boolean(savedMessage)} onClick={() => saveDraft(false)}>
          {savedMessage ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
          {savedMessage ? "Guardado na cadeira" : "Guardar na cadeira"}
        </Button>
      </div>
    </section>
  );
}
