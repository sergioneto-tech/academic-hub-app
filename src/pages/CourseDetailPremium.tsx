import { useMemo } from "react";
import { useParams } from "react-router-dom";

import { useAppStore } from "@/lib/AppStore";
import CourseDetail from "@/pages/CourseDetail";
import FlexibleCourseDetail from "@/pages/FlexibleCourseDetail";

export default function CourseDetailPremium() {
  const { id } = useParams();
  const { state } = useAppStore();
  const course = useMemo(
    () => state.courses.find((item) => item.id === id),
    [state.courses, id],
  );

  if (!id || !course) return <CourseDetail />;

  return course.evaluationRegime === "regulation-2026"
    ? <FlexibleCourseDetail courseId={id} />
    : <CourseDetail />;
}
