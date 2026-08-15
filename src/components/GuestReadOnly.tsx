import { useEffect, useMemo, useState, type ReactNode, type SyntheticEvent } from "react";
import { LockKeyhole, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getStoredSession, type CloudConfig } from "@/lib/cloudSync";

const MUTATION_SELECTOR = "button,input,textarea,select,[role='switch'],[role='checkbox'],[role='radio'],[contenteditable='true']";

function getCloudConfig(): CloudConfig | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

function hasAccountSession(config: CloudConfig | null): boolean {
  return Boolean(config && getStoredSession(config));
}

export default function GuestReadOnly({ children }: { children: ReactNode }) {
  const config = useMemo(getCloudConfig, []);
  const [authenticated, setAuthenticated] = useState(() => hasAccountSession(config));
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    const refresh = () => setAuthenticated(hasAccountSession(config));
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();

    window.addEventListener("academic-hub-auth-changed", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("academic-hub-auth-changed", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [config]);

  const blockMutation = (event: SyntheticEvent<HTMLElement>) => {
    if (authenticated || hasAccountSession(config)) {
      if (!authenticated) setAuthenticated(true);
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("[data-guest-allowed='true']")) return;
    const control = target.closest(MUTATION_SELECTOR);
    if (!control) return;
    event.preventDefault();
    event.stopPropagation();
    setShowNotice(true);
  };

  return (
    <>
      {!authenticated && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[hsl(var(--gold))]/35 bg-[hsl(var(--gold-soft))]/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--gold))]" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">Modo de exploração</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Podes consultar cursos, cadeiras, plano e ligações públicas. Para registar ou alterar dados é necessário criar conta.</div>
            </div>
          </div>
          <Button asChild size="sm" className="shrink-0" data-guest-allowed="true">
            <Link to="/definicoes?conta=criar"><UserPlus className="mr-2 h-4 w-4" />Criar conta</Link>
          </Button>
        </div>
      )}

      <div onClickCapture={blockMutation} onChangeCapture={blockMutation} onInputCapture={blockMutation}>
        {children}
      </div>

      <Dialog open={showNotice} onOpenChange={setShowNotice}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-[hsl(var(--gold))]" />Cria a tua conta para começares o teu percurso</DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              Podes explorar cursos, cadeiras e informação pública sem conta. Para ativar cadeiras, registar avaliações, acompanhar o teu progresso, gerar relatórios pessoais ou sincronizar dados entre dispositivos, é necessário criar uma conta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowNotice(false)} data-guest-allowed="true">Continuar a explorar</Button>
            <Button asChild data-guest-allowed="true"><Link to="/definicoes?conta=criar" onClick={() => setShowNotice(false)}><UserPlus className="mr-2 h-4 w-4" />Criar conta</Link></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
