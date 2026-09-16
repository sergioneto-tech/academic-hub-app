import { useMemo } from "react";
import { useParams } from "react-router-dom";

import EvaluationFrameworkNotice from "@/components/EvaluationFrameworkNotice";
import EvaluationModeSelector from "@/components/EvaluationModeSelector";
import LegacyEvaluationSavePanel from "@/components/LegacyEvaluationSavePanel";
import PucImportEntry from "@/components/PucImportEntry";
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
      {course.isExtracurricular && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
          <strong>Cadeira extracurricular.</strong>{" "}
          Podes gerir avaliações, datas, notas e conclusão normalmente. Esta cadeira não é contabilizada na média, ECTS ou progresso oficial da licenciatura.
        </div>
      )}
      <EvaluationFrameworkNotice regime={regime} />
      <EvaluationModeSelector courseId={id} />
      {regime === "regulation-2026"
        ? (
          <>
            <PucImportEntry courseId={id} />
            <FlexibleCourseDetail courseId={id} />
          </>
        )
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
