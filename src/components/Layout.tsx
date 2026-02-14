import { useEffect, useMemo, useState } from "react";
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

type ReleaseNotesEntry = {
  version: string;
  date?: string;
  changes: string[];
};

type ReleaseNotesData = {
  latest?: string;
  versions?: ReleaseNotesEntry[];
};

const LAST_SEEN_VERSION_KEY = "academic_hub_last_seen_version";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/cadeiras", label: "Cadeiras" },
  { to: "/plano", label: "Plano" },
  { to: "/calendario", label: "Calendário" },
  { to: "/historico", label: "Histórico" },
  { to: "/definicoes", label: "Definições" },
];

export default function Layout() {
  const { state, mergePlanCourses, exportData } = useAppStore();
  const { updateAvailable, applyUpdate } = useUpdate();

  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotesData | null>(null);
  const [whatsNew, setWhatsNew] = useState<ReleaseNotesEntry | null>(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  const notesUrl = useMemo(() => `${import.meta.env.BASE_URL ?? "./"}release-notes.json`, []);

  // Buscar notas de versão (para mostrar "o que mudou" quando há update, estilo app store).
  useEffect(() => {
    let cancelled = false;

    fetch(notesUrl, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) return;
        setReleaseNotes(data as ReleaseNotesData);
      })
      .catch(() => {
        // ignore
      });

    return () => {
      cancelled = true;
    };
    // Recarregar quando aparece um update (para garantir notas mais recentes)
  }, [notesUrl, updateAvailable]);

  // Mostrar "Novidades" quando a versão local mudou (mesmo sem service worker).
  useEffect(() => {
    const versions = releaseNotes?.versions ?? [];
    if (versions.length === 0) return;

    let lastSeen = "";
    try {
      lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY) ?? "";
    } catch {
      // ignore
    }

    if (lastSeen === APP_VERSION) return;

    const entry = versions.find((v) => v.version === APP_VERSION);
    // Se não houver entrada para esta versão, não fazer nada (não marcar como visto).
    if (!entry) return;

    setWhatsNew(entry);
    setShowWhatsNew(true);
  }, [releaseNotes]);

  const dismissWhatsNew = () => {
    setShowWhatsNew(false);
    try {
      localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
    } catch {
      // ignore
    }
  };

  const latestEntry = useMemo(() => {
    const versions = releaseNotes?.versions ?? [];
    if (versions.length === 0) return null;
    const latest = releaseNotes?.latest;
    if (latest) return versions.find((v) => v.version === latest) ?? versions[0];
    return versions[0];
  }, [releaseNotes]);

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
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold tracking-tight">Academic Hub</div>
              <div className="text-[10px] text-muted-foreground">v{APP_VERSION}</div>
            </div>
            <div className="text-xs text-muted-foreground">Planeamento e notas (UAb)</div>
            <div className="text-[10px] text-muted-foreground">
              Não oficial — aplicação independente, não afiliada nem endossada pela Universidade Aberta (UAb).
            </div>
            <div className="text-[10px] text-muted-foreground truncate">por Sérgio Neto · Estudante de LEI (UAb, 23/24)</div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              title="Mudar tema (claro/escuro)"
              aria-label="Mudar tema (claro/escuro)"
              className="gap-2"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="hidden sm:inline text-xs">{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
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
        {showWhatsNew && whatsNew && (
          <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="font-semibold">Novidades na v{whatsNew.version}</div>
                {whatsNew.date && <div className="text-[11px] text-muted-foreground">{whatsNew.date}</div>}
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-1">
                  {whatsNew.changes.slice(0, 8).map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
              <Button size="sm" variant="secondary" onClick={dismissWhatsNew}>
                OK
              </Button>
            </div>
          </div>
        )}
        {updateAvailable && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="font-semibold">Nova versão disponível</div>
              <div className="text-xs text-muted-foreground">
                Os teus dados ficam guardados localmente. Por precaução, exporta um backup antes de atualizar.
              </div>
              {latestEntry && latestEntry.changes.length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Ver alterações (v{latestEntry.version})
                  </summary>
                  <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-1">
                    {latestEntry.changes.slice(0, 10).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
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
        <div className="mx-auto max-w-6xl px-2 py-2 grid grid-cols-6 gap-1">
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