import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/AppStore";
import { validateAssessmentSave, type AssessmentSaveCheck } from "@/lib/assessmentSaveValidation";
import { getAssessments } from "@/lib/calculations";

export default function LegacyEvaluationSavePanel({ courseId }: { courseId: string }) {
  const { state, updateCourse } = useAppStore();
  const assessments = useMemo(
    () => getAssessments(state, courseId).filter((assessment) => assessment.type !== "resit" && assessment.type !== "special"),
    [state, courseId],
  );
  const fingerprint = useMemo(
    () => JSON.stringify(assessments.map((assessment) => ({
      id: assessment.id,
      name: assessment.name,
      type: assessment.type,
      maxPoints: assessment.maxPoints,
      grade: assessment.grade,
      startDate: assessment.startDate,
      endDate: assessment.endDate,
      gradeReleaseDate: assessment.gradeReleaseDate,
      date: assessment.date,
    }))),
    [assessments],
  );
  const [saveReview, setSaveReview] = useState<AssessmentSaveCheck | null>(null);
  const [savedAt, setSavedAt] = useState("");
  const [savedFingerprint, setSavedFingerprint] = useState("");

  useEffect(() => {
    setSaveReview(null);
    if (savedFingerprint && savedFingerprint !== fingerprint) setSavedAt("");
  }, [fingerprint, savedFingerprint]);

  const finishSave = () => {
    // As alterações são persistidas a cada edição pelo AppStore. Este passo explícito
    // confirma a configuração atual depois da validação e força a persistência do curso.
    updateCourse(courseId, {});
    setSaveReview(null);
    setSavedFingerprint(fingerprint);
    setSavedAt(new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }));
  };

  const requestSave = (allowWarnings = false) => {
    const check = validateAssessmentSave(assessments);
    if (check.errors.length > 0) {
      setSaveReview(check);
      return;
    }
    if (check.warnings.length > 0 && !allowWarnings) {
      setSaveReview(check);
      return;
    }
    finishSave();
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-6 md:px-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Save className="h-4 w-4 text-primary" />
              Gravar avaliação
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              No regime anterior, a data de publicação da nota também é opcional. Podes gravar as datas já conhecidas e completar mais tarde o que o professor ainda não tiver indicado.
            </p>
            {savedAt && (
              <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Avaliação gravada às {savedAt}.
              </p>
            )}
          </div>
          <Button type="button" className="shrink-0" onClick={() => requestSave(false)}>
            <Save className="mr-2 h-4 w-4" />
            Gravar
          </Button>
        </div>

        {saveReview && (saveReview.errors.length > 0 || saveReview.warnings.length > 0) && (
          <div className={`mt-4 rounded-xl border p-3 ${saveReview.errors.length > 0 ? "border-destructive/35 bg-destructive/10" : "border-warning/35 bg-warning/10"}`}>
            <div className="flex items-start gap-2">
              <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${saveReview.errors.length > 0 ? "text-destructive" : "text-warning"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {saveReview.errors.length > 0 ? "Existem datas incoerentes" : "Há campos que podes completar mais tarde"}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {saveReview.errors.length > 0
                    ? "Corrige os pontos abaixo antes de confirmar a gravação."
                    : "Os dados já preenchidos podem ser gravados. Queres continuar mesmo assim?"}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {[...saveReview.errors, ...saveReview.warnings].map((item) => <li key={item}>{item}</li>)}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setSaveReview(null)}>
                    Rever campos
                  </Button>
                  {saveReview.errors.length === 0 && (
                    <Button type="button" size="sm" onClick={() => requestSave(true)}>
                      Gravar mesmo assim
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
