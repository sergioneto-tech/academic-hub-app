import { useMemo } from "react";
import { useAppStore } from "@/lib/AppStore";
import { getPlanCoursesForDegree } from "@/lib/uabPlan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Download, BookOpen, CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { buildIcsForActiveCourses, downloadIcs, suggestIcsFilename } from "@/lib/ics";
import { Link } from "react-router-dom";

export default function StudyPlan() {
  const { state } = useAppStore();

  const planCourses = useMemo(() => getPlanCoursesForDegree(state.degree), [state.degree]);

  const coursesByYearSemester = useMemo(() => {
    const map = new Map<string, typeof planCourses>();
    for (const pc of planCourses) {
      const key = `${pc.year}-${pc.semester}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pc);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, courses]) => {
        const [year, semester] = key.split("-").map(Number);
        return { year, semester, courses };
      });
  }, [planCourses]);

  const stats = useMemo(() => {
    const total = planCourses.length;
    const completed = planCourses.filter((pc) =>
      state.courses.some((c) => c.code === pc.code && c.isCompleted)
    ).length;
    const active = planCourses.filter((pc) =>
      state.courses.some((c) => c.code === pc.code && c.isActive && !c.isCompleted)
    ).length;
    return { total, completed, active, percent: total ? Math.round((completed / total) * 100) : 0 };
  }, [planCourses, state.courses]);

  const getCourseStatus = (code: string) => {
    const c = state.courses.find((x) => x.code === code);
    if (!c) return "pending";
    if (c.isCompleted) return "completed";
    if (c.isActive) return "active";
    return "pending";
  };

  const handleExportIcs = () => {
    const ics = buildIcsForActiveCourses(state);
    downloadIcs(suggestIcsFilename(), ics);
  };

  if (!state.degree || planCourses.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Plano de Estudos</h1>
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              Seleciona uma licenciatura nas <Link to="/definicoes" className="text-primary underline">definições</Link> para ver o plano de estudos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plano de Estudos</h1>
          <p className="text-sm text-muted-foreground mt-1">{state.degree.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportIcs}>
            <Download className="h-4 w-4 mr-2" />
            Exportar .ics
          </Button>
          <Button variant="default" size="sm" asChild>
            <Link to="/plano/estudo">Plano Pessoal</Link>
          </Button>
        </div>
      </div>

      {/* Progress overview */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Progresso do curso</span>
            <span className="text-muted-foreground">
              {stats.completed}/{stats.total} cadeiras ({stats.percent}%)
            </span>
          </div>
          <Progress value={stats.percent} className="h-3" />
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-[hsl(var(--success))]" /> {stats.completed} concluídas
            </span>
            <span className="flex items-center gap-1">
              <PlayCircle className="h-3 w-3 text-primary" /> {stats.active} ativas
            </span>
            <span className="flex items-center gap-1">
              <Circle className="h-3 w-3" /> {stats.total - stats.completed - stats.active} por fazer
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Year/Semester grid */}
      {coursesByYearSemester.map(({ year, semester, courses }) => (
        <Card key={`${year}-${semester}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {year}º Ano — {semester}º Semestre
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {courses.map((pc) => {
              const status = getCourseStatus(pc.code);
              return (
                <div
                  key={pc.code}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    status === "completed"
                      ? "bg-[hsl(var(--success)/0.08)] border-[hsl(var(--success)/0.3)]"
                      : status === "active"
                      ? "bg-primary/5 border-primary/20"
                      : "bg-card border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))] shrink-0" />
                    ) : status === "active" ? (
                      <PlayCircle className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-sm text-foreground">{pc.name}</p>
                      <p className="text-xs text-muted-foreground">{pc.code}</p>
                    </div>
                  </div>
                  <Badge
                    variant={status === "completed" ? "default" : status === "active" ? "secondary" : "outline"}
                    className={
                      status === "completed"
                        ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]"
                        : ""
                    }
                  >
                    {status === "completed" ? "Concluída" : status === "active" ? "Ativa" : "Por fazer"}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
