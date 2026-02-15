import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/AppStore";
import { finalGrade, globalStats } from "@/lib/calculations";
import type { AppState, Course } from "@/lib/types";
import { getPlanCoursesForDegree, getCourseArea } from "@/lib/uabPlan";

function sortByCompletedAtDesc(a: Course, b: Course) {
  return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
}

function pluralCadeiras(n: number) {
  return n === 1 ? "cadeira" : "cadeiras";
}

function SemesterPanel({
  title,
  courses,
  state,
  planCourses,
}: {
  title: string;
  courses: Course[];
  state: AppState;
  planCourses: import("@/lib/uabPlan").PlanCourseSeed[];
}) {
  const sorted = [...courses].sort(sortByCompletedAtDesc);

  return (
    <div className="rounded-lg border">
      <div className="border-b bg-muted/30 px-4 py-2 text-sm font-semibold">
        {title}
      </div>

      <div className="space-y-3 p-3">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sem cadeiras concluídas neste semestre.
          </div>
        ) : (
          sorted.map((c) => {
            const fin = finalGrade(state, c.id);

            return (
              <div key={c.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{c.name}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {c.code}
                      {getCourseArea(planCourses, c.code) && (
                        <span className="italic"> • {getCourseArea(planCourses, c.code)}</span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-xl font-semibold">
                    {fin ?? "—"}
                  </div>
                </div>

                {c.completedAt && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Concluída em{" "}
                    {new Date(c.completedAt).toLocaleDateString("pt-PT")}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { state } = useAppStore();
  const stats = globalStats(state);
  const planCourses = useMemo(() => getPlanCoursesForDegree(state.degree), [state.degree]);

  const completed = state.courses.filter((c) => c.isCompleted);

  const grouped = completed.reduce((acc, c) => {
    const y = Number(c.year) || 0;
    const s = c.semester === 2 ? 2 : 1; // fallback seguro

    if (!acc[y]) acc[y] = { 1: [], 2: [] };
    acc[y][s].push(c);

    return acc;
  }, {} as Record<number, { 1: Course[]; 2: Course[] }>);

  const years = Object.keys(grouped)
    .map(Number)
    .filter((y) => y > 0)
    .sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <div className="text-2xl font-semibold">Histórico</div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Cadeiras Concluídas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {stats.completed}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Média Global
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.avg}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Melhor Nota
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {stats.best ?? "—"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cadeiras Concluídas</CardTitle>
          <div className="text-sm text-muted-foreground">
            Histórico das suas cadeiras finalizadas
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {completed.length === 0 ? (
            <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
              Ainda não tem cadeiras concluídas.
            </div>
          ) : (
            years.map((year) => {
              const sem1 = grouped[year]?.[1] ?? [];
              const sem2 = grouped[year]?.[2] ?? [];
              const totalYear = sem1.length + sem2.length;

              return (
                <div key={year} className="rounded-xl border p-4 md:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-lg font-semibold">{year}º Ano</div>
                    <div className="text-sm text-muted-foreground">
                      {totalYear} {pluralCadeiras(totalYear)}
                    </div>
                  </div>

                  {/* Em mobile fica 1 coluna (melhor legibilidade); em desktop vira 2 colunas como na grelha do plano */}
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <SemesterPanel title="1º Semestre" courses={sem1} state={state} planCourses={planCourses} />
                    <SemesterPanel title="2º Semestre" courses={sem2} state={state} planCourses={planCourses} />
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
