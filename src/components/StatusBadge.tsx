import React from "react";
import { cn } from "@/lib/utils";

// Compat:
// - páginas antigas usam `status` (pendente/em_andamento/...)
// - páginas novas (AppStore) usam `{ label, tone }`

type LegacyStatus = "pendente" | "em_andamento" | "concluida" | "atrasada";
export type BadgeTone = "success" | "warning" | "danger" | "neutral";

type Props =
  | { status: LegacyStatus; className?: string }
  | { label: string; tone: BadgeTone; className?: string };

const LEGACY: Record<LegacyStatus, { label: string; tone: BadgeTone }> = {
  pendente: { label: "Pendente", tone: "neutral" },
  em_andamento: { label: "Em andamento", tone: "warning" },
  concluida: { label: "Concluída", tone: "success" },
  atrasada: { label: "Atrasada", tone: "danger" },
};

// Nota: evito AMARELO (amber) para não “puxar” o UI para tons amarelos.
const STYLES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border border-slate-200",
  warning: "bg-sky-100 text-sky-900 border border-sky-200",
  success: "bg-emerald-100 text-emerald-900 border border-emerald-200",
  danger: "bg-rose-100 text-rose-900 border border-rose-200",
};

export function StatusBadge(props: Props) {
  const className = props.className;

  const { label, tone } =
    "status" in props ? LEGACY[props.status] : { label: props.label, tone: props.tone };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STYLES[tone],
        className
      )}
    >
      {label}
    </span>
  );
}

export default StatusBadge;
