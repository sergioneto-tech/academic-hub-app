import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { useAppStore } from "@/lib/AppStore";
import { courseStatusLabel, exam as getExam, finalGradeRaw, finalGradeRounded, getAssessments, getRules, needsResit, resit as getResit, totalEFolios, totalEFoliosMax } from "@/lib/calculations";
import { formatPtNumber, parsePtNumber } from "@/lib/utils";

function DateField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PtNumberInput({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: number | null;
  placeholder?: string;
  onCommit: (v: number | null) => void;
}) {
  const [txt, setTxt] = useState<string>("");

  useEffect(() => {
    setTxt(value === null ? "" : formatPtNumber(value));
  }, [value]);

  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        inputMode="decimal"
        placeholder={placeholder}
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => onCommit(parsePtNumber(txt))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </div>
  );
}

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, ensureAssessment, setAssessmentDate, setAssessmentGrade, setAssessmentMaxPoints, markCourseCompleted } = useAppStore();

  const course = useMemo(() => state.courses.find((c) => c.id === id), [state.courses, id]);
  const rules = useMemo(() => (id ? getRules(state, id) : null), [state, id]);

  // garantir itens padrão (para não ficar vazio)
  useEffect(() => {
    if (!id) return;
    ensureAssessment(id, "efolio", "e-fólio A");
    ensureAssessment(id, "efolio", "e-fólio B");
    ensureAssessment(id, "exam", "p-fólio");
    ensureAssessment(id, "resit", "recurso");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const efolios = useMemo(() => (id ? getAssessments(state, id, "efolio") : []), [state, id]);
  const exam = useMemo(() => (id ? getExam(state, id) : null), [state, id]);
  const resit = useMemo(() => (id ? getResit(state, id) : null), [state, id]);

  const efTotal = useMemo(() => (id ? totalEFolios(state, id) : 0), [state, id]);
  const efMax = useMemo(() => (id ? totalEFoliosMax(state, id) : 0), [state, id]);

  const finRaw = useMemo(() => (id ? finalGradeRaw(state, id) : null), [state, id]);
  const finRounded = useMemo(() => (id ? finalGradeRounded(state, id) : null), [state, id]);

  const status = useMemo(() => (id ? courseStatusLabel(state, id) : { label: "—", badge: "neutral" as const }), [state, id]);
  const showResit = useMemo(() => (id ? needsResit(state, id) : false), [state, id]);

  if (!course || !id || !rules) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Cadeira não encontrada.</p>
        <Button className="mt-4" onClick={() => navigate("/cadeiras")}>Voltar</Button>
      </div>
    );
  }

  const badgeClass =
  status.badge === "success"
    ? "bg-emerald-100 text-emerald-900 border-emerald-200"
    : status.badge === "warning"
    ? "bg-sky-100 text-sky-900 border-sky-200"
    : status.badge === "danger"
    ? "bg-rose-100 text-rose-900 border-rose-200"
    : "bg-slate-100 text-slate-900 border-slate-200";

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Button variant="ghost" className="-ml-2 mb-2" onClick={() => navigate(-1)}>
            ← Voltar
          </Button>
          <h1 className="text-xl md:text-2xl font-semibold leading-tight">
            {course.code} — {course.name}
          </h1>
        </div>
        <div className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${badgeClass}`}>
          {status.label}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="bg-white/70 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">E‑fólios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">
              {formatPtNumber(efTotal)} <span className="text-sm text-muted-foreground">/ {formatPtNumber(efMax)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo para exame: {formatPtNumber(rules.minAptoExame)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Exame</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">
              {formatPtNumber(exam?.grade ?? null) || "—"}{" "}
              <span className="text-sm text-muted-foreground">/ {formatPtNumber(exam?.maxPoints ?? 12)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Mínimo no exame: {formatPtNumber(rules.minExame)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Nota final</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">
              {finRounded === null ? "—" : String(finRounded)}{" "}
              <span className="text-sm text-muted-foreground">/ 20</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Cálculo: {finRaw === null ? "—" : `${formatPtNumber(finRaw)} → arredonda para ${finRounded}`}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/70 backdrop-blur">
        <CardHeader>
          <CardTitle>E‑fólios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {efolios.map((a) => (
            <div key={a.id} className="rounded-lg border p-3 md:p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.endDate ? `Até ${a.endDate}` : "Defina as datas para lembretes/planeamento."}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 md:flex md:gap-3 md:items-end">
                  <PtNumberInput
                    label="Valor (pts)"
                    value={a.maxPoints}
                    placeholder="4"
                    onCommit={(v) => {
                      if (v === null) return;
                      setAssessmentMaxPoints(a.id, v);
                    }}
                  />
                  <PtNumberInput
                    label="Nota"
                    value={a.grade}
                    placeholder="0,00"
                    onCommit={(v) => setAssessmentGrade(a.id, v)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DateField
                  label="Início"
                  value={a.startDate}
                  onChange={(v) => setAssessmentDate(a.id, { startDate: v })}
                />
                <DateField
                  label="Fim"
                  value={a.endDate}
                  onChange={(v) => setAssessmentDate(a.id, { endDate: v })}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-white/70 backdrop-blur">
        <CardHeader>
          <CardTitle>p‑Fólio (Exame)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!exam ? (
            <p className="text-sm text-muted-foreground">A criar exame…</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <DateField
                label="Data do exame"
                value={exam.date}
                onChange={(v) => setAssessmentDate(exam.id, { date: v })}
              />

              <PtNumberInput
                label="Valor total (pts)"
                value={exam.maxPoints}
                placeholder="12"
                onCommit={(v) => {
                  if (v === null) return;
                  setAssessmentMaxPoints(exam.id, v);
                }}
              />

              <PtNumberInput
                label="Nota obtida"
                value={exam.grade}
                placeholder="0,00"
                onCommit={(v) => setAssessmentGrade(exam.id, v)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/70 backdrop-blur">
        <CardHeader>
          <CardTitle>Recurso</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Disponível porque não tem aptidão para exame ou não atingiu a nota mínima no exame.
          </p>

          {!resit ? (
            <p className="text-sm text-muted-foreground">A criar recurso…</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <DateField
                  label="Data do recurso"
                  value={resit.date}
                  onChange={(v) => setAssessmentDate(resit.id, { date: v })}
                />

                <PtNumberInput
                  label="Valor total (pts)"
                  value={resit.maxPoints}
                  placeholder="20"
                  onCommit={(v) => {
                    if (v === null) return;
                    setAssessmentMaxPoints(resit.id, v);
                  }}
                />

                <PtNumberInput
                  label="Nota obtida"
                  value={resit.grade}
                  placeholder="0,00"
                  onCommit={(v) => setAssessmentGrade(resit.id, v)}
                />
              </div>

              {!showResit && (
                <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
                  Neste momento, o recurso não é necessário. Podes deixar estes campos vazios.
                </div>
              )}
            </>
          )}

          <Separator />

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Dica: podes marcar a cadeira como concluída quando estiveres satisfeito com a nota final.
            </div>
            <Button
              variant="secondary"
              onClick={() => markCourseCompleted(course.id)}
            >
              Marcar como concluída
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
