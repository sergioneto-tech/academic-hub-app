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

  return (
    <div className={cn(
      "inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-full border bg-card/80 text-muted-foreground shadow-sm backdrop-blur",
      compact
        ? "px-2 py-1 text-[10px] max-sm:gap-1 max-sm:px-1.5 max-sm:py-0.5 max-sm:text-[8px]"
        : "px-2.5 py-1.5 text-[11px]",
      className,
    )}>
      <Fingerprint className={compact ? "h-3 w-3 shrink-0 max-sm:h-2.5 max-sm:w-2.5" : "h-3.5 w-3.5 shrink-0"} />
      {!compact && <span className="shrink-0">ID Academic Hub</span>}
      <span className="min-w-0 flex-1 basis-[7rem] break-all font-mono font-semibold leading-tight text-foreground">{supportId}</span>
      {showCopy && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={compact ? "-mr-1 h-5 w-5 shrink-0 max-sm:mr-0 max-sm:h-5 max-sm:w-5" : "-mr-1 h-6 w-6 shrink-0"}
          onClick={copy}
          aria-label="Copiar ID Academic Hub"
          title="Copiar ID Academic Hub"
        >
          {copied ? <Check className="h-3 w-3 max-sm:h-2.5 max-sm:w-2.5" /> : <Copy className="h-3 w-3 max-sm:h-2.5 max-sm:w-2.5" />}
        </Button>
      )}
    </div>
  );
}
