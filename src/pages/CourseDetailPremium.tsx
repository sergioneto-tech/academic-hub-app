import { useMemo } from "react";
import { useParams } from "react-router-dom";

import EvaluationFrameworkNotice from "@/components/EvaluationFrameworkNotice";
import EvaluationModeSelector from "@/components/EvaluationModeSelector";
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
      <EvaluationFrameworkNotice regime={regime} />
      {regime === "legacy" && <EvaluationModeSelector courseId={id} />}
      {regime === "regulation-2026"
        ? <FlexibleCourseDetail courseId={id} />
        : historicalMode === "efolios-exam"
          ? <CourseDetail />
          : <HistoricalCourseDetail courseId={id} mode={historicalMode} />}
    </>
  );
}
