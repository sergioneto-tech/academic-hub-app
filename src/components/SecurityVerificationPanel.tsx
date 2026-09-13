import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  hasFixableSecurityIssue,
  repairSecurityIssues,
  runSecuritySelfCheck,
  securityOverallStatus,
  SECURITY_SELF_CHECKS,
  type SecuritySelfCheckResult,
  type SecuritySelfCheckStatus,
} from "@/lib/securitySelfCheck";
import { cn } from "@/lib/utils";

function initialChecks(): SecuritySelfCheckResult[] {
  return SECURITY_SELF_CHECKS.map((item) => ({
    ...item,
    status: "pending" as SecuritySelfCheckStatus,
    detail: "A aguardar verificação.",
  }));
}

function nextPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function formatCheckTime(value: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

export default function SecurityVerificationPanel({ autoStart = false }: { autoStart?: boolean }) {
  const [checks, setChecks] = useState<SecuritySelfCheckResult[]>(() => initialChecks());
  const [phase, setPhase] = useState<"idle" | "running" | "repairing" | "complete">("idle");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const runningRef = useRef(false);
  const autoStartedRef = useRef(false);

  const runVerification = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setPhase("running");
    setChecks(initialChecks());

    const completed: SecuritySelfCheckResult[] = [];
    for (const definition of SECURITY_SELF_CHECKS) {
      setChecks((current) => current.map((item) =>
        item.id === definition.id
          ? { ...item, status: "running", detail: "A verificar agora…" }
          : item,
      ));
      await nextPaint();

      let result: SecuritySelfCheckResult;
      try {
        result = await runSecuritySelfCheck(definition.id);
      } catch {
        result = {
          ...definition,
          status: "warning",
          detail: "A verificação não pôde ser concluída neste momento.",
        };
      }
      completed.push(result);
      setChecks((current) => current.map((item) => item.id === result.id ? result : item));
      await nextPaint();
    }

    setLastCheckedAt(new Date());
    setPhase("complete");
    runningRef.current = false;
  }, []);

  const repairAndVerify = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setPhase("repairing");
    try {
      await repairSecurityIssues(checks);
    } finally {
      runningRef.current = false;
    }
    await runVerification();
  }, [checks, runVerification]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void runVerification();
  }, [autoStart, runVerification]);

  const finalResults = useMemo(
    () => checks.filter((item) => item.status === "pass" || item.status === "warning" || item.status === "fail"),
    [checks],
  );
  const overall = phase === "complete" ? securityOverallStatus(finalResults) : null;
  const fixable = phase === "complete" && hasFixableSecurityIssue(finalResults);
  const optionalWarnings = phase === "complete"
    ? finalResults.filter((item) => !item.critical && item.status === "warning").length
    : 0;
  const completedCount = checks.filter((item) => ["pass", "warning", "fail"].includes(item.status)).length;

  return (
    <Card className={cn(
      "premium-card overflow-hidden border-primary/20",
      overall === "pass" && "border-emerald-500/35",
      overall === "warning" && "border-amber-500/40",
      overall === "fail" && "border-destructive/45",
    )}>
      <CardHeader className="border-b bg-gradient-to-br from-primary/8 via-transparent to-[hsl(var(--gold)/0.08)] pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-2xl border shadow-sm",
              overall === "pass" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                overall === "warning" ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                  overall === "fail" ? "border-destructive/35 bg-destructive/10 text-destructive" :
                    "border-primary/20 bg-primary/10 text-primary",
            )}>
              {overall === "fail" ? <ShieldX className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base sm:text-lg">Verificação de proteção</CardTitle>
                <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold-soft))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--gold))]">
                  <Sparkles className="h-3 w-3" /> Premium
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                Executa verificações reais neste dispositivo e consulta o estado central do Academic Hub. Não é uma animação de diagnóstico nem substitui a auditoria técnica do servidor.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {fixable && (
              <Button size="sm" onClick={() => void repairAndVerify()} disabled={phase === "running" || phase === "repairing"}>
                <Wrench className="h-4 w-4" /> Corrigir e verificar
              </Button>
            )}
            <Button
              size="sm"
              variant={fixable ? "outline" : "default"}
              onClick={() => void runVerification()}
              disabled={phase === "running" || phase === "repairing"}
            >
              {phase === "running" || phase === "repairing"
                ? <LoaderCircle className="h-4 w-4 animate-spin" />
                : <RotateCcw className="h-4 w-4" />}
              {phase === "idle" ? "Verificar agora" : phase === "running" ? "A verificar…" : phase === "repairing" ? "A corrigir…" : "Verificar novamente"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        {(phase === "running" || phase === "repairing" || phase === "complete") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>{phase === "repairing" ? "A corrigir controlos locais recuperáveis" : "Verificação em curso"}</span>
              <span>{completedCount}/{checks.length}</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5" aria-hidden="true">
              {checks.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "h-1.5 rounded-full bg-muted transition-colors",
                    item.status === "pass" && "bg-emerald-500",
                    item.status === "warning" && "bg-amber-500",
                    item.status === "fail" && "bg-destructive",
                    item.status === "running" && "animate-pulse bg-primary",
                  )}
                />
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-2">
          {checks.map((check) => (
            <div
              key={check.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border bg-card p-3 transition-colors",
                check.status === "running" && "border-primary/35 bg-primary/5",
                check.status === "pass" && "border-emerald-500/20",
                check.status === "warning" && "border-amber-500/25 bg-amber-500/[0.03]",
                check.status === "fail" && "border-destructive/30 bg-destructive/[0.03]",
              )}
            >
              <div className="mt-0.5 shrink-0">
                {check.status === "running" ? <LoaderCircle className="h-4 w-4 animate-spin text-primary" /> :
                  check.status === "pass" ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> :
                    check.status === "warning" ? <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> :
                      check.status === "fail" ? <ShieldX className="h-4 w-4 text-destructive" /> :
                        <Circle className="h-4 w-4 text-muted-foreground/45" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium">{check.label}</div>
                  {!check.critical && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">complementar</span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{check.detail}</div>
              </div>
            </div>
          ))}
        </div>

        {phase === "idle" && (
          <div className="rounded-xl border border-dashed bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
            Ao iniciar, o Academic Hub mostra cada controlo à medida que é realmente consultado. Nenhuma palavra-passe ou token é apresentado nesta verificação.
          </div>
        )}

        {phase === "complete" && overall && (
          <div className={cn(
            "rounded-2xl border p-4",
            overall === "pass" && "border-emerald-500/30 bg-emerald-500/7",
            overall === "warning" && "border-amber-500/35 bg-amber-500/7",
            overall === "fail" && "border-destructive/35 bg-destructive/7",
          )}>
            <div className="flex items-start gap-3">
              {overall === "pass" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" /> :
                overall === "warning" ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" /> :
                  <ShieldX className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {overall === "pass" ? "Proteção verificada" : overall === "warning" ? "Há pontos que merecem atenção" : "Foi detetado um problema de proteção"}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {overall === "pass"
                    ? `Os controlos essenciais passaram nesta verificação.${optionalWarnings ? ` Existem ${optionalWarnings} recomendação(ões) complementar(es), sem alterar o estado verde.` : ""}`
                    : overall === "warning"
                      ? "Nenhum resultado crítico é ocultado. Corrige o que estiver disponível neste dispositivo ou segue a indicação apresentada no controlo em causa."
                      : "Não assumas que o problema ficou resolvido automaticamente. Se o botão Corrigir não estiver disponível, é necessária intervenção técnica."}
                </p>
                {lastCheckedAt && <div className="mt-2 text-[10px] font-medium text-muted-foreground">Última verificação neste dispositivo: {formatCheckTime(lastCheckedAt)}</div>}
              </div>
            </div>
          </div>
        )}

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          O botão Corrigir atua apenas em controlos recuperáveis localmente, como o registo do Service Worker ou uma subscrição Push já autorizada. Problemas do servidor, da conta ou da auditoria central nunca são apresentados como corrigidos sem nova confirmação real.
        </p>
      </CardContent>
    </Card>
  );
}
