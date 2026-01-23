import React from "react";
import { cn } from "@/lib/utils";

type Status = "pendente" | "em_andamento" | "concluida" | "atrasada";

const STYLES: Record<Status, string> = {
  pendente: "bg-slate-100 text-slate-700 border border-slate-200",
  em_andamento: "bg-blue-100 text-blue-800 border border-blue-200",
  concluida: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  atrasada: "bg-rose-100 text-rose-800 border border-rose-200",
};

const LABELS: Record<Status, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
};

export default function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STYLES[status],
        className
      )}
    >
      {LABELS[status]}
    </span>
  );
}
