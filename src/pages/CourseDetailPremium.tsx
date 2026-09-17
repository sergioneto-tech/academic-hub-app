import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import EvaluationFrameworkNotice from "@/components/EvaluationFrameworkNotice";
import EvaluationModeSelector from "@/components/EvaluationModeSelector";
import LegacyEvaluationSavePanel from "@/components/LegacyEvaluationSavePanel";
import PucImportEntry from "@/components/PucImportEntry";
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
  const canImportPuc = regime === "regulation-2026" || historicalMode !== "final-grade-only";

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pt-4 md:px-6 md:pt-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/cadeiras">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar às cadeiras
          </Link>
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
      {canImportPuc && <PucImportEntry courseId={id} />}
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
