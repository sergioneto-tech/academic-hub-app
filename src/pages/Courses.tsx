import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PowerOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/AppStore";
import { courseStatusLabel, getAssessments, totalEFolios, totalEFoliosMax } from "@/lib/calculations";
import { Badge } from "@/components/ui/badge";
import { getPlanCoursesForDegree, getCourseArea } from "@/lib/uabPlan";

export default function CoursesPage() {
  const { state, updateCourse } = useAppStore();
  const courses = state.courses.filter(c => c.isActive && !c.isCompleted);
  const planCourses = useMemo(() => getPlanCoursesForDegree(state.degree), [state.degree]);

  const deactivateCourse = (courseId: string, courseName: string) => {
    const confirmed = window.confirm(
      `Desativar ${courseName}?\n\nAs datas, classificações e restantes dados ficam guardados. Podes reativar a cadeira mais tarde sem perder informação.`,
    );
    if (!confirmed) return;
    updateCourse(courseId, { isActive: false });
  };

  return (
    <div className="space-y-6">
      <div className="text-2xl font-semibold">Cadeiras</div>

      <Card>
        <CardHeader>
          <CardTitle>Ativas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {courses.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem cadeiras ativas.</div>
          ) : (
            courses.map(c => {
              const st = courseStatusLabel(state, c.id);
              const regulationAssessments = c.evaluationRegime === "regulation-2026"
                ? getAssessments(state, c.id).filter((assessment) => (
                    assessment.required !== false
                    && assessment.type !== "resit"
                    && assessment.type !== "special"
                  ))
                : [];
              const evaluationGrade = c.evaluationRegime === "regulation-2026"
                ? regulationAssessments.reduce((sum, assessment) => sum + (assessment.grade ?? 0), 0)
                : totalEFolios(state, c.id);
              const evaluationMax = c.evaluationRegime === "regulation-2026"
                ? regulationAssessments.reduce((sum, assessment) => sum + Math.max(0, Number(assessment.maxPoints) || 0), 0)
                : totalEFoliosMax(state, c.id);
              const evaluationLabel = c.evaluationRegime === "regulation-2026" ? "avaliação" : "e-fólios";

              const badgeVariant =
                st.badge === "success"
                  ? "default"
                  : st.badge === "warning"
                  ? "secondary"
                  : st.badge === "danger"
                  ? "destructive"
                  : "outline";

              return (
                <div key={c.id} className="rounded-lg border p-3 transition-colors hover:bg-muted/30 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link
                      to={`/cadeiras/${c.id}`}
                      className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <div className="flex flex-wrap items-center gap-2 font-semibold">
                        <span>{c.name}</span>
                        {c.isExtracurricular && <Badge variant="outline">Extracurricular</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {c.code} • {evaluationLabel}: {evaluationGrade.toFixed(1)} / {evaluationMax.toFixed(1)}
                        {c.isExtracurricular
                          ? <span className="italic"> • não conta para média/ECTS oficiais</span>
                          : getCourseArea(planCourses, c.code) && <span className="italic"> • {getCourseArea(planCourses, c.code)}</span>}
                      </div>
                    </Link>

                    <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                      <Badge variant={badgeVariant}>{st.label}</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-muted-foreground hover:border-destructive/50 hover:text-destructive"
                        onClick={() => deactivateCourse(c.id, c.name)}
                        aria-label={`Desativar ${c.name}`}
                      >
                        <PowerOff className="mr-2 h-4 w-4" />
                        Desativar
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
