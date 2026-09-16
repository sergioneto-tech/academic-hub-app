import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { FileSearch2 } from "lucide-react";

import EvaluationFrameworkNotice from "@/components/EvaluationFrameworkNotice";
import EvaluationModeSelector from "@/components/EvaluationModeSelector";
import LegacyEvaluationSavePanel from "@/components/LegacyEvaluationSavePanel";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/AppStore";
import CourseDetail from "@/pages/CourseDetail";
import FlexibleCourseDetail from "@/pages/FlexibleCourseDetail";
import HistoricalCourseDetail from "@/pages/HistoricalCourseDetail";

export default function CourseDetailPremium() {
  const { id } = useParams();
  const { state } = useAppStore();
  const course = useMemo(
    () => state.courses.find((item) => item.id === id),
    [state.courses, id],
  );

  if (!id || !course) return <CourseDetail />;

  const regime = course.evaluationRegime ?? "legacy";
  const historicalMode = course.legacyEvaluationMode ?? "efolios-exam";

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">Teste privado do importador PUC</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Abre o leitor experimental. Nesta fase não grava nem altera dados da cadeira.</p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link to="/_teste/puc"><FileSearch2 className="mr-2 h-4 w-4" />Abrir leitor PUC</Link>
        </Button>
      </div>

      {course.isExtracurricular && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
          <strong>Cadeira extracurricular.</strong>{" "}
          Podes gerir avaliações, datas, notas e conclusão normalmente. Esta cadeira não é contabilizada na média, ECTS ou progresso oficial da licenciatura.
        </div>
      )}
      <EvaluationFrameworkNotice regime={regime} />
      <EvaluationModeSelector courseId={id} />
      {regime === "regulation-2026"
        ? <FlexibleCourseDetail courseId={id} />
        : historicalMode === "efolios-exam"
          ? (
            <>
              <CourseDetail />
              <LegacyEvaluationSavePanel courseId={id} />
            </>
          )
          : <HistoricalCourseDetail courseId={id} mode={historicalMode} />}
    </>
  );
}
