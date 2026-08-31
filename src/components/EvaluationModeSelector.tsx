import { History, Scale } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/AppStore";
import type { EvaluationRegime, LegacyEvaluationMode } from "@/lib/types";

export default function EvaluationModeSelector({ courseId }: { courseId: string }) {
  const { state, updateCourse } = useAppStore();
  const course = state.courses.find((item) => item.id === courseId);
  if (!course) return null;

  const regime: EvaluationRegime = course.evaluationRegime ?? "legacy";
  const historicalMode: LegacyEvaluationMode = course.legacyEvaluationMode ?? "efolios-exam";

  const setRegime = (next: EvaluationRegime) => {
    updateCourse(courseId, {
      evaluationRegime: next,
      evaluationRegimeSource: "manual",
      evaluationModel: next === "regulation-2026" ? (course.evaluationModel ?? "custom") : course.evaluationModel,
    });
  };

  const setHistoricalMode = (next: LegacyEvaluationMode) => {
    updateCourse(courseId, {
      evaluationRegime: "legacy",
      evaluationRegimeSource: "manual",
      legacyEvaluationMode: next,
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 md:px-6">
      <Card className="premium-card">
        <CardContent className="space-y-5 p-4 md:p-5">
          <div className="flex min-w-0 gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--gold-soft))] text-[hsl(var(--gold))]">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Como queres registar a avaliação desta cadeira?</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Se estás a frequentar a cadeira, usa a estrutura indicada no PUC. Se já a concluíste no passado e apenas precisas de guardar a classificação final, escolhe o registo histórico e depois a opção de nota final. Esta escolha não elimina notas ou datas já registadas.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`evaluation-regime-${courseId}`} className="text-xs text-muted-foreground">
                Período / estrutura
              </Label>
              <Select value={regime} onValueChange={(value) => setRegime(value as EvaluationRegime)}>
                <SelectTrigger id={`evaluation-regime-${courseId}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="legacy">Regime anterior ou histórico</SelectItem>
                  <SelectItem value="regulation-2026">Configuração flexível conforme o PUC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {regime === "legacy" && (
              <div className="grid gap-1.5">
                <Label htmlFor={`historical-mode-${courseId}`} className="text-xs text-muted-foreground">
                  Estrutura de avaliação
                </Label>
                <Select value={historicalMode} onValueChange={(value) => setHistoricalMode(value as LegacyEvaluationMode)}>
                  <SelectTrigger id={`historical-mode-${courseId}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efolios-exam">e-fólios + g-fólio / prova final</SelectItem>
                    <SelectItem value="exam-only">Apenas exame / prova final</SelectItem>
                    <SelectItem value="custom">Avaliação histórica personalizada</SelectItem>
                    <SelectItem value="final-grade-only">Já concluída no passado — só nota final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {regime === "legacy" && historicalMode !== "efolios-exam" && (
            <div className="flex items-start gap-2 rounded-xl border bg-muted/25 p-3 text-xs leading-5 text-muted-foreground">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                {historicalMode === "final-grade-only"
                  ? "Para uma cadeira já concluída no passado, basta indicar a classificação final de 0 a 20. Não precisas de preencher e-fólios, datas ou ponderações antigas."
                  : "Esta opção destina-se também a unidades curriculares antigas. Não é necessário inventar e-fólios ou ponderações que não existiam ou que já não são conhecidos."}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
