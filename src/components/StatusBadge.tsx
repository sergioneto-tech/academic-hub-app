import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "neutral";

/**
 * Badge de estado (sem amarelos/amber hardcoded).
 * Exporta:
 *  - named:  StatusBadge  (para `import { StatusBadge } ...`)
 *  - default: StatusBadge (para `import StatusBadge ...`)
 */
export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  const cls =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
      : tone === "warning"
      ? "bg-sky-500/10 text-sky-700 border-sky-200"
      : tone === "danger"
      ? "bg-rose-500/10 text-rose-700 border-rose-200"
      : "bg-muted text-muted-foreground border-border";

  return (
    <Badge variant="outline" className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", cls)}>
      {label}
    </Badge>
  );
}

export default StatusBadge;
