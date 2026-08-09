import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EXIT_GUARD_STATE = "academicHubExitGuard";

export default function MobileExitGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const armed = useRef(false);
  const allowExit = useRef(false);

  useEffect(() => {
    if (location.pathname !== "/") {
      armed.current = false;
      return;
    }

    if (!armed.current) {
      window.history.pushState({ ...(window.history.state ?? {}), [EXIT_GUARD_STATE]: true }, "", window.location.href);
      armed.current = true;
    }

    const onPopState = () => {
      if (allowExit.current) return;
      if (window.location.pathname !== "/") return;
      setOpen(true);
      window.history.pushState({ ...(window.history.state ?? {}), [EXIT_GUARD_STATE]: true }, "", window.location.href);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [location.pathname]);

  const confirmExit = () => {
    setOpen(false);
    allowExit.current = true;
    armed.current = false;
    window.history.back();
    window.setTimeout(() => {
      allowExit.current = false;
      if (window.location.pathname === "/") navigate("/", { replace: true });
    }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-[hsl(var(--gold))]" />
            Sair do Academic Hub?
          </DialogTitle>
          <DialogDescription>
            Pretendes sair da aplicação? Podes cancelar e continuar no teu painel académico.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={confirmExit}>Sair</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
