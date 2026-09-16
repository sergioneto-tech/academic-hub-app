import { useMemo, useState } from "react";
import { CheckCircle2, FileCheck2, RotateCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PtDateInput } from "@/components/ui/pt-date-input";
import type { EvaluationModel } from "@/lib/types";
import type { PucParseResult } from "@/lib/pucParser";

type DraftEvent = {
  key: string;
  name: string;
  startDate: string;
  endDate: string;
  gradeReleaseDate: string;
};

const MODEL_OPTIONS: Array<{ value: EvaluationModel; label: string }> = [
  { value: "custom", label: "Por confirmar" },
  { value: "type1", label: "Tipologia 1" },
  { value: "type2", label: "Tipologia 2" },
  { value: "type3", label: "Tipologia 3" },
  { value: "type4", label: "Tipologia 4" },
  { value: "exam-only", label: "Avaliação por exame" },
];

function buildDraftEvents(result: PucParseResult): DraftEvent[] {
  return result.events
    .filter((event) => event.kind === "assessment")
    .map((event) => ({
      key: event.key,
      name: event.name,
      startDate: event.startDate ?? "",
      endDate: event.endDate ?? "",
      gradeReleaseDate: event.gradeReleaseDate ?? "",
    }));
}

export default function PucReviewDraft({
  result,
  courseName,
  courseCode,
}: {
  result: PucParseResult;
  courseName: string;
  courseCode: string;
}) {
  const importableEvents = useMemo(() => buildDraftEvents(result), [result]);
  const [isOpen, setIsOpen] = useState(false);
  const [draftModel, setDraftModel] = useState<EvaluationModel>(result.evaluationModel ?? "custom");
  const [draftEvents, setDraftEvents] = useState<DraftEvent[]>(importableEvents);

  const resetDraft = () => {
    setDraftModel(result.evaluationModel ?? "custom");
    setDraftEvents(buildDraftEvents(result));
  };

  const openReview = () => {
    resetDraft();
    setIsOpen(true);
  };

  const updateEvent = (key: string, patch: Partial<DraftEvent>) => {
    setDraftEvents((current) => current.map((event) => event.key === key ? { ...event, ...patch } : event));
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
              O PUC corresponde a {courseName} ({courseCode}). Abre a revisão para veres como a tipologia e as atividades ficarão antes de qualquer gravação.
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
            Confirma ou corrige os dados abaixo. Nesta fase de teste, as alterações ficam apenas nesta pré-visualização e ainda não são gravadas na cadeira.
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
          onChange={(event) => setDraftModel(event.target.value as EvaluationModel)}
          className="mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm sm:max-w-sm"
        >
          {MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <div className="mt-4 space-y-3">
        {draftEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
            O PUC não contém atividades importáveis com datas estruturadas. Exame e recurso continuam a ser tratados pelo calendário oficial.
          </div>
        ) : draftEvents.map((event) => (
          <div key={event.key} className="rounded-2xl border bg-background/45 p-3 sm:p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_1fr_1fr_1fr] lg:items-end">
              <div className="grid gap-1">
                <Label className="text-[11px] text-muted-foreground">Designação</Label>
                <Input value={event.name} onChange={(change) => updateEvent(event.key, { name: change.target.value })} />
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

      <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
        As datas de exame e recurso não fazem parte desta revisão e continuarão a ser mantidas pelo calendário oficial já usado pelo Academic Hub.
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={resetDraft}>
            <RotateCcw className="mr-2 h-4 w-4" />Repor dados do PUC
          </Button>
          <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Fechar revisão</Button>
        </div>
        <Button type="button" disabled title="A gravação só será ativada depois de validares esta fase visual.">
          <Save className="mr-2 h-4 w-4" />Guardar na cadeira · próximo passo
        </Button>
      </div>
    </section>
  );
}
