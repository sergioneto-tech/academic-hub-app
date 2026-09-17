import { Check, Copy, Fingerprint } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useMySupportIdentity } from "@/lib/supportIdentity";

type SupportIdentityBadgeProps = {
  className?: string;
  compact?: boolean;
  showCopy?: boolean;
};

export default function SupportIdentityBadge({ className, compact = false, showCopy = true }: SupportIdentityBadgeProps) {
  const { supportId, loading } = useMySupportIdentity();
  const [copied, setCopied] = useState(false);

  if (loading) {
    return <div className={cn("text-[11px] text-muted-foreground", className)}>ID Academic Hub · a carregar…</div>;
  }

  if (!supportId) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(supportId);
      setCopied(true);
      toast({ title: "ID Academic Hub copiado", description: supportId });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Não foi possível copiar o ID", description: supportId, variant: "destructive" });
    }
  };

  const parts = supportId.split("-");
  const compactTop = parts.length === 4 ? `${parts[0]}-${parts[1]}` : supportId;
  const compactBottom = parts.length === 4 ? `${parts[2]}-${parts[3]}` : "";

  return (
    <div className={cn(
      "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card/80 text-muted-foreground shadow-sm backdrop-blur",
      compact
        ? "px-2 py-1 text-[10px] max-sm:grid max-sm:w-[9rem] max-sm:grid-cols-[auto_1fr_auto] max-sm:gap-1 max-sm:rounded-xl max-sm:px-1.5"
        : "px-2.5 py-1.5 text-[11px]",
      className,
    )}>
      <Fingerprint className={compact ? "h-3 w-3 shrink-0" : "h-3.5 w-3.5 shrink-0"} />
      {!compact && <span className="shrink-0">ID Academic Hub</span>}
      {compact ? (
        <>
          <span className="hidden whitespace-nowrap font-mono font-semibold text-foreground sm:inline">{supportId}</span>
          <span className="min-w-0 text-center font-mono font-semibold leading-3 text-foreground sm:hidden">
            <span className="block whitespace-nowrap">{compactTop}</span>
            {compactBottom && <span className="block whitespace-nowrap">{compactBottom}</span>}
          </span>
        </>
      ) : (
        <span className="whitespace-nowrap font-mono font-semibold text-foreground">{supportId}</span>
      )}
      {showCopy && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={compact ? "-mr-1 h-5 w-5 shrink-0 max-sm:mr-0 max-sm:h-6 max-sm:w-6" : "-mr-1 h-6 w-6 shrink-0"}
          onClick={copy}
          aria-label="Copiar ID Academic Hub"
          title="Copiar ID Academic Hub"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </Button>
      )}
    </div>
  );
}
