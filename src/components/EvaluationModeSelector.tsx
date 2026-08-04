import { Scale } from "lucide-react";

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
import type { EvaluationRegime } from "@/lib/types";

export default function EvaluationModeSelector({ courseId }: { courseId: string }) {
  const { state, updateCourse } = useAppStore();
  const course = state.courses.find((item) => item.id === courseId);
  if (!course) return null;

  const regime: EvaluationRegime = course.evaluationRegime ?? "legacy";

  const setRegime = (next: EvaluationRegime) => {
    updateCourse(courseId, {
      evaluationRegime: next,
      evaluationModel: course.evaluationModel ?? "custom",
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 md:px-6">
      <Card className="premium-card">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] sm:items-center md:p-5">
          <div className="flex min-w-0 gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--gold-soft))] text-[hsl(var(--gold))]">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">Modo de avaliação</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                A escolha é feita por cadeira e não elimina notas, datas ou elementos já registados.
              </p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`evaluation-mode-${courseId}`} className="text-xs text-muted-foreground">
              Regime aplicável
            </Label>
            <Select value={regime} onValueChange={(value) => setRegime(value as EvaluationRegime)}>
              <SelectTrigger id={`evaluation-mode-${courseId}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="legacy">Regime publicado — e-fólios + g-fólio</SelectItem>
                <SelectItem value="regulation-2026">Configuração flexível baseada no PUC</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] leading-4 text-muted-foreground">
              A configuração flexível corresponde ao projeto colocado em consulta pública e deve ser confirmada no PUC.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
