import React from "react";
import { cn } from "@/lib/utils";

/**
 * Este componente existe em duas "gerações" no projeto:
 * 1) Antigo: <StatusBadge status="pendente|em_andamento|concluida|atrasada" />
 * 2) Novo:  <StatusBadge label="Aprovado" tone="success|warning|danger|neutral" />
 *
 * Para evitar que o build rebente quando há ficheiros a usar uma API e outros a usar outra,
 * suportamos ambas.
 */

export type LegacyStatus = "pendente" | "em_andamento" | "concluida" | "atrasada" | "success" | "warning" | "danger" | "neutral";
export type BadgeTone = "success" | "warning" | "danger" | "neutral";

type LegacyProps = {
  status: LegacyStatus;
  className?: string;
};

type NewProps = {
  label: string;
  tone: BadgeTone;
  className?: string;
};

type Props = LegacyProps | NewProps;

const LEGACY_MAP: Record<LegacyStatus, { label: string; tone: BadgeTone }> = {
  pendente: { label: "Pendente", tone: "neutral" },
  em_andamento: { label: "Em andamento", tone: "warning" },
  concluida: { label: "Concluída", tone: "success" },
  atrasada: { label: "Atrasada", tone: "danger" },
  success: { label: "Aprovado", tone: "success" },
  warning: { label: "Apto", tone: "warning" },
  danger: { label: "Não Apto", tone: "danger" },
  neutral: { label: "—", tone: "neutral" },
};

// Nota: evitamos `amber` para não puxar o UI para tons amarelos.
const TONE_STYLES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700",
  warning: "bg-sky-100 text-sky-900 border border-sky-200 dark:bg-sky-950/30 dark:text-sky-100 dark:border-sky-900/40",
  success: "bg-emerald-100 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-100 dark:border-emerald-900/40",
  danger: "bg-rose-100 text-rose-900 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-100 dark:border-rose-900/40",
};

export function StatusBadge(props: Props) {
  const className = props.className;

  const normalized = "status" in props ? LEGACY_MAP[props.status] : { label: props.label, tone: props.tone };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_STYLES[normalized.tone],
        className
      )}
    >
      {normalized.label}
    </span>
  );
}

export default StatusBadge;
