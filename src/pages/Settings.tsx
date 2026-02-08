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
import { APP_VERSION } from "@/lib/version";

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

function pluralCadeiras(n: number) {
  return n === 1 ? "cadeira" : "cadeiras";
}

function SemesterPanel({
  title,
  courses,
  orderMap,
  onUpdate,
  onRemove,
}: {
  title: string;
  courses: Course[];
  orderMap: Map<string, number>;
  onUpdate: (courseId: string, patch: Partial<Course>) => void;
  onRemove: (courseId: string) => void;
}) {
  const sorted = useMemo(() => {
    const copy = [...courses];
    copy.sort((a, b) => {
      const ia = orderMap.get((a.code || "").trim());
      const ib = orderMap.get((b.code || "").trim());
      if (ia !== undefined && ib !== undefined && ia !== ib) return ia - ib;
      if (ia !== undefined && ib === undefined) return -1;
      if (ia === undefined && ib !== undefined) return 1;
      return (a.code || "").localeCompare(b.code || "", "pt-PT");
    });
    return copy;
  }, [courses, orderMap]);

  return (
    <div className="rounded-lg border">
      <div className="border-b bg-muted/30 px-4 py-2 text-sm font-semibold">{title}</div>

      <div className="space-y-3 p-3">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sem cadeiras neste semestre.
          </div>
        ) : (
          sorted.map((c) => {
            const completed = Boolean(c.isCompleted);
            return (
              <div
                key={c.id}
                className={[
                  "rounded-lg border p-4",
                  completed
                    ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-700/50 dark:bg-emerald-900/25 dark:ring-1 dark:ring-emerald-700/15"
                    : "bg-card",
                ].join(" ")}
              >
                <div className="grid gap-3 md:grid-cols-12 md:items-end">
                  <div className="md:col-span-2">
                    <Label className="text-xs text-muted-foreground">Código</Label>
                    <Input value={c.code} onChange={(e) => onUpdate(c.id, { code: e.target.value })} />
                  </div>

                  <div className="md:col-span-6">
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <Input value={c.name} onChange={(e) => onUpdate(c.id, { name: e.target.value })} />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-xs text-muted-foreground">Ano</Label>
                    <Input
                      type="number"
                      value={String(c.year ?? 1)}
                      onChange={(e) => onUpdate(c.id, { year: Number(e.target.value || 1) })}
                      min={1}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-xs text-muted-foreground">Semestre</Label>
                    <Input
                      type="number"
                      value={String(c.semester ?? 1)}
                      onChange={(e) => onUpdate(c.id, { semester: Number(e.target.value || 1) })}
                      min={1}
                      max={2}
                    />
                  </div>

                  <div className="md:col-span-8 flex flex-wrap items-center gap-4 pt-1">
                    <div className="flex items-center gap-2">
                      <Switch checked={Boolean(c.isActive)} onCheckedChange={(v) => onUpdate(c.id, { isActive: v })} />
                      <span className="text-sm font-medium">Ativa</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={Boolean(c.isCompleted)}
                        onCheckedChange={(v) =>
                          onUpdate(c.id, {
                            isCompleted: v,
                            completedAt: v ? (c.completedAt ?? new Date().toISOString()) : undefined,
                            // opcional: se marcar como concluída, geralmente deixa de estar "ativa"
                            isActive: v ? false : c.isActive,
                          })
                        }
                      />
                      <span className="text-sm font-medium">Concluída</span>
                    </div>

                    {completed && (
                      <span className="text-xs text-muted-foreground">
                        {c.completedAt ? `Concluída em ${new Date(c.completedAt).toLocaleDateString("pt-PT")}` : "Concluída"}
                      </span>
                    )}
                  </div>

                  <div className="md:col-span-4 flex md:justify-end">
                    <Button variant="destructive" onClick={() => onRemove(c.id)}>
                      Remover
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function YearBlock({
  year,
  sem1,
  sem2,
  orderMap,
  onUpdate,
  onRemove,
}: {
  year: number;
  sem1: Course[];
  sem2: Course[];
  orderMap: Map<string, number>;
  onUpdate: (courseId: string, patch: Partial<Course>) => void;
  onRemove: (courseId: string) => void;
}) {
  const totalYear = sem1.length + sem2.length;

  return (
    <div className="rounded-xl border p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg font-semibold">{year}º Ano</div>
        <div className="text-sm text-muted-foreground">
          {totalYear} {pluralCadeiras(totalYear)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <SemesterPanel title="1º Semestre" courses={sem1} orderMap={orderMap} onUpdate={onUpdate} onRemove={onRemove} />
        <SemesterPanel title="2º Semestre" courses={sem2} orderMap={orderMap} onUpdate={onUpdate} onRemove={onRemove} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { state, setDegree, mergePlanCourses, addCourse, updateCourse, removeCourse, exportData, importData, resetData } =
    useAppStore();

  const currentDegreeId = state.degree?.id ?? "";

  const NONE = "__none__";
  const [selectedDegreeId, setSelectedDegreeId] = useState<string>(currentDegreeId || NONE);

  useEffect(() => {
    setSelectedDegreeId(currentDegreeId || NONE);
  }, [currentDegreeId]);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const selectedOpt = useMemo(() => getDegreeOptionById(selectedDegreeId), [selectedDegreeId]);

  const planSeeds = useMemo(() => (state.degree ? getPlanCoursesForDegree(state.degree) : []), [state.degree]);
  const orderMap = useMemo(() => {
    const m = new Map<string, number>();
    planSeeds.forEach((s, idx) => {
      const code = (s.code || "").trim();
      if (!code) return;
      if (!m.has(code)) m.set(code, idx);
    });
    return m;
  }, [planSeeds]);

  const canAutoLoadPlan = useMemo(() => !!state.degree && planSeeds.length > 0, [state.degree, planSeeds.length]);

  const grouped = useMemo(() => {
    return state.courses.reduce((acc, c) => {
      const y = Number(c.year) || 0;
      const s = c.semester === 2 ? 2 : 1;
      if (!acc[y]) acc[y] = { 1: [], 2: [] };
      acc[y][s].push(c);
      return acc;
    }, {} as Record<number, { 1: Course[]; 2: Course[] }>);
  }, [state.courses]);

  const years = useMemo(() => {
    return Object.keys(grouped)
      .map(Number)
      .filter((y) => y > 0)
      .sort((a, b) => a - b);
  }, [grouped]);

  const applyDegree = () => {
    if (!selectedOpt) return;
    setDegree({ id: selectedOpt.id, name: selectedOpt.name });
  };

  const importPlan = () => {
    if (!state.degree) return;
    mergePlanCourses(planSeeds);
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
      if (!res.ok) setImportError("error" in res ? res.error : "Erro desconhecido");
    } catch {
      setImportError("Não foi possível ler o ficheiro.");
    }
  };

  const onAddCourse = () => {
    addCourse({ code: "", name: "", year: 1, semester: 1 });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Definições</h1>
            <p className="text-sm text-muted-foreground">
              Licenciatura, catálogo de cadeiras, backups e preferências. <span className="ml-1">v{APP_VERSION}</span>
            </p>
          </div>
        </div>
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

            <div className="text-xs text-muted-foreground">
              Fonte: wiki.dcet.uab.pt. A lista inclui as licenciaturas do Guia dos Cursos (apenas algumas têm plano automático embebido nesta versão).
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={onExport} variant="secondary">
              Exportar dados (JSON)
            </Button>

            <Button onClick={onImportClick} variant="outline">
              Importar dados (JSON)
            </Button>

            <Button onClick={resetData} variant="destructive">
              Repor dados
            </Button>

            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.currentTarget.value = "";
              }}
            />
          </div>

          {importError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
              {importError}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Dica: a aplicação guarda dados localmente no teu dispositivo. Exportar serve como salvaguarda (ex.: antes de atualizar ou trocar de computador/telemóvel).
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Catálogo de cadeiras</CardTitle>
            <div className="text-sm text-muted-foreground">
              {state.courses.length} {pluralCadeiras(state.courses.length)}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button onClick={onAddCourse} variant="secondary">
              + Adicionar cadeira
            </Button>

            <div className="text-xs text-muted-foreground">
              Dica: usa o botão “Carregar cadeiras” acima para preencher automaticamente.
            </div>
          </div>

          <Separator />

          {state.courses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              Ainda não tens cadeiras no catálogo.
            </div>
          ) : (
            <div className="space-y-6">
              {years.map((year) => {
                const sem1 = grouped[year]?.[1] ?? [];
                const sem2 = grouped[year]?.[2] ?? [];
                return (
                  <YearBlock
                    key={year}
                    year={year}
                    sem1={sem1}
                    sem2={sem2}
                    orderMap={orderMap}
                    onUpdate={(id, patch) => updateCourse(id, patch)}
                    onRemove={(id) => removeCourse(id)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
