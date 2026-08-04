import { useMemo } from "react";
import { ArrowLeft, FileText, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/AppStore";
import {
  finalGradeRounded,
  getAssessments,
  getCourseStatus,
} from "@/lib/calculations";
import { formatPtDate } from "@/lib/date";
import type { Course } from "@/lib/types";
import {
  getCourseArea,
  getCourseEcts,
  getPlanCoursesForDegree,
} from "@/lib/uabPlan";
import { formatPtNumber } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";

function assessmentLabel(type: string): string {
  const labels: Record<string, string> = {
    efolio: "e-fólio",
    activity: "Atividade",
    project: "Projeto",
    presentation: "Apresentação",
    discussion: "Discussão",
    exam: "Exame / prova final",
    resit: "Recurso",
    other: "Outro",
  };
  return labels[type] ?? type;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  return formatPtDate(value.slice(0, 10));
}

function sortCourses(a: Course, b: Course): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.semester !== b.semester) return a.semester - b.semester;
  return a.code.localeCompare(b.code, "pt-PT");
}

export default function AcademicReportPage() {
  const navigate = useNavigate();
  const { state } = useAppStore();
  const planCourses = useMemo(() => getPlanCoursesForDegree(state.degree), [state.degree]);
  const completed = useMemo(
    () => state.courses.filter((course) => course.isCompleted).sort(sortCourses),
    [state.courses],
  );

  const years = useMemo(
    () => [...new Set(completed.map((course) => course.year))].filter((year) => year > 0).sort((a, b) => a - b),
    [completed],
  );

  const completedEcts = completed.reduce(
    (total, course) => total + getCourseEcts(planCourses, course.code),
    0,
  );
  const grades = completed
    .map((course) => finalGradeRounded(state, course.id))
    .filter((grade): grade is number => grade !== null);
  const average = grades.length > 0
    ? grades.reduce((total, grade) => total + grade, 0) / grades.length
    : null;
  const generatedAt = new Date();

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Button variant="ghost" className="w-fit" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir ou guardar em PDF
        </Button>
      </div>

      <header className="premium-surface p-5 sm:p-7 print:border-0 print:p-0 print:shadow-none">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary print:hidden">
            <FileText className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Academic Hub</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Relatório académico pessoal</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {state.profile?.displayName?.trim() || "Aluno"} · {state.degree?.name || "Licenciatura não identificada"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Gerado em {generatedAt.toLocaleDateString("pt-PT")} às {generatedAt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3 print:grid-cols-3">
        <Card className="premium-card print:shadow-none">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Cadeiras concluídas</div>
            <div className="mt-1 text-2xl font-semibold">{completed.length}</div>
          </CardContent>
        </Card>
        <Card className="premium-card print:shadow-none">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">ECTS concluídos</div>
            <div className="mt-1 text-2xl font-semibold">{completedEcts}</div>
          </CardContent>
        </Card>
        <Card className="premium-card print:shadow-none">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Média das concluídas</div>
            <div className="mt-1 text-2xl font-semibold">{average === null ? "—" : formatPtNumber(average)}</div>
          </CardContent>
        </Card>
      </section>

      {completed.length === 0 ? (
        <Card className="premium-card print:shadow-none">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Ainda não existem cadeiras concluídas para incluir no relatório.
          </CardContent>
        </Card>
      ) : years.map((year) => (
        <section key={year} className="space-y-4 break-inside-avoid-page">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-xl font-semibold">{year}º ano</h2>
            <span className="text-xs text-muted-foreground">
              {completed.filter((course) => course.year === year).length} cadeiras
            </span>
          </div>

          {[1, 2].map((semester) => {
            const semesterCourses = completed.filter(
              (course) => course.year === year && course.semester === semester,
            );
            if (semesterCourses.length === 0) return null;

            return (
              <div key={semester} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {semester}º semestre
                </h3>

                {semesterCourses.map((course) => {
                  const assessments = getAssessments(state, course.id);
                  const coursework = assessments.filter((item) => item.type !== "exam" && item.type !== "resit");
                  const exam = assessments.find((item) => item.type === "exam") ?? null;
                  const resit = assessments.find((item) => item.type === "resit") ?? null;
                  const final = finalGradeRounded(state, course.id);
                  const status = getCourseStatus(state, course.id);
                  const ects = getCourseEcts(planCourses, course.code);
                  const area = getCourseArea(planCourses, course.code);

                  return (
                    <Card key={course.id} className="premium-card break-inside-avoid print:shadow-none">
                      <CardHeader className="pb-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between print:flex-row">
                          <div>
                            <CardTitle className="text-base">{course.name}</CardTitle>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {course.code} · {ects} ECTS{area ? ` · ${area}` : ""}
                            </p>
                          </div>
                          <div className="text-left sm:text-right print:text-right">
                            <div className="text-xs text-muted-foreground">Nota final</div>
                            <div className="text-2xl font-semibold">{final ?? "—"}</div>
                            <div className="text-[11px] text-muted-foreground">{status.label}</div>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div>
                          <div className="mb-2 text-xs font-semibold text-muted-foreground">Avaliação durante o semestre</div>
                          {coursework.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sem elementos intercalares registados.</p>
                          ) : (
                            <div className="overflow-hidden rounded-lg border">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-muted/40 text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2 font-medium">Elemento</th>
                                    <th className="px-3 py-2 font-medium">Tipo</th>
                                    <th className="px-3 py-2 font-medium">Data</th>
                                    <th className="px-3 py-2 text-right font-medium">Nota</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {coursework.map((item) => (
                                    <tr key={item.id} className="border-t">
                                      <td className="px-3 py-2">{item.name}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{assessmentLabel(item.type)}</td>
                                      <td className="px-3 py-2 text-muted-foreground">{formatDate(item.endDate || item.date)}</td>
                                      <td className="px-3 py-2 text-right font-medium">
                                        {item.grade === null ? "—" : `${formatPtNumber(item.grade)} / ${formatPtNumber(item.maxPoints)}`}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 print:grid-cols-3">
                          <div className="rounded-lg border p-3">
                            <div className="text-[11px] text-muted-foreground">Exame / prova final</div>
                            <div className="mt-1 font-semibold">
                              {exam?.grade === null || !exam ? "—" : `${formatPtNumber(exam.grade)} / ${formatPtNumber(exam.maxPoints)}`}
                            </div>
                            <div className="mt-1 text-[10px] text-muted-foreground">{formatDate(exam?.date)}</div>
                          </div>
                          <div className="rounded-lg border p-3">
                            <div className="text-[11px] text-muted-foreground">Recurso</div>
                            <div className="mt-1 font-semibold">
                              {resit?.grade === null || !resit ? "—" : `${formatPtNumber(resit.grade)} / ${formatPtNumber(resit.maxPoints)}`}
                            </div>
                            <div className="mt-1 text-[10px] text-muted-foreground">{formatDate(resit?.date)}</div>
                          </div>
                          <div className="rounded-lg border p-3">
                            <div className="text-[11px] text-muted-foreground">Conclusão</div>
                            <div className="mt-1 font-semibold">{formatDate(course.completedAt)}</div>
                            <div className="mt-1 text-[10px] text-muted-foreground">Registo pessoal</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })}
        </section>
      ))}

      <footer className="rounded-xl border border-warning/35 bg-warning/10 p-4 text-xs leading-5 text-muted-foreground print:mt-5">
        <strong className="text-foreground">Documento pessoal e não oficial.</strong>{" "}
        Este relatório é gerado a partir dos dados registados pelo utilizador no Academic Hub. Não substitui certidões,
        pautas, declarações, históricos ou certificados emitidos pela Universidade Aberta. Versão da aplicação: {APP_VERSION}.
      </footer>
    </div>
  );
}
