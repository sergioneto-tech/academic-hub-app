import { Layout } from "@/components/Layout";
import { CourseCard } from "@/components/CourseCard";
import { useAppState } from "@/hooks/useAppState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus } from "lucide-react";
import { Link } from "react-router-dom";

export default function Courses() {
  const { state } = useAppState();
  
  const activeCourses = state.activeCourses.filter((c) => c.ativa && !c.concluida);

  const getAssessments = (courseId: string) =>
    state.assessments.filter((a) => a.courseId === courseId);

  const getRules = (courseId: string) =>
    state.rules.find((r) => r.courseId === courseId) || {
      courseId,
      minAptoExame: 3.5,
      minExame: 5.5,
      formulaFinal: "somaSimples" as const,
    };

  return (
    <Layout title="Cadeiras Ativas">
      <div className="space-y-6">
        {activeCourses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Sem cadeiras ativas</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">
                Adicione cadeiras no Setup para começar a gerir as suas avaliações.
              </p>
              <Button asChild>
                <Link to="/setup">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Cadeiras
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {activeCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                assessments={getAssessments(course.id)}
                rules={getRules(course.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
