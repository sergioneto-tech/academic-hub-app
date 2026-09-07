import { useMemo, useState } from "react";
import { BookPlus, ExternalLink, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { useAppStore } from "@/lib/AppStore";

function nextExtraCode(existingCodes: string[]) {
  const used = new Set(existingCodes.map((code) => code.trim().toUpperCase()));
  for (let index = 1; index < 100; index += 1) {
    const candidate = `EXT-${String(index).padStart(2, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  return `EXT-${Date.now().toString().slice(-4)}`;
}

export default function ExtracurricularCoursesCard() {
  const { state, addCourse, updateCourse, removeCourse } = useAppStore();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [year, setYear] = useState(1);
  const [semester, setSemester] = useState(1);

  const extras = useMemo(
    () => state.courses.filter((course) => course.isExtracurricular).sort((a, b) => a.name.localeCompare(b.name, "pt-PT")),
    [state.courses],
  );

  const addExtra = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: "Indica o nome da cadeira", description: "Ex.: Matemática Preparatória.", variant: "destructive" });
      return;
    }

    const finalCode = code.trim() || nextExtraCode(state.courses.map((course) => course.code));
    addCourse({
      code: finalCode,
      name: trimmedName,
      year,
      semester,
      isExtracurricular: true,
    });
    setName("");
    setCode("");
    toast({
      title: "Cadeira extracurricular adicionada",
      description: "Podes ativá-la e registar avaliações, datas e notas sem alterar a média ou os ECTS oficiais do curso.",
    });
  };

  return (
    <Card className="premium-card border-primary/25">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookPlus className="h-4 w-4 text-primary" />
          Cadeiras extracurriculares
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Para unidades complementares, como Matemática Preparatória. Podem ter avaliações, datas, notas e conclusão, mas não contam para a média, ECTS ou progresso oficial da licenciatura.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-xl border bg-muted/15 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="extra-course-name">Nome</Label>
            <Input id="extra-course-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Matemática Preparatória" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="extra-course-code">Código (opcional)</Label>
            <Input id="extra-course-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Gerado automaticamente" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="extra-course-year">Ano</Label>
              <Input id="extra-course-year" type="number" min={1} max={6} value={year} onChange={(event) => setYear(Math.min(6, Math.max(1, Number(event.target.value) || 1)))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extra-course-semester">Sem.</Label>
              <select id="extra-course-semester" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={semester} onChange={(event) => setSemester(Number(event.target.value))}>
                <option value={1}>1.º</option>
                <option value={2}>2.º</option>
              </select>
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="button" onClick={addExtra}>
              <BookPlus className="mr-2 h-4 w-4" />
              Adicionar extracurricular
            </Button>
          </div>
        </div>

        {extras.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Ainda não existem cadeiras extracurriculares.
          </div>
        ) : (
          <div className="space-y-2">
            {extras.map((course) => (
              <div key={course.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="truncate text-sm">{course.name}</strong>
                    <Badge variant="outline">Extracurricular</Badge>
                    <Badge variant="secondary">0 ECTS oficiais</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {course.code || "Sem código"} · {course.year}.º ano · {course.semester}.º semestre
                    {course.isCompleted ? " · Concluída" : course.isActive ? " · Ativa" : " · Inativa"}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!course.isCompleted && (
                    <label className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
                      <Switch checked={course.isActive} onCheckedChange={(checked) => updateCourse(course.id, { isActive: checked })} />
                      Ativa
                    </label>
                  )}
                  <Button asChild type="button" size="sm" variant="outline">
                    <Link to={`/cadeiras/${course.id}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (!window.confirm(`Eliminar ${course.name}? As avaliações e notas desta cadeira também serão removidas.`)) return;
                      removeCourse(course.id);
                    }}
                    aria-label={`Eliminar ${course.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
