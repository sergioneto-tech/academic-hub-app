import { CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useUpdate, type UpdatePhase } from "@/lib/UpdateProvider";
import { cn } from "@/lib/utils";

const STEPS: Array<{ phase: Exclude<UpdatePhase, "idle" | "error">; label: string }> = [
  { phase: "preparing", label: "Preparar a atualização" },
  { phase: "checking", label: "Verificar a nova versão" },
  { phase: "installing", label: "Instalar os novos ficheiros" },
  { phase: "activating", label: "Ativar a nova versão" },
  { phase: "restarting", label: "Reiniciar o Academic Hub" },
];

export default function UpdateProgressModal() {
  const { updatePhase } = useUpdate();
  if (updatePhase === "idle") return null;

  const error = updatePhase === "error";
  const currentIndex = error ? -1 : STEPS.findIndex((step) => step.phase === updatePhase);

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="status" aria-live="polite">
      <section className="premium-surface w-full max-w-md p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            {error ? <RefreshCw className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="font-semibold">{error ? "Não foi possível concluir a atualização" : "A atualizar o Academic Hub"}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {error
                ? "A atualização foi interrompida antes de reiniciar. Os teus dados locais não foram apagados."
                : "As etapas abaixo correspondem ao processo real do browser. Não é apresentada uma percentagem artificial."}
            </p>
          </div>
        </div>

        {!error && (
          <div className="mt-5 space-y-2">
            {STEPS.map((step, index) => {
              const done = currentIndex > index;
              const active = currentIndex === index;
              return (
                <div key={step.phase} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5", active && "border-primary/35 bg-primary/5")}>
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : active ? (
                    <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
                  ) : (
                    <span className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/35" />
                  )}
                  <span className={cn("text-xs", active ? "font-semibold" : "text-muted-foreground")}>{step.label}</span>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
          Não feches a aplicação durante este processo. O Academic Hub voltará a abrir automaticamente quando a nova versão estiver ativa.
        </p>
      </section>
    </div>
  );
}
