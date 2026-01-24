import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import type { Course } from "@/types";
import { fetchDegrees, fetchDegreePlan, type DegreeOption } from "@/lib/uabWiki";
import { useAppStore } from "@/lib/AppStore";

type Props = {
  open: boolean;
};

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export default function DegreeSetupDialog({ open }: Props) {
  const store = useAppStore();

  const [step, setStep] = useState<1 | 2>(1);

  const [loadingDegrees, setLoadingDegrees] = useState(false);
  const [degrees, setDegrees] = useState<DegreeOption[]>([]);
  const [degreeQuery, setDegreeQuery] = useState("");

  const [selectedDegree, setSelectedDegree] = useState<DegreeOption | null>(null);

  const [loadingPlan, setLoadingPlan] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseQuery, setCourseQuery] = useState("");
  const [selectedActive, setSelectedActive] = useState<Record<string, boolean>>({});

  // load degrees on open
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSelectedDegree(null);
    setCourses([]);
    setSelectedActive({});
    setCourseQuery("");
    setDegreeQuery("");

    setLoadingDegrees(true);
    fetchDegrees()
      .then(setDegrees)
      .catch(() => {
        toast({
          title: "Não foi possível carregar as licenciaturas",
          description: "Verifique a ligação à internet e tente novamente.",
          variant: "destructive",
        });
      })
      .finally(() => setLoadingDegrees(false));
  }, [open]);

  const filteredDegrees = useMemo(() => {
    const q = norm(degreeQuery.trim());
    if (!q) return degrees;
    return degrees.filter((d) => norm(d.label).includes(q));
  }, [degrees, degreeQuery]);

  const groupedCourses = useMemo(() => {
    const q = norm(courseQuery.trim());
    const list = q
      ? courses.filter((c) => norm(`${c.code} ${c.name}`).includes(q))
      : courses;

    // group by year/semester for readability
    const groups = new Map<string, Course[]>();
    for (const c of list) {
      const key = `${c.year}º ano — ${c.semester}º semestre`;
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-PT"));
  }, [courses, courseQuery]);

  function toggleAllFor(yr: number, sem: number, value: boolean) {
    setSelectedActive((prev) => {
      const next = { ...prev };
      for (const c of courses) {
        if (c.year === yr && c.semester === sem) next[c.id] = value;
      }
      return next;
    });
  }

  async function loadPlan() {
    if (!selectedDegree) return;

    setLoadingPlan(true);
    try {
      const plan = await fetchDegreePlan(selectedDegree.categoryTitle);
      // Plan returns Course-like objects; ensure typing
      const typed = plan as unknown as Course[];
      setCourses(typed);

      // default: everything inactive
      const init: Record<string, boolean> = {};
      for (const c of typed) init[c.id] = false;
      setSelectedActive(init);

      setStep(2);
      toast({
        title: "Plano carregado",
        description: `Foram carregadas ${typed.length} cadeiras.`,
      });
    } catch {
      toast({
        title: "Falha ao carregar o plano de estudos",
        description: "A Wiki pode estar indisponível. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(false);
    }
  }

  function finish() {
    if (!selectedDegree) return;

    const activeIds = Object.entries(selectedActive)
      .filter(([, v]) => v)
      .map(([id]) => id);

    const finalCourses = courses.map((c) => ({
      ...c,
      isActive: activeIds.includes(c.id),
    }));

    store.initializeFromWizard(
      {
        id: selectedDegree.categoryTitle,
        name: selectedDegree.label,
      },
      finalCourses
    );

    toast({
      title: "Configuração concluída",
      description: "Pode alterar as cadeiras em Definições sempre que quiser.",
    });
  }

  // Prevent closing while open (first-time setup)
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-3xl [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Configuração inicial</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Escolha a sua licenciatura. Depois vamos carregar automaticamente o plano de estudos a partir da Wiki da UAb.
            </div>

            <div className="grid gap-2">
              <Input
                placeholder="Procurar licenciatura…"
                value={degreeQuery}
                onChange={(e) => setDegreeQuery(e.target.value)}
              />
              <div className="rounded-lg border">
                <ScrollArea className="h-64">
                  <div className="p-2 space-y-1">
                    {loadingDegrees && (
                      <div className="p-3 text-sm text-muted-foreground">A carregar…</div>
                    )}
                    {!loadingDegrees && filteredDegrees.length === 0 && (
                      <div className="p-3 text-sm text-muted-foreground">Sem resultados.</div>
                    )}
                    {!loadingDegrees &&
                      filteredDegrees.map((d) => {
                        const active = selectedDegree?.categoryTitle === d.categoryTitle;
                        return (
                          <button
                            key={d.categoryTitle}
                            type="button"
                            onClick={() => setSelectedDegree(d)}
                            className={
                              "w-full text-left px-3 py-2 rounded-md transition-colors " +
                              (active ? "bg-primary/10" : "hover:bg-muted")
                            }
                          >
                            <div className="font-medium">{d.label}</div>
                          </button>
                        );
                      })}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {selectedDegree ? (
                  <span>
                    Selecionado: <span className="font-medium">{selectedDegree.label}</span>
                  </span>
                ) : (
                  "Selecione uma licenciatura para continuar."
                )}
              </div>
              <Button onClick={loadPlan} disabled={!selectedDegree || loadingPlan}>
                {loadingPlan ? "A carregar plano…" : "Carregar plano"}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm">
                  Licenciatura: <span className="font-medium">{selectedDegree?.label}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Marque as cadeiras que está a frequentar neste semestre (pode ajustar depois em Definições).
                </div>
              </div>
              <Button variant="outline" onClick={() => setStep(1)} disabled={loadingPlan}>
                Voltar
              </Button>
            </div>

            <Input
              placeholder="Procurar cadeira (código ou nome)…"
              value={courseQuery}
              onChange={(e) => setCourseQuery(e.target.value)}
            />

            <div className="rounded-lg border">
              <ScrollArea className="h-72">
                <div className="p-2 space-y-3">
                  {groupedCourses.map(([group, list]) => {
                    const ym = group.match(/(\d+)º ano — (\d+)º semestre/);
                    const yr = ym ? Number(ym[1]) : 1;
                    const sem = ym ? Number(ym[2]) : 1;

                    const total = list.length;
                    const checked = list.filter((c) => selectedActive[c.id]).length;

                    return (
                      <div key={group} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{group}</div>
                            <Badge variant="secondary">{checked}/{total}</Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleAllFor(yr, sem, true)}
                            >
                              Marcar tudo
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleAllFor(yr, sem, false)}
                            >
                              Limpar
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {list.map((c) => (
                            <label
                              key={c.id}
                              className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted cursor-pointer"
                            >
                              <Checkbox
                                checked={!!selectedActive[c.id]}
                                onCheckedChange={(v) =>
                                  setSelectedActive((prev) => ({ ...prev, [c.id]: Boolean(v) }))
                                }
                              />
                              <div className="min-w-0">
                                <div className="font-medium leading-tight">
                                  {c.code} — {c.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {c.year}º ano • {c.semester}º semestre
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Selecionadas para este semestre:{" "}
                <span className="font-medium">
                  {Object.values(selectedActive).filter(Boolean).length}
                </span>
              </div>
              <Button onClick={finish} disabled={!selectedDegree || courses.length === 0}>
                Concluir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
