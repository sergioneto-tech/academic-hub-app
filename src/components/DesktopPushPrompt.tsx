import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  currentPushSubscription,
  enablePushOnThisDevice,
  loadRegisteredPushDevices,
  pushSupported,
} from "@/lib/pushNotifications";
import { detectPushBrowser, isDesktopPushDevice, pushActivationGuidance } from "@/lib/pushBrowserHelp";

const DISMISS_KEY = "academicHub:desktopPushPromptDismissedUntil";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isDismissed() {
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function dismissForAWeek() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
  } catch {
    // A ausência de localStorage não deve bloquear a aplicação.
  }
}

export default function DesktopPushPrompt() {
  const { pathname } = useLocation();
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guidance, setGuidance] = useState<string | null>(null);
  const browser = typeof navigator !== "undefined" ? detectPushBrowser() : "Navegador";

  useEffect(() => {
    if (pathname !== "/" || !isDesktopPushDevice() || !pushSupported() || isDismissed()) {
      setVisible(false);
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        // Esta chamada serve também para garantir que existe uma sessão Cloud válida.
        // Assim o aviso não é mostrado a visitantes sem sessão iniciada.
        await loadRegisteredPushDevices();
        const subscription = await currentPushSubscription();
        if (!cancelled) setVisible(!subscription);
      } catch {
        if (!cancelled) setVisible(false);
      }
    };

    void check();
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [pathname]);

  async function activate() {
    setBusy(true);
    setGuidance(null);
    try {
      await enablePushOnThisDevice("Computador");
      setVisible(false);
      try { localStorage.removeItem(DISMISS_KEY); } catch {}
      toast({
        title: "Push ativo neste computador",
        description: "Este computador já pode receber avisos do Academic Hub.",
      });
    } catch (error) {
      const help = pushActivationGuidance(error);
      setGuidance(help);
      toast({ title: "Não foi possível ativar", description: help, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    dismissForAWeek();
    setVisible(false);
  }

  if (!visible || pathname !== "/") return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-[min(430px,calc(100vw-2rem))] rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold">Recebe também os avisos neste computador</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Estás a usar o Academic Hub no {browser}, mas este computador ainda não está ligado ao Push. Podes receber avisos de e-fólios, exames e datas oficiais da UAb mesmo sem teres esta página aberta.
              </p>
            </div>
            <button type="button" aria-label="Fechar" onClick={dismiss} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {guidance && (
            <div className="mt-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs leading-relaxed">
              {guidance}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void activate()}>
              <BellRing className="mr-2 h-3.5 w-3.5" />
              {busy ? "A ativar…" : "Ativar neste computador"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={dismiss}>Agora não</Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Se escolheres “Agora não”, voltamos a lembrar-te mais tarde.</p>
        </div>
      </div>
    </div>
  );
}
