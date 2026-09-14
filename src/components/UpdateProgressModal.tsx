import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useUpdate, type UpdatePhase } from "@/lib/UpdateProvider";
import { cn } from "@/lib/utils";

const STEPS: Array<{ phase: Exclude<UpdatePhase, "idle" | "error">; label: string }> = [
  { phase: "preparing", label: "Preparar a atualização" },
  { phase: "checking", label: "Verificar a nova versão" },
  { phase: "installing", label: "Confirmar os novos ficheiros" },
  { phase: "activating", label: "Ativar a nova versão" },
  { phase: "restarting", label: "Preparar o reinício" },
];

function ProgressSegment({ done, active }: { done: boolean; active: boolean }) {
  const [fill, setFill] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFill(done ? 100 : active ? 68 : 0);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, done]);

  return (
    <span
      className={cn(
        "h-2 overflow-hidden rounded-full border bg-muted",
        done ? "border-primary" : active ? "border-primary/65" : "border-border",
      )}
    >
      <span
        className={cn(
          "block h-full rounded-full transition-[width] duration-500 ease-out",
          done ? "bg-primary" : active ? "bg-primary/65" : "bg-transparent",
          active && "animate-pulse motion-reduce:animate-none",
        )}
        style={{ width: `${fill}%` }}
      />
    </span>
  );
}

export default function UpdateProgressModal() {
  const { updatePhase, completedUpdatePhases } = useUpdate();
  if (updatePhase === "idle") return null;

  const error = updatePhase === "error";
  const activeIndex = error ? -1 : STEPS.findIndex((step) => step.phase === updatePhase);
  const completedCount = STEPS.filter((step) => completedUpdatePhases.includes(step.phase)).length;
  const completed = !error && completedCount === STEPS.length;
  const currentStepNumber = activeIndex >= 0 ? activeIndex + 1 : Math.min(STEPS.length, completedCount + 1);

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="status" aria-live="polite">
      <section className="premium-surface w-full max-w-md p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            {error ? <RefreshCw className="h-5 w-5" /> : completed ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">
              {error ? "Não foi possível concluir a atualização" : completed ? "Atualização concluída" : "A atualizar o Academic Hub"}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {error
                ? "A atualização foi interrompida antes de reiniciar. Os teus dados locais não foram apagados."
                : completed
                  ? "As 5 etapas foram confirmadas. O Academic Hub vai reiniciar automaticamente com a nova versão."
                  : `Etapa ${currentStepNumber} de ${STEPS.length}. Cada segmento permanece visível até a etapa real ser confirmada.`}
            </p>
          </div>
        </div>

        {!error && (
          <>
            <div
              className="mt-5 grid grid-cols-5 gap-1.5"
              role="progressbar"
              aria-label="Etapas confirmadas da atualização"
              aria-valuemin={0}
              aria-valuemax={STEPS.length}
              aria-valuenow={completedCount}
              aria-valuetext={`${completedCount} de ${STEPS.length} etapas concluídas`}
            >
              {STEPS.map((step) => {
                const done = completedUpdatePhases.includes(step.phase);
                const active = updatePhase === step.phase && !done;
                return <ProgressSegment key={step.phase} done={done} active={active} />;
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{completedCount} concluídas</span>
              <span>{STEPS.length} etapas reais</span>
            </div>

            <div className="mt-4 space-y-2">
              {STEPS.map((step) => {
                const done = completedUpdatePhases.includes(step.phase);
                const active = updatePhase === step.phase && !done;
                return (
                  <div
                    key={step.phase}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-300",
                      active && "border-primary/35 bg-primary/5",
                      done && "border-emerald-500/20 bg-emerald-500/[0.02]",
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : active ? (
                      <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
                    ) : (
                      <span className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/35" />
                    )}
                    <span className={cn("text-xs", active ? "font-semibold text-foreground" : "text-muted-foreground", done && "text-foreground")}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
          {completed
            ? "O pequeno intervalo antes do reinício serve para confirmar visualmente que todas as etapas terminaram; não representa trabalho adicional."
            : "Os segmentos mostram a passagem entre etapas confirmadas e não uma percentagem de bytes transferidos. Se uma operação real demorar mais, a respetiva etapa permanece ativa até terminar."}
        </p>
      </section>
    </div>
  );
}
