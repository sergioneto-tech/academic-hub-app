import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Fingerprint } from "lucide-react";
import { Link } from "react-router-dom";

import { canAccessAdminSupport } from "@/lib/adminSupport";

function findMobileMoreTarget(): HTMLElement | null {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'));
  const moreDialog = dialogs.find((dialog) => {
    const text = dialog.textContent ?? "";
    return text.includes("Aparência") && text.includes("Exportar backup");
  });
  return moreDialog?.querySelector<HTMLElement>(".space-y-5") ?? null;
}

export default function AdminSupportShortcut() {
  const [allowed, setAllowed] = useState(false);
  const [desktopPortalTarget, setDesktopPortalTarget] = useState<HTMLElement | null>(null);
  const [mobilePortalTarget, setMobilePortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let frame: number | null = null;

    const refreshTargets = () => {
      setDesktopPortalTarget(document.querySelector("aside > div:last-child") as HTMLElement | null);
      setMobilePortalTarget(findMobileMoreTarget());
    };

    const scheduleRefresh = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        refreshTargets();
      });
    };

    const stopObserver = () => {
      observer?.disconnect();
      observer = null;
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
    };

    const check = async () => {
      const next = await canAccessAdminSupport().catch(() => false);
      if (cancelled) return;
      setAllowed(next);
      if (!next) {
        stopObserver();
        setDesktopPortalTarget(null);
        setMobilePortalTarget(null);
        return;
      }
      refreshTargets();
      if (!observer) {
        observer = new MutationObserver(scheduleRefresh);
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };

    void check();
    window.addEventListener("academic-hub-auth-changed", check);
    return () => {
      cancelled = true;
      window.removeEventListener("academic-hub-auth-changed", check);
      stopObserver();
    };
  }, []);

  if (!allowed) return null;

  return (
    <>
      {desktopPortalTarget && createPortal(
        <Link
          to="/administracao/suporte"
          className="mt-2 hidden w-full items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-[11px] font-medium text-sidebar-foreground transition-colors hover:bg-primary/10 md:flex"
        >
          <Fingerprint className="h-4 w-4 shrink-0 text-primary" />
          <span>Suporte por ID Academic Hub</span>
        </Link>,
        desktopPortalTarget,
      )}

      {mobilePortalTarget && createPortal(
        <Link to="/administracao/suporte" className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-3 md:hidden">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Fingerprint className="h-4 w-4" /></div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Suporte por ID Academic Hub</div>
            <div className="text-[11px] text-muted-foreground">Consulta pseudónima de diagnósticos</div>
          </div>
        </Link>,
        mobilePortalTarget,
      )}
    </>
  );
}
