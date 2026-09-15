import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { isFeedbackBetaManager } from "@/lib/feedbackBeta";
import { cn } from "@/lib/utils";

type SecurityStatus = {
  securityLevel?: string;
  lastAudit?: string;
  status?: "protected" | "attention" | "review";
};

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
const STATUS_FETCH_TIMEOUT_MS = 8000;

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function SecurityStatusBadge() {
  const [data, setData] = useState<SecurityStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const manager = isFeedbackBetaManager();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), STATUS_FETCH_TIMEOUT_MS);
    const base = import.meta.env.BASE_URL ?? "/";
    fetch(`${base}security-status.json?ts=${Date.now()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<SecurityStatus>;
      })
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setLoadFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadFailed(true);
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const stale = useMemo(() => {
    if (!data?.lastAudit) return false;
    const audit = new Date(data.lastAudit).getTime();
    return Number.isFinite(audit) && Date.now() - audit > EIGHT_DAYS_MS;
  }, [data?.lastAudit]);

  const status = loadFailed || stale ? "attention" : data?.status ?? "attention";
  const protectedStatus = status === "protected";
  const reviewStatus = status === "review";
  const Icon = protectedStatus ? ShieldCheck : reviewStatus ? ShieldAlert : AlertTriangle;
  const label = protectedStatus
    ? "Segurança verificada"
    : reviewStatus
      ? "Segurança requer revisão"
      : stale
        ? "Vistoria semanal em atraso"
        : "Estado de segurança indisponível";

  return (
    <Link
      to="/seguranca-privacidade"
      className={cn(
        "mb-5 flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-sm transition-colors hover:bg-muted/35",
        protectedStatus && "border-emerald-500/30 bg-emerald-500/5",
        status === "attention" && "border-amber-500/35 bg-amber-500/7",
        reviewStatus && "border-destructive/40 bg-destructive/5",
      )}
      aria-label="Abrir Segurança e Privacidade"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          protectedStatus && "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
          status === "attention" && "bg-amber-500/12 text-amber-600 dark:text-amber-400",
          reviewStatus && "bg-destructive/10 text-destructive",
        )}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold">{label}</div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {data?.securityLevel ? `Nível ${data.securityLevel} · ` : ""}Última vistoria: {formatDate(data?.lastAudit)}
          </div>
          {manager && !protectedStatus && (
            <div className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
              Administrador: verifica a vistoria semanal no GitHub Actions.
            </div>
          )}
        </div>
      </div>
      <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">Detalhes</span>
    </Link>
  );
}
