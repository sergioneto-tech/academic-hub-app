import { useParams } from "react-router-dom";

import CourseEvaluationSettings from "@/components/CourseEvaluationSettings";
import CourseDetail from "@/pages/CourseDetail";

export default function CourseDetailPremium() {
  const { id } = useParams();

  return (
    <div className="space-y-5">
      {id && (
        <div className="mx-auto max-w-5xl px-4 pt-4 md:px-6 md:pt-6">
          <CourseEvaluationSettings courseId={id} />
        </div>
      )}
      <CourseDetail />
    </div>
  );
}
