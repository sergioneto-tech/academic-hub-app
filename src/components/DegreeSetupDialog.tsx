import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAppStore } from "@/lib/AppStore";
import { DEGREE_OPTIONS, getDegreeOptionById, getPlanCoursesForDegree } from "@/lib/uabPlan";

export function DegreeSetupDialog() {
  const { state, setDegree, mergePlanCourses } = useAppStore();

  const [open, setOpen] = useState<boolean>(() => !state.degree);
  const [selectedId, setSelectedId] = useState<string>(() => state.degree?.id ?? DEGREE_OPTIONS[0]?.id ?? "lei");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Se já existe licenciatura, não obrigar a abrir.
    setOpen(!state.degree);
    if (state.degree?.id) setSelectedId(state.degree.id);
  }, [state.degree]);

  const selectedOpt = useMemo(() => getDegreeOptionById(selectedId) ?? DEGREE_OPTIONS[0], [selectedId]);

  const onConfirm = async () => {
    if (!selectedOpt) return;
    setLoading(true);
    try {
      setDegree({ id: selectedOpt.id, name: selectedOpt.name });
      // Carregar/mesclar cadeiras default (seed) para esta licenciatura.
      mergePlanCourses(getPlanCoursesForDegree({ id: selectedOpt.id, name: selectedOpt.name }));
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Se ainda não existe licenciatura, não deixar fechar.
        if (!state.degree && !next) return;
        setOpen(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Escolhe a tua licenciatura</DialogTitle>
          <DialogDescription>
            Isto é guardado neste dispositivo, para não teres de escolher sempre. Podes mudar mais tarde nas Definições.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label>Licenciatura</Label>
          <Select value={selectedId} onValueChange={setSelectedId}>
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

          {selectedOpt?.sourceUrl ? (
            <p className="text-xs text-muted-foreground">
              Fonte:{" "}
              <a className="underline" href={selectedOpt.sourceUrl} target="_blank" rel="noreferrer">
                wiki.dcet.uab.pt
              </a>
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={onConfirm} disabled={loading || !selectedOpt}>
            {loading ? "A carregar..." : "Continuar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
