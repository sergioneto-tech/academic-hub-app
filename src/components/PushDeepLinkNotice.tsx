import { useEffect } from "react";
import { Bell, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PUSH_KEYS = ["_push", "_pushTitle", "_pushBody"] as const;

export default function PushDeepLinkNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const active = params.get("_push") === "1";
  const title = params.get("_pushTitle") || "Notificação Academic Hub";
  const body = params.get("_pushBody") || "Abriste a aplicação através de uma notificação.";

  const dismiss = () => {
    const next = new URLSearchParams(location.search);
    PUSH_KEYS.forEach((key) => next.delete(key));
    const search = next.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });
  };

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(dismiss, 12000);
    return () => window.clearTimeout(timer);
    // O temporizador deve reiniciar apenas quando muda o contexto da Push.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, title, body, location.pathname, location.search]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[160] flex justify-center px-3 sm:px-4">
      <section className="pointer-events-auto flex w-full max-w-2xl items-start gap-3 rounded-2xl border border-primary/30 bg-background/96 p-4 shadow-2xl backdrop-blur-xl">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Bell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">Aberto a partir de uma notificação</div>
          <div className="mt-0.5 font-semibold">{title}</div>
          <div className="mt-1 text-sm leading-5 text-muted-foreground">{body}</div>
        </div>
        <Button type="button" size="icon" variant="ghost" onClick={dismiss} aria-label="Fechar destaque da notificação">
          <X className="h-4 w-4" />
        </Button>
      </section>
    </div>
  );
}
