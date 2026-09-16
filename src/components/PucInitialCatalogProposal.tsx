import { useState } from "react";
import { CheckCircle2, Database, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PucImportDraft } from "@/lib/pucImportDraft";
import { submitInitialPucCatalogEntry } from "@/lib/pucInitialSubmission";

export default function PucInitialCatalogProposal({
  courseCode,
  courseName,
  academicYear,
  edition,
  draft,
  sourceHash,
  sourcePageCount,
}: {
  courseCode: string;
  courseName: string;
  academicYear: string | null;
  edition: string | null;
  draft: PucImportDraft;
  sourceHash: string;
  sourcePageCount: number;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const canSubmit = Boolean(academicYear && edition && sourceHash && sourcePageCount > 0);

  const submit = async () => {
    if (!canSubmit || !academicYear || !edition || !confirmed || status === "sending" || status === "sent") return;
    setStatus("sending");
    setMessage("");
    const result = await submitInitialPucCatalogEntry({
      courseCode,
      courseName,
      academicYear,
      edition,
      draft,
      sourceHash,
      sourcePageCount,
    });
    setStatus(result.ok ? "sent" : "error");
    setMessage(result.message);
  };

  return (
    <section className="rounded-2xl border border-primary/25 bg-primary/[0.035] p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Ajudar a criar o catálogo desta UC</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Ainda não existe uma estrutura validada para esta combinação de UC, ano letivo e edição. Podes enviar os dados que acabaste de rever como proposta. A proposta fica pendente e só passa a estar disponível para outros alunos depois de validação administrativa.
          </p>

          {!canSubmit && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-900 dark:text-amber-100">
              Não é possível propor estes dados ao catálogo porque o PUC não permitiu identificar com segurança o ano letivo e a edição. A gravação na tua cadeira continua válida e independente.
            </div>
          )}

          {canSubmit && status !== "sent" && (
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border bg-background/65 p-3 text-xs leading-5">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={confirmed}
                onChange={(event) => {
                  setConfirmed(event.target.checked);
                  if (status === "error") {
                    setStatus("idle");
                    setMessage("");
                  }
                }}
              />
              <span>
                <strong>Confirmo a origem.</strong> Revisei estes dados no PUC oficial desta UC e compreendo que estou apenas a propor uma estrutura para validação; nada será publicado automaticamente.
              </span>
            </label>
          )}

          {message && (
            <div className={`mt-3 rounded-xl border p-3 text-xs leading-5 ${status === "sent" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200" : "border-destructive/30 bg-destructive/10 text-destructive"}`} role={status === "sent" ? "status" : "alert"} aria-live="polite">
              {status === "sent" && <CheckCircle2 className="mr-2 inline h-4 w-4" />}
              {message}
            </div>
          )}

          {canSubmit && (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>O PDF não é enviado nem guardado. É registada apenas a impressão SHA-256 do ficheiro, o número de páginas e a estrutura de dados revista.</span>
              </div>
              <Button type="button" className="shrink-0" disabled={!confirmed || status === "sending" || status === "sent"} onClick={() => void submit()}>
                {status === "sending" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {status === "sent" ? "Proposta enviada" : status === "sending" ? "A enviar…" : "Enviar para validação"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
