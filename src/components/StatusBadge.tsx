import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "neutral";

export default function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  const cls =
    tone === "success"
      ? "bg-emerald-100 text-emerald-900 border-emerald-200"
      : tone === "warning"
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : tone === "danger"
      ? "bg-rose-100 text-rose-900 border-rose-200"
      : "bg-slate-100 text-slate-900 border-slate-200";

  return (
    <Badge variant="outline" className={cn("rounded-full", cls)}>
      {label}
    </Badge>
  );
}
