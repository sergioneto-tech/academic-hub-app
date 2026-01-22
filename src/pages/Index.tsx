import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/hooks/useAppState";
import { getCourseStatus, totalEFolios, calculateMedia } from "@/lib/calculations";
import { BookOpen, Calendar, GraduationCap, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";

const Index = () => {
  const navigate = useNavigate();
  const { state } = useAppState();

  const activeCourses = state.activeCourses.filter((c) => c.ativa && !c.concluida);
  const completedCourses = state.activeCourses.filter((c) => c.concluida);
  const notas = completedCourses.map((c) => c.notaFinal).filter((n): n is number => n !== undefined);
  const media = calculateMedia(notas);

  const getRules = (courseId: string) =>
    state.rules.find((r) => r.courseId === courseId) || {
      courseId,
      minAptoExame: 3.5,
      minExame: 5.5,
      formulaFinal: "somaSimples" as const,
    };

  // Redirect to setup if no courses
  useEffect(() => {
    if (activeCourses.length === 0 && completedCourses.length === 0) {
      navigate("/setup");
    }
  }, [activeCourses.length, completedCourses.length, navigate]);

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome */}
        <div className="gradient-primary rounded-2xl p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">
            Olá, Estudante! 👋
          </h2>
          <p className="opacity-90">
            {state.degree?.nome || "Selecione uma licenciatura para começar"}
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeCourses.length}</p>
                  <p className="text-sm text-muted-foreground">Ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <GraduationCap className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedCourses.length}</p>
                  <p className="text-sm text-muted-foreground">Concluídas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                  <TrendingUp className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{media.toFixed(1)}</p>
                  <p className="text-sm text-muted-foreground">Média</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Calendar className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{state.assessments.filter(a => a.dataFim || a.dataExame).length}</p>
                  <p className="text-sm text-muted-foreground">Eventos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Courses */}
        {activeCourses.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Cadeiras Ativas</CardTitle>
                <CardDescription>Acompanhe o seu progresso</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/cadeiras">
                  Ver todas <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeCourses.slice(0, 3).map((course) => {
                const assessments = state.assessments.filter((a) => a.courseId === course.id);
                const rules = getRules(course.id);
                const status = getCourseStatus(assessments, rules, course.concluida);
                const total = totalEFolios(assessments);

                return (
                  <Link
                    key={course.id}
                    to={`/cadeiras/${course.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{course.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          e-fólios: {total.toFixed(1)} / 4
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={status} />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="hover:border-primary/20 transition-colors cursor-pointer" onClick={() => navigate("/setup")}>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Gerir Cadeiras</p>
                <p className="text-sm text-muted-foreground">Adicionar ou remover cadeiras</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/20 transition-colors cursor-pointer" onClick={() => navigate("/calendario")}>
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-info/10">
                <Calendar className="h-6 w-6 text-info" />
              </div>
              <div>
                <p className="font-semibold">Calendário</p>
                <p className="text-sm text-muted-foreground">Ver próximos eventos</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
