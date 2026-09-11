import { RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdate } from "@/lib/UpdateProvider";
import { cn } from "@/lib/utils";

export type ReleaseKind = "app" | "security" | "mixed";

export type ReleaseUpdateEntry = {
  version: string;
  date?: string;
  changes: string[];
  kind?: ReleaseKind;
  securityLevel?: string;
  securitySummary?: string;
};

type Props = {
  entry: ReleaseUpdateEntry | null;
  available: boolean;
  deferred: boolean;
  onBackup: () => void;
  onLater: () => void;
  onUpdate: () => void;
};

function releasePresentation(entry: ReleaseUpdateEntry | null) {
  const kind = entry?.kind ?? "app";
  if (kind === "security") {
    return {
      title: "Atualização de segurança disponível",
      description: "Inclui correções ou reforços de proteção. Recomenda-se a instalação em cada dispositivo onde utilizas o Academic Hub.",
      Icon: ShieldCheck,
      tone: "border-emerald-500/35 bg-emerald-500/8",
      iconTone: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    };
  }
  if (kind === "mixed") {
    return {
      title: "Atualização do Academic Hub disponível",
      description: "Esta versão combina melhorias da aplicação com uma atualização do nível de segurança.",
      Icon: ShieldCheck,
      tone: "border-primary/30 bg-primary/5",
      iconTone: "bg-primary/10 text-primary",
    };
  }
  return {
    title: "Nova versão do Academic Hub disponível",
    description: "Inclui melhorias funcionais, visuais, de estabilidade ou desempenho da aplicação.",
    Icon: Sparkles,
    tone: "border-warning/35 bg-warning/10",
    iconTone: "bg-warning/15 text-warning-foreground",
  };
}

export default function ReleaseUpdateNotice({ entry, available, deferred, onBackup, onLater }: Props) {
  const { applyUpdate } = useUpdate();
  if (!available || deferred || !entry) return null;
  const presentation = releasePresentation(entry);
  const Icon = presentation.Icon;
  const kind = entry.kind ?? "app";

  return (
    <section className={cn("premium-surface mb-5 p-4 text-sm", presentation.tone)} role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", presentation.iconTone)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold">{presentation.title}</div>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{entry.securitySummary || presentation.description}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border bg-background/70 px-2 py-0.5 text-[10px] font-semibold">App v{entry.version}</span>
              {(kind === "security" || kind === "mixed") && entry.securityLevel ? (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/8 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  Segurança {entry.securityLevel}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <Button size="sm" className="w-full sm:order-3 sm:w-auto" onClick={() => void applyUpdate(entry.version)}>
            {kind === "security" ? <ShieldCheck className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar agora
          </Button>
          <Button size="sm" variant="secondary" className="w-full sm:order-1 sm:w-auto" onClick={onBackup}>Backup</Button>
          <Button size="sm" variant="outline" className="w-full sm:order-2 sm:w-auto" onClick={onLater}>Mais tarde</Button>
        </div>
      </div>
    </section>
  );
}
