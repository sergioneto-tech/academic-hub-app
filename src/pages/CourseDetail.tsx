import { useParams, useNavigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppState } from "@/hooks/useAppState";
import { getCourseStatus, totalEFolios, calculateNotaFinal } from "@/lib/calculations";
import { ArrowLeft, BookOpen, FileText, GraduationCap, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, updateAssessment, markCourseComplete } = useAppState();

  const course = state.activeCourses.find((c) => c.id === id);
  const assessments = state.assessments.filter((a) => a.courseId === id);
  const rules = state.rules.find((r) => r.courseId === id) || {
    courseId: id!,
    minAptoExame: 3.5,
    minExame: 5.5,
    formulaFinal: "somaSimples" as const,
  };

  if (!course) {
    return (
      <Layout title="Cadeira não encontrada">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Esta cadeira não foi encontrada.</p>
          <Button asChild variant="outline">
            <Link to="/cadeiras">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar às Cadeiras
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const status = getCourseStatus(assessments, rules, course.concluida);
  const totalEF = totalEFolios(assessments);
  const notaFinal = calculateNotaFinal(assessments, rules);
  const efolios = assessments.filter((a) => a.tipo === "efolio");
  const exame = assessments.find((a) => a.tipo === "exame");

  const handleNotaChange = (assessmentId: string, value: string) => {
    const nota = parseFloat(value);
    if (value === "" || value === undefined) {
      updateAssessment(assessmentId, { nota: undefined });
    } else if (!isNaN(nota) && nota >= 0 && nota <= 20) {
      updateAssessment(assessmentId, { nota });
    }
  };

  const handleMarkComplete = () => {
    if (notaFinal !== undefined) {
      markCourseComplete(course.id, notaFinal);
      toast({
        title: "Cadeira concluída",
        description: `${course.nome} foi movida para o histórico.`,
      });
      navigate("/historico");
    }
  };

  return (
    <Layout title={course.nome}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Button variant="ghost" asChild className="-ml-2">
            <Link to="/cadeiras">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
          <StatusBadge status={status} className="self-start sm:self-auto" />
        </div>

        {/* Course Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>{course.nome}</CardTitle>
                <CardDescription>
                  {course.codigo} • {course.ano}º ano • {course.semestre}º semestre
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">Total e-fólios</p>
                <p className="text-2xl font-bold text-primary">{totalEF.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Mínimo: {rules.minAptoExame}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4 text-center">
                <p className="text-sm text-muted-foreground">Nota Exame</p>
                <p className="text-2xl font-bold">{exame?.nota?.toFixed(1) ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Mínimo: {rules.minExame}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-4 text-center">
                <p className="text-sm text-muted-foreground">Nota Final</p>
                <p className="text-2xl font-bold text-primary">{notaFinal ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Aprovação: ≥10</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* e-Fólios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              e-Fólios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {efolios.map((efolio) => (
              <div 
                key={efolio.id} 
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border"
              >
                <div>
                  <p className="font-medium">{efolio.nome}</p>
                  {efolio.dataFim && (
                    <p className="text-sm text-muted-foreground">
                      Até {new Date(efolio.dataFim).toLocaleDateString("pt-PT")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`nota-${efolio.id}`} className="sr-only">Nota</Label>
                  <Input
                    id={`nota-${efolio.id}`}
                    type="number"
                    min="0"
                    max={efolio.maxNota}
                    step="0.1"
                    value={efolio.nota ?? ""}
                    onChange={(e) => handleNotaChange(efolio.id, e.target.value)}
                    className="w-24 text-center"
                    placeholder="—"
                  />
                  <span className="text-sm text-muted-foreground">/ {efolio.maxNota}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Exame */}
        {exame && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="h-5 w-5 text-primary" />
                p-Fólio (Exame)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border">
                <div>
                  <p className="font-medium">{exame.nome}</p>
                  {exame.dataExame && (
                    <p className="text-sm text-muted-foreground">
                      {new Date(exame.dataExame).toLocaleDateString("pt-PT")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`nota-${exame.id}`} className="sr-only">Nota</Label>
                  <Input
                    id={`nota-${exame.id}`}
                    type="number"
                    min="0"
                    max={exame.maxNota}
                    step="0.1"
                    value={exame.nota ?? ""}
                    onChange={(e) => handleNotaChange(exame.id, e.target.value)}
                    className="w-24 text-center"
                    placeholder="—"
                  />
                  <span className="text-sm text-muted-foreground">/ {exame.maxNota}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {notaFinal !== undefined && notaFinal >= 10 && !course.concluida && (
          <div className="flex justify-end">
            <Button onClick={handleMarkComplete} size="lg">
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar como Concluída
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
