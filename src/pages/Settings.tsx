import { useEffect, useMemo, useRef, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAppStore } from "@/lib/AppStore";
import { DEGREE_OPTIONS, getDegreeOptionById, getPlanCoursesForDegree } from "@/lib/uabPlan";
import type { Course } from "@/lib/types";

function pluralCadeiras(n: number) {
  return n === 1 ? "cadeira" : "cadeiras";
}

function SemesterCatalogPanel({
  title,
  courses,
  updateCourse,
  removeCourse,
}: {
  title: string;
  courses: Course[];
  updateCourse: (id: string, patch: Partial<Course>) => void;
  removeCourse: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border">
      <div className="border-b bg-muted/30 px-4 py-2 text-sm font-semibold">{title}</div>

      <div className="space-y-3 p-3">
        {courses.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sem cadeiras neste semestre.
          </div>
        ) : (
          courses.map((c) => (
            <div key={c.id} className="rounded-lg border bg-white p-3">
              <div className="grid gap-3 md:grid-cols-12 md:items-end">
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Código</Label>
                  <Input value={c.code} onChange={(e) => updateCourse(c.id, { code: e.target.value })} />
                </div>
                <div className="md:col-span-6">
                  <Label className="text-xs text-muted-foreground">Nome</Label>
                  <Input value={c.name} onChange={(e) => updateCourse(c.id, { name: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Ano</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={c.year}
                    onChange={(e) => updateCourse(c.id, { year: Number(e.target.value) || 1 })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Semestre</Label>
                  <Input
                    type="number"
                    min={1}
                    max={2}
                    value={c.semester}
                    onChange={(e) => updateCourse(c.id, { semester: Number(e.target.value) || 1 })}
                  />
                </div>

                <div className="md:col-span-6 flex items-center gap-6 pt-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={c.isActive}
                      onCheckedChange={(v) => updateCourse(c.id, { isActive: v })}
                      id={`active-${c.id}`}
                    />
                    <Label htmlFor={`active-${c.id}`}>Ativa</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={c.isCompleted}
                      onCheckedChange={(v) =>
                        updateCourse(c.id, {
                          isCompleted: v,
                          completedAt: v ? new Date().toISOString() : undefined,
                        })
                      }
                      id={`done-${c.id}`}
                    />
                    <Label htmlFor={`done-${c.id}`}>Concluída</Label>
                  </div>
                </div>

                <div className="md:col-span-6 flex justify-end">
                  <Button variant="destructive" onClick={() => removeCourse(c.id)}>
                    Remover
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export default function SettingsPage() {
  const { state, setDegree, mergePlanCourses, addCourse, updateCourse, removeCourse, exportData, importData, resetData } = useAppStore();

  const currentDegreeId = state.degree?.id ?? "";
  // NOTA UX:
  // Não pré-selecionar uma licenciatura quando ainda não foi guardada.
  // Isto evita confusão do tipo “parece escolhida mas a app diz que não está guardada”.
  // Usamos um valor “sentinela” (não existente nas opções) para garantir que o Select
  // mostra o placeholder e não escolhe silenciosamente a 1ª opção.
  const NONE = "__none__";
  const [selectedDegreeId, setSelectedDegreeId] = useState<string>(currentDegreeId || NONE);

  // Se o state mudar (ex.: import/reset), refletir no Select.
  useEffect(() => {
    setSelectedDegreeId(currentDegreeId || NONE);
  }, [currentDegreeId]);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Ordenação do catálogo:
  // 1) Ano, 2) Semestre, 3) ordem do plano oficial (se existir), 4) fallback por código.
  const planSeeds = useMemo(
    () => (state.degree ? getPlanCoursesForDegree(state.degree) : []),
    [state.degree?.id]
  );

  const planIndexByCode = useMemo(() => {
    const m = new Map<string, number>();
    planSeeds.forEach((p, i) => m.set(p.code, i));
    return m;
  }, [planSeeds]);

  const catalog = useMemo(() => {
    const sortFn = (a: Course, b: Course) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.semester !== b.semester) return a.semester - b.semester;

      const ia = planIndexByCode.get((a.code || "").trim());
      const ib = planIndexByCode.get((b.code || "").trim());
      if (ia != null && ib != null && ia !== ib) return ia - ib;
      if (ia != null && ib == null) return -1;
      if (ia == null && ib != null) return 1;

      const ca = (a.code || "").trim();
      const cb = (b.code || "").trim();
      if (!ca && cb) return 1;
      if (ca && !cb) return -1;
      const byCode = ca.localeCompare(cb, "pt-PT");
      if (byCode !== 0) return byCode;
      return (a.name || "").localeCompare(b.name || "", "pt-PT");
    };

    const grouped = state.courses.reduce((acc, c) => {
      const y = Number(c.year) || 0;
      const s = c.semester === 2 ? 2 : 1; // fallback seguro

      if (!acc[y]) acc[y] = { 1: [], 2: [] };
      acc[y][s].push(c);
      return acc;
    }, {} as Record<number, { 1: Course[]; 2: Course[] }>);

    const years = Object.keys(grouped).map(Number).sort((a, b) => a - b);

    years.forEach((y) => {
      grouped[y][1].sort(sortFn);
      grouped[y][2].sort(sortFn);
    });

    return { grouped, years };
  }, [planIndexByCode, state.courses]);

  const selectedOpt = useMemo(() => getDegreeOptionById(selectedDegreeId), [selectedDegreeId]);
  const canAutoLoadPlan = useMemo(() => {
    if (!state.degree) return false;
    return getPlanCoursesForDegree(state.degree).length > 0;
  }, [state.degree]);

  const applyDegree = () => {
    if (!selectedOpt) return;
    setDegree({ id: selectedOpt.id, name: selectedOpt.name });
  };

  const importPlan = () => {
    if (!state.degree) return;
    const seeds = getPlanCoursesForDegree(state.degree);
    mergePlanCourses(seeds);
  };

  const clearDegree = () => {
    setDegree(null);
    setSelectedDegreeId(NONE);
  };

  const onExport = () => {
    const json = exportData();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadText(`academic-hub-backup-${stamp}.json`, json);
  };

  const onImportClick = () => fileRef.current?.click();

  const onImportFile = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const res = importData(text);
      if (!res.ok) setImportError(res.error);
    } catch {
      setImportError("Não foi possível ler o ficheiro.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold">Definições</h1>
        <p className="text-sm text-muted-foreground">Configura a licenciatura, o catálogo de cadeiras e backups.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Licenciatura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Selecionada</Label>
            <Select value={selectedDegreeId} onValueChange={setSelectedDegreeId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleciona..." />
              </SelectTrigger>
              <SelectContent>
                {DEGREE_OPTIONS.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap gap-2">
              <Button onClick={applyDegree} variant="default" disabled={!selectedOpt}>
                Guardar
              </Button>
              <Button onClick={importPlan} variant="secondary" disabled={!state.degree || !canAutoLoadPlan}>
                Carregar cadeiras (plano automático)
              </Button>
              <Button onClick={clearDegree} variant="outline" disabled={!state.degree}>
                Limpar licenciatura
              </Button>
            </div>

            {selectedOpt?.sourceUrl ? (
              <p className="text-xs text-muted-foreground">
                Fonte:{" "}
                <a className="underline" href={selectedOpt.sourceUrl} target="_blank" rel="noreferrer">
                  {(() => {
                    try {
                      return new URL(selectedOpt.sourceUrl).hostname;
                    } catch {
                      return selectedOpt.sourceUrl;
                    }
                  })()}
                </a>
              </p>
            ) : null}

            {!state.degree ? (
              <p className="text-sm text-amber-700">
                Ainda não escolheste licenciatura — ao entrar na app vai aparecer um ecrã para escolher.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                A lista inclui as licenciaturas do Guia dos Cursos. Apenas algumas têm plano automático embebido nesta versão.
                Se o teu curso não tiver plano automático, adiciona cadeiras manualmente ou importa um catálogo via JSON.
              </p>
            )}

            {state.degree && !canAutoLoadPlan ? (
              <p className="text-sm text-amber-700">
                Esta licenciatura ainda não tem plano automático nesta app — o botão “Carregar cadeiras” fica desativado.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de cadeiras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => addCourse({ code: "", name: "Nova cadeira", year: 1, semester: 1 })}
              variant="secondary"
            >
              + Adicionar cadeira
            </Button>
            <span className="text-xs text-muted-foreground">
              Dica: usa o botão “Carregar cadeiras” na secção acima para preencher automaticamente.
            </span>
          </div>

          <Separator />

          {state.courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há cadeiras no catálogo.</p>
          ) : (
            <div className="space-y-6">
              {catalog.years.map((year) => {
                const sem1 = catalog.grouped[year]?.[1] ?? [];
                const sem2 = catalog.grouped[year]?.[2] ?? [];
                const totalYear = sem1.length + sem2.length;

                const yearLabel = year > 0 ? `${year}º Ano` : "Sem ano";

                return (
                  <div key={year} className="rounded-xl border p-4 md:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-lg font-semibold">{yearLabel}</div>
                      <div className="text-sm text-muted-foreground">
                        {totalYear} {pluralCadeiras(totalYear)}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <SemesterCatalogPanel
                        title="1º Semestre"
                        courses={sem1}
                        updateCourse={updateCourse}
                        removeCourse={removeCourse}
                      />
                      <SemesterCatalogPanel
                        title="2º Semestre"
                        courses={sem2}
                        updateCourse={updateCourse}
                        removeCourse={removeCourse}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup e reposição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={onExport}>Exportar JSON</Button>
            <Button variant="secondary" onClick={onImportClick}>
              Importar JSON
            </Button>
            <Button variant="destructive" onClick={resetData}>
              Repor dados
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImportFile(f);
                e.currentTarget.value = "";
              }}
            />
          </div>

          {importError ? <p className="text-sm text-rose-700">{importError}</p> : null}

          <p className="text-xs text-muted-foreground">
            Exporta antes de repor. O JSON guarda a licenciatura, cadeiras e avaliações.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
