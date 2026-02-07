import { useEffect, useMemo, useState } from "react";
import { DegreeSetupDialog } from "@/components/DegreeSetupDialog";
import { useAppStore } from "@/lib/AppStore";
import { getPlanCoursesForDegree } from "@/lib/uabPlan";
import { NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Moon, Sun, RefreshCw, Download } from "lucide-react";
import { applyTheme, getStoredTheme, getSystemTheme, storeTheme, type ThemeMode } from "@/lib/theme";
import { useUpdate } from "@/lib/UpdateProvider";
import { APP_VERSION } from "@/lib/version";

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
  const { state, mergePlanCourses, exportData } = useAppStore();
  const { updateAvailable, applyUpdate } = useUpdate();

  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme() ?? getSystemTheme());

  useEffect(() => {
    applyTheme(theme);
    storeTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const downloadBackup = () => {
    const json = exportData();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `academic-hub-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  // Se já há licenciatura escolhida mas ainda não há catálogo, carregar automaticamente.
  useEffect(() => {
    if (!state.degree) return;
    if (state.courses.length > 0) return;
    const seeds = getPlanCoursesForDegree(state.degree);
    if (seeds.length === 0) return;
    mergePlanCourses(seeds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.degree?.id]);

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
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-muted/20 dark:to-background">
      <DegreeSetupDialog />

      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold tracking-tight">Academic Hub</div>
              <div className="text-[10px] text-muted-foreground">v{APP_VERSION}</div>
            </div>
            <div className="text-xs text-muted-foreground">Planeamento e notas (UAb)</div>
            <div className="text-[10px] text-muted-foreground truncate">por Sérgio Neto · Estudante de LEI (UAb, 23/24)</div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema (claro/escuro)">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
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
                      "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
        {updateAvailable && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="font-semibold">Nova versão disponível</div>
              <div className="text-xs text-muted-foreground">
                Os teus dados ficam guardados localmente. Por precaução, exporta um backup antes de atualizar.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={downloadBackup}>
                <Download className="mr-2 h-4 w-4" />
                Exportar backup
              </Button>
              <Button size="sm" onClick={applyUpdate}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar versão
              </Button>
            </div>
          </div>
        </div>
      )}

      <Outlet />
      </main>

      {/* Bottom nav para telemóvel (vertical) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-6xl px-2 py-2 grid grid-cols-5 gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-2 py-2 text-[10px] text-center leading-tight truncate font-medium transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
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