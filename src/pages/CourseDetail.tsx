import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "@/lib/AppStore";
import { courseStatusLabel, finalGrade, getAssessments, getRules, needsResit, totalEFolios } from "@/lib/calculations";

export default function CourseDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const { state, setAssessmentGrade, setAssessmentDate, ensureAssessment, markCourseCompleted } = useAppStore();

  const course = state.courses.find(c => c.id === id);
  const rules = course ? getRules(state, course.id) : null;

  const efolios = useMemo(() => (course ? getAssessments(state, course.id, "efolio") : []), [state, course]);
  const exame = useMemo(() => (course ? getAssessments(state, course.id, "exame")[0] : undefined), [state, course]);
  const showResit = course ? needsResit(state, course.id) : false;

  const recursoId = useMemo(() => {
    if (!course || !showResit) return null;
    return ensureAssessment(course.id, "recurso", "Recurso");
  }, [course, showResit, ensureAssessment]);

  if (!course || !rules) {
    return <div className="text-sm text-muted-foreground">Cadeira não encontrada.</div>;
  }

  const efTotal = totalEFolios(state, course.id);
  const fin = finalGrade(state, course.id);
  const st = courseStatusLabel(state, course.id);

  const canComplete = st.label === "Aprovado" && !course.isCompleted;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => nav(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        <Badge variant={st.variant === "success" ? "default" : st.variant === "warning" ? "secondary" : "destructive"}>
          {st.label}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{course.name}</CardTitle>
          <div className="text-sm text-muted-foreground">
            {course.code} • {course.year}º ano • {course.semester}º semestre
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4 text-center">
            <div className="text-sm text-muted-foreground">Total e-fólios</div>
            <div className="text-3xl font-semibold">{efTotal.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Mínimo: {rules.minAptoExame}</div>
          </div>

          <div className="rounded-lg border p-4 text-center">
            <div className="text-sm text-muted-foreground">Nota Exame</div>
            <div className="text-3xl font-semibold">{typeof exame?.grade === "number" ? exame.grade : "—"}</div>
            <div className="text-xs text-muted-foreground">Mínimo: {rules.minExame}</div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4 text-center">
            <div className="text-sm text-muted-foreground">Nota Final</div>
            <div className="text-3xl font-semibold">{fin ?? "—"}</div>
            <div className="text-xs text-muted-foreground">Aprovação: ≥10</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>e-Fólios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {efolios.map(a => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <div className="font-medium">{a.name}</div>
                <div className="text-sm text-muted-foreground">
                  {a.endDate ? `Até ${new Date(a.endDate).toLocaleDateString("pt-PT")}` : "Sem data"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  className="w-24 text-right"
                  inputMode="decimal"
                  value={typeof a.grade === "number" ? String(a.grade).replace(".", ",") : ""}
                  placeholder="—"
                  onChange={(e) => {
                    const v = e.target.value.replace(",", ".");
                    const n = v.trim() === "" ? null : Number(v);
                    if (n === null || Number.isFinite(n)) setAssessmentGrade(a.id, n);
                  }}
                />
                <div className="text-sm text-muted-foreground">/ {a.maxGrade ?? 2}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>p-Fólio (Exame)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!exame ? (
            <div className="text-sm text-muted-foreground">Sem exame configurado.</div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <div className="font-medium">{exame.name}</div>
                <div className="text-sm text-muted-foreground">
                  {exame.date ? new Date(exame.date).toLocaleDateString("pt-PT") : "Sem data"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  className="w-24 text-right"
                  inputMode="decimal"
                  value={typeof exame.grade === "number" ? String(exame.grade).replace(".", ",") : ""}
                  placeholder="—"
                  onChange={(e) => {
                    const v = e.target.value.replace(",", ".");
                    const n = v.trim() === "" ? null : Number(v);
                    if (n === null || Number.isFinite(n)) setAssessmentGrade(exame.id, n);
                  }}
                />
                <div className="text-sm text-muted-foreground">/ {exame.maxGrade ?? 16}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RECURSO: só aparece quando necessário */}
      {showResit && recursoId && (
        <Card>
          <CardHeader>
            <CardTitle>Recurso</CardTitle>
            <div className="text-sm text-muted-foreground">
              Disponível porque não tem aptidão para exame ou não atingiu a nota mínima no exame.
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded-lg border p-4">
              <div>
                <div className="font-medium">Data do recurso</div>
                <div className="text-sm text-muted-foreground">Defina a data para lembretes/planeamento.</div>
              </div>
              <Input
                type="date"
                className="w-full md:w-52"
                value={state.assessments.find(a => a.id === recursoId)?.date ?? ""}
                onChange={(e) => setAssessmentDate(recursoId, { date: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end">
        <Button disabled={!canComplete} onClick={() => markCourseCompleted(course.id)}>
          Marcar como concluída
        </Button>
      </div>
    </div>
  );
}
