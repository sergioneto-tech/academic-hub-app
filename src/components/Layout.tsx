import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/cadeiras", label: "Cadeiras" },
  { to: "/calendario", label: "Calendário" },
  { to: "/historico", label: "Histórico" },
  { to: "/definicoes", label: "Definições" },
];

export default function Layout() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } finally {
      setDeferred(null);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50 via-white to-white">
      <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">Academic Hub</div>
            <div className="text-xs text-muted-foreground">Planeamento e notas (UAb)</div>
          </div>

          <div className="flex items-center gap-2">
            {!installed && deferred && (
              <Button size="sm" onClick={handleInstall}>
                Instalar
              </Button>
            )}
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-md px-3 py-2 text-sm",
                      isActive ? "bg-sky-100 text-sky-950" : "text-slate-600 hover:bg-sky-50 hover:text-slate-900"
                    )
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 md:pb-10 pt-4">
        <Outlet />
      </main>

      {/* Bottom nav para telemóvel (vertical) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-2 py-2 grid grid-cols-5 gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-2 py-2 text-[10px] text-center leading-tight truncate",
                  isActive ? "bg-sky-100 text-sky-950" : "text-slate-600 hover:bg-sky-50 hover:text-slate-900"
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
