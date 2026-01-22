import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppState } from "@/hooks/useAppState";
import { calculateMedia } from "@/lib/calculations";
import { Award, BookOpen, TrendingUp } from "lucide-react";

export default function History() {
  const { state } = useAppState();

  const completedCourses = state.activeCourses.filter((c) => c.concluida);
  const notas = completedCourses
    .map((c) => c.notaFinal)
    .filter((n): n is number => n !== undefined);
  const media = calculateMedia(notas);

  return (
    <Layout title="Histórico">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedCourses.length}</p>
                  <p className="text-sm text-muted-foreground">Cadeiras Concluídas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{media.toFixed(1)}</p>
                  <p className="text-sm text-muted-foreground">Média Global</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                  <Award className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {notas.length > 0 ? Math.max(...notas) : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">Melhor Nota</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Completed Courses */}
        <Card>
          <CardHeader>
            <CardTitle>Cadeiras Concluídas</CardTitle>
            <CardDescription>
              Histórico das suas cadeiras finalizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {completedCourses.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                  <Award className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  Ainda não tem cadeiras concluídas.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedCourses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                        <BookOpen className="h-5 w-5 text-success" />
                      </div>
                      <div>
                        <p className="font-medium">{course.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {course.codigo} • {course.ano}º ano
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-success">
                        {course.notaFinal}
                      </p>
                      <p className="text-xs text-muted-foreground">valores</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
