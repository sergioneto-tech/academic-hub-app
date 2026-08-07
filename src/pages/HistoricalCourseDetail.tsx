import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, History, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/AppStore";
import type { LegacyEvaluationMode } from "@/lib/types";
import { formatPtNumber, parsePtNumber } from "@/lib/utils";

function GradeInput({ value, max, onCommit }: { value: number | null; max: number; onCommit: (value: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : formatPtNumber(value));
  useEffect(() => setText(value === null ? "" : formatPtNumber(value)), [value]);
  return (
    <Input
      inputMode="decimal"
      value={text}
      placeholder={`0–${formatPtNumber(max)}`}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => onCommit(parsePtNumber(text))}
      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
    />
  );
}

export default function HistoricalCourseDetail({ courseId, mode }: { courseId: string; mode: Exclude<LegacyEvaluationMode, "efolios-exam"> }) {
  const navigate = useNavigate();
  const { state, updateCourse, addAssessment, updateAssessment, removeAssessment, markCourseCompleted } = useAppStore();
  const course = state.courses.find((item) => item.id === courseId);
  const items = useMemo(
    () => state.assessments.filter((item) => item.courseId === courseId && item.type !== "resit").sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    [state.assessments, courseId],
  );

  useEffect(() => {
    if (mode !== "exam-only") return;
    const exam = items.find((item) => item.type === "exam");
    if (!exam) {
      addAssessment(courseId, { type: "exam", name: "Exame / prova final", maxPoints: 20, grade: null, mode: "synchronous", required: true });
    } else if (exam.maxPoints !== 20) {
      updateAssessment(exam.id, { maxPoints: 20, required: true });
    }
  }, [mode, courseId, items, addAssessment, updateAssessment]);

  if (!course) return null;

  const relevant = mode === "exam-only" ? items.filter((item) => item.type === "exam") : items;
  const totalMax = relevant.reduce((sum, item) => sum + (item.required === false ? 0 : item.maxPoints), 0);
  const totalGrade = relevant.reduce((sum, item) => sum + (item.required === false ? 0 : (item.grade ?? 0)), 0);
  const allGraded = relevant.length > 0 && relevant.filter((item) => item.required !== false).every((item) => item.grade !== null);
  const computedFinal = allGraded && Math.abs(totalMax - 20) < 0.001 ? Math.round(totalGrade) : null;
  const final = mode === "final-grade-only" ? (course.manualFinalGrade ?? null) : computedFinal;
  const passed = final !== null && final >= 10;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <Button variant="ghost" className="-ml-2" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{course.code} — {course.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Registo histórico da avaliação desta cadeira.</p>
      </div>

      {mode === "final-grade-only" ? (
        <Card className="premium-card">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-5 w-5 text-primary" />Nota final conhecida</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Usa esta opção quando conheces a classificação final mas já não existe informação fiável sobre a composição da avaliação.</p>
            <div className="max-w-xs">
              <Label>Nota final (0–20)</Label>
              <GradeInput value={course.manualFinalGrade ?? null} max={20} onCommit={(value) => updateCourse(course.id, { manualFinalGrade: value === null ? undefined : Math.max(0, Math.min(20, value)) })} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="premium-card">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">{mode === "exam-only" ? "Exame / prova final" : "Elementos da avaliação histórica"}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{mode === "exam-only" ? "A classificação resulta exclusivamente da prova final." : "Adiciona apenas os elementos que realmente existiram: teste, trabalho, exame, projeto ou outro."}</p>
            </div>
            {mode === "custom" && <Button variant="outline" onClick={() => addAssessment(courseId, { type: "other", name: `Elemento ${items.length + 1}`, maxPoints: 0, grade: null, required: true })}><Plus className="mr-2 h-4 w-4" />Adicionar elemento</Button>}
          </CardHeader>
          <CardContent className="space-y-3">
            {relevant.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_130px_130px_auto] sm:items-end">
                <div><Label>Nome</Label><Input value={item.name} onChange={(event) => updateAssessment(item.id, { name: event.target.value })} disabled={mode === "exam-only"} /></div>
                <div><Label>Cotação</Label><GradeInput value={item.maxPoints} max={20} onCommit={(value) => updateAssessment(item.id, { maxPoints: value ?? 0 })} /></div>
                <div><Label>Nota</Label><GradeInput value={item.grade} max={item.maxPoints} onCommit={(value) => updateAssessment(item.id, { grade: value })} /></div>
                {mode === "custom" && <Button variant="ghost" size="icon" onClick={() => removeAssessment(item.id)} aria-label={`Remover ${item.name}`}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))}
            <div className={`rounded-xl border p-3 text-sm ${Math.abs(totalMax - 20) < 0.001 ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
              Cotação total: <strong>{formatPtNumber(totalMax)} / 20</strong>{Math.abs(totalMax - 20) >= 0.001 && " — ajusta as cotações para totalizarem 20 valores."}
            </div>
          </CardContent>
        </Card>
      )}

      {final !== null && (
        <Card className={passed ? "border-emerald-500/35 bg-emerald-500/5" : "border-amber-500/35 bg-amber-500/5"}>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 font-semibold">{passed && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}{passed ? "Cadeira aprovada" : "Classificação registada"}</div>
              <div className="mt-1 text-3xl font-bold">{formatPtNumber(final)} <span className="text-base font-medium text-muted-foreground">/ 20 valores</span></div>
            </div>
            {passed && !course.isCompleted && <Button onClick={() => { markCourseCompleted(course.id); navigate("/", { replace: true }); }}>Concluir cadeira</Button>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
