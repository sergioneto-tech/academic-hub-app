import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SecurityCheck = {
  id: string;
  label: string;
  status: "pass" | "warning" | "fail";
  detail: string;
};

type AcceptedFinding = {
  id: string;
  label: string;
  reason: string;
};

type SecurityStatus = {
  schemaVersion: number;
  product: string;
  securityLevel: string;
  lastAudit: string;
  status: "protected" | "attention" | "review";
  summary: string;
  checks: SecurityCheck[];
  acceptedFindings?: AcceptedFinding[];
  source: string;
};

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

function formatAuditDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data indisponível";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function SecurityStatusCard() {
  const [data, setData] = useState<SecurityStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const base = import.meta.env.BASE_URL ?? "/";
    fetch(`${base}security-status.json?ts=${Date.now()}`, { cache: "no-store" })
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
      });
    return () => { cancelled = true; };
  }, []);

  const stale = useMemo(() => {
    if (!data?.lastAudit) return false;
    const audit = new Date(data.lastAudit).getTime();
    return Number.isFinite(audit) && Date.now() - audit > EIGHT_DAYS_MS;
  }, [data]);

  const effectiveStatus = loadFailed || stale ? "attention" : data?.status ?? "attention";
  const protectedStatus = effectiveStatus === "protected";
  const reviewStatus = effectiveStatus === "review";
  const Icon = protectedStatus ? ShieldCheck : reviewStatus ? ShieldAlert : AlertTriangle;
  const title = protectedStatus ? "Proteção atualizada" : reviewStatus ? "Revisão de segurança necessária" : stale ? "Vistoria de segurança desatualizada" : "Estado de segurança indisponível";
  const description = loadFailed
    ? "Não foi possível consultar o resultado da última vistoria. A aplicação não assume um estado seguro sem dados atuais."
    : stale
      ? "A última vistoria ultrapassou o período semanal esperado. O indicador voltará a verde quando uma nova auditoria concluir sem problemas relevantes."
      : data?.summary ?? "A aguardar o resultado da vistoria de segurança.";

  return (
    <Card id="seguranca" className={cn(
      "premium-card scroll-mt-24 overflow-hidden",
      protectedStatus && "border-emerald-500/35",
      effectiveStatus === "attention" && "border-amber-500/35",
      reviewStatus && "border-destructive/40",
    )}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
              protectedStatus && "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
              effectiveStatus === "attention" && "bg-amber-500/12 text-amber-600 dark:text-amber-400",
              reviewStatus && "bg-destructive/10 text-destructive",
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Estado de segurança</CardTitle>
              <div className="mt-1 text-sm font-semibold">{title}</div>
            </div>
          </div>
          {data?.securityLevel && (
            <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
              Nível {data.securityLevel}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border bg-muted/25 p-3">
            <div className="flex items-center gap-2 text-xs font-medium"><Clock3 className="h-3.5 w-3.5" />Última vistoria</div>
            <div className="mt-1 text-xs text-muted-foreground">{data ? formatAuditDate(data.lastAudit) : "—"}</div>
          </div>
          <div className="rounded-xl border bg-muted/25 p-3">
            <div className="flex items-center gap-2 text-xs font-medium"><ShieldCheck className="h-3.5 w-3.5" />Modelo de proteção</div>
            <div className="mt-1 text-xs text-muted-foreground">Auth · RLS · CSP/HSTS · dependências auditadas</div>
          </div>
        </div>

        {data?.checks?.length ? (
          <details className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-semibold">
              Ver detalhes da vistoria
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t p-3">
              {data.checks.map((check) => (
                <div key={check.id} className="flex items-start gap-2 rounded-lg bg-muted/25 p-2.5">
                  {check.status === "pass" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", check.status === "fail" ? "text-destructive" : "text-amber-600 dark:text-amber-400")} />}
                  <div className="min-w-0">
                    <div className="text-xs font-medium">{check.label}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{check.detail}</div>
                  </div>
                </div>
              ))}
              {data.acceptedFindings?.length ? (
                <div className="pt-1 text-[10px] leading-relaxed text-muted-foreground">
                  {data.acceptedFindings.map((finding) => <div key={finding.id}><strong>{finding.label}:</strong> {finding.reason}</div>)}
                </div>
              ) : null}
            </div>
          </details>
        ) : null}

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Este indicador resume verificações automáticas e não constitui garantia absoluta de invulnerabilidade. Um estado verde significa que a última vistoria não detetou vulnerabilidades críticas/altas ou falhas de controlo consideradas bloqueantes.
        </p>
      </CardContent>
    </Card>
  );
}
