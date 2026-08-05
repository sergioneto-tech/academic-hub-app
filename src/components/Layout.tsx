import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Download,
  GraduationCap,
  History,
  Home,
  Menu,
  Monitor,
  Moon,
  MoreHorizontal,
  RefreshCw,
  Settings,
  Sparkles,
  Sun,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { ProfileAvatar } from "@/components/ProfileAvatarEditor";
import { isMigrationNoticePending, MIGRATION_NOTICE_DISMISSED_EVENT } from "@/lib/migrationNoticeState";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAppStore } from "@/lib/AppStore";
import { getDegreeAccent } from "@/lib/degreeTheme";
import {
  applyTheme,
  getStoredTheme,
  resolveTheme,
  storeTheme,
  watchSystemTheme,
  type ThemeMode,
} from "@/lib/theme";
import { useUpdate } from "@/lib/UpdateProvider";
import { getPlanCoursesForDegree } from "@/lib/uabPlan";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";

const UPDATE_DEFER_KEY = "academicHub:updateDeferred";
const LAST_SEEN_VERSION_KEY = "academic_hub_last_seen_version";

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

type NavItem = {
  to: string;
  label: string;
  shortLabel: string;
  icon: typeof Home;
  exact?: boolean;
};

const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: "Início", shortLabel: "Início", icon: Home, exact: true },
  { to: "/cadeiras", label: "Cadeiras", shortLabel: "Cadeiras", icon: BookOpen },
  { to: "/plano", label: "Plano de estudos", shortLabel: "Plano", icon: GraduationCap },
  { to: "/calendario", label: "Calendário", shortLabel: "Agenda", icon: CalendarDays },
  { to: "/historico", label: "Histórico", shortLabel: "Histórico", icon: History },
];

const SUPPORT_NAV: NavItem[] = [
  { to: "/ajuda", label: "Ajuda & Guia", shortLabel: "Ajuda", icon: CircleHelp },
  { to: "/definicoes", label: "Definições", shortLabel: "Definições", icon: Settings },
];

const MOBILE_NAV = PRIMARY_NAV.slice(0, 4);
const ALL_NAV = [...PRIMARY_NAV, ...SUPPORT_NAV];

function parseVersion(version: string): number[] {
  return version
    .split(".")
    .map((part) => Number.parseInt(part.replace(/\D/g, ""), 10))
    .map((value) => (Number.isFinite(value) ? value : 0));
}

function isNewerVersion(candidate: string | undefined, current: string): boolean {
  if (!candidate || candidate === current) return false;
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  const size = Math.max(a.length, b.length);

  for (let index = 0; index < size; index += 1) {
    const candidatePart = a[index] ?? 0;
    const currentPart = b[index] ?? 0;
    if (candidatePart > currentPart) return true;
    if (candidatePart < currentPart) return false;
  }
  return false;
}

function isNavActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function pageTitle(pathname: string): string {
  return ALL_NAV.find((item) => isNavActive(pathname, item))?.label ?? "Academic Hub";
}

function NavigationLink({ item, compact = false }: { item: NavItem; compact?: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.exact}
      className={({ isActive }) =>
        cn(
          "group flex items-center rounded-xl font-medium transition-colors",
          compact ? "flex-col justify-center gap-1 px-1 py-2 text-[10px]" : "gap-3 px-3 py-2.5 text-sm",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/65 hover:bg-sidebar-accent/65 hover:text-sidebar-foreground",
        )
      }
    >
      <Icon className={cn(compact ? "h-5 w-5" : "h-[18px] w-[18px]", "shrink-0")} />
      <span className={cn(compact && "max-w-full truncate")}>{compact ? item.shortLabel : item.label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    state,
    mergePlanCourses,
    exportData,
    setAppearance,
    setLastSeenRelease,
  } = useAppStore();
  const { updateAvailable, applyUpdate } = useUpdate();
  const accent = getDegreeAccent(state.degree);

  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const isRecovery =
      hash.includes("type=recovery") ||
      search.includes("type=recovery") ||
      location.pathname === "/reset-password";

    if (!isRecovery || location.pathname === "/definicoes") return;

    const params = new URLSearchParams(location.search);
    if (!params.has("recovery")) params.set("recovery", "1");

    navigate(
      {
        pathname: "/definicoes",
        search: `?${params.toString()}`,
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotesData | null>(null);
  const [whatsNew, setWhatsNew] = useState<ReleaseNotesEntry | null>(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [migrationNoticePending, setMigrationNoticePending] = useState(() => isMigrationNoticePending());

  useEffect(() => {
    const dismissed = () => setMigrationNoticePending(false);
    window.addEventListener(MIGRATION_NOTICE_DISMISSED_EVENT, dismissed);
    return () => window.removeEventListener(MIGRATION_NOTICE_DISMISSED_EVENT, dismissed);
  }, []);
  const notesUrl = useMemo(() => `${import.meta.env.BASE_URL ?? "./"}release-notes.json`, []);

  useEffect(() => {
    let cancelled = false;

    fetch(notesUrl, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setReleaseNotes(data as ReleaseNotesData);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [notesUrl, updateAvailable]);

  useEffect(() => {
    if (migrationNoticePending) return;
    const versions = releaseNotes?.versions ?? [];
    if (versions.length === 0) return;

    let legacyLastSeen = "";
    try {
      legacyLastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY) ?? "";
    } catch {
      // Estado sincronizado continua a ser usado quando o localStorage não está disponível.
    }

    if (state.lastSeenRelease === APP_VERSION || legacyLastSeen === APP_VERSION) return;

    const entry = versions.find((version) => version.version === APP_VERSION);
    if (!entry) return;
    setWhatsNew(entry);
    setShowWhatsNew(true);
  }, [migrationNoticePending, releaseNotes, state.lastSeenRelease]);

  const dismissWhatsNew = () => {
    setShowWhatsNew(false);
    setLastSeenRelease(APP_VERSION);
    try {
      localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
    } catch {
      // Sem impacto funcional.
    }
  };

  const latestEntry = useMemo(() => {
    const versions = releaseNotes?.versions ?? [];
    if (versions.length === 0) return null;
    return releaseNotes?.latest
      ? versions.find((version) => version.version === releaseNotes.latest) ?? versions[0]
      : versions[0];
  }, [releaseNotes]);

  const releaseNotesUpdateAvailable = useMemo(
    () => isNewerVersion(latestEntry?.version, APP_VERSION),
    [latestEntry?.version],
  );

  const [deferUpdate, setDeferUpdate] = useState(false);

  useEffect(() => {
    const version = latestEntry?.version;
    if (!version) return;
    try {
      setDeferUpdate(localStorage.getItem(UPDATE_DEFER_KEY) === version);
    } catch {
      setDeferUpdate(false);
    }
  }, [latestEntry?.version]);

  const initialTheme = state.appearance?.theme ?? getStoredTheme() ?? "system";
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    const storedPreference = state.appearance?.theme;
    if (storedPreference && storedPreference !== theme) setTheme(storedPreference);
  }, [state.appearance?.theme, theme]);

  useEffect(() => {
    applyTheme(theme);
    storeTheme(theme);
    return watchSystemTheme(theme, () => applyTheme(theme));
  }, [theme]);

  const changeTheme = (next: ThemeMode) => {
    setTheme(next);
    setAppearance({ theme: next });
  };

  const toggleTheme = () => {
    changeTheme(resolveTheme(theme) === "dark" ? "light" : "dark");
  };

  const downloadBackup = () => {
    const json = exportData();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `academic-hub-backup-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  useEffect(() => {
    if (!state.degree || state.courses.length > 0) return;
    const seeds = getPlanCoursesForDegree(state.degree);
    if (seeds.length > 0) mergePlanCourses(seeds);
    // mergePlanCourses é estável no fluxo atual do store; depender do ID evita reimportações.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.degree?.id]);

  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
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

  const displayName = state.profile?.displayName?.trim() || "Aluno";
  const title = pageTitle(location.pathname);
  const resolvedTheme = resolveTheme(theme);

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-sm">
            AH
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-sidebar-foreground">Academic Hub</div>
            <div className="text-[11px] text-sidebar-foreground/72">Gestão académica pessoal</div>
          </div>
        </div>

        <div className="border-b border-sidebar-border px-4 py-4">
          <div className="flex items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/35 p-3">
            <ProfileAvatar className="h-11 w-11 text-sm" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-sidebar-foreground">{displayName}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-sidebar-foreground/75">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent.color }} />
                <span className="truncate">{state.degree?.name || "Licenciatura não definida"}</span>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/65">
              Académico
            </div>
            {PRIMARY_NAV.map((item) => <NavigationLink key={item.to} item={item} />)}
          </div>

          <div className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/65">
              Apoio
            </div>
            {SUPPORT_NAV.map((item) => <NavigationLink key={item.to} item={item} />)}
          </div>
        </nav>

        <div className="space-y-2 border-t border-sidebar-border p-4">
          {!installed && deferred && (
            <Button className="w-full justify-start" size="sm" onClick={handleInstall}>
              <Download className="mr-2 h-4 w-4" />
              Instalar aplicação
            </Button>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {resolvedTheme === "dark" ? "Usar modo claro" : "Usar modo escuro"}
          </button>
          <div className="px-3 text-[10px] text-sidebar-foreground/65">v{APP_VERSION} · por Sérgio Neto</div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 border-b bg-background/88 backdrop-blur-xl supports-[backdrop-filter]:bg-background/72">
          <div className="flex h-16 items-center justify-between gap-3 px-4 md:h-20 md:px-7 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-xs font-bold text-primary-foreground md:hidden">AH</div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold md:text-xl">{title}</h1>
                <p className="hidden truncate text-xs text-muted-foreground sm:block">
                  {state.degree?.name || "Configura a tua licenciatura para começar"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                title={resolvedTheme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
                aria-label={resolvedTheme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
              >
                {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" asChild title="Abrir alertas e calendário">
                <NavLink to="/calendario" aria-label="Abrir alertas e calendário">
                  <Bell className="h-4 w-4" />
                </NavLink>
              </Button>
              <div className="hidden sm:block">
                <ProfileAvatar className="h-9 w-9 text-xs" />
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[88vw] max-w-sm p-0">
                  <MobileMoreContent
                    stateDegree={state.degree?.name}
                    displayName={displayName}
                    theme={theme}
                    onTheme={changeTheme}
                    onBackup={downloadBackup}
                    canInstall={!installed && Boolean(deferred)}
                    onInstall={handleInstall}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 pb-28 pt-5 md:px-7 md:pb-10 md:pt-7 lg:px-10">
          {showWhatsNew && whatsNew && (
            <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
              <section className="premium-surface max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto border-[hsl(var(--gold)/0.45)]">
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between md:p-6">
                  <div className="flex min-w-0 gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--gold-soft))] text-[hsl(var(--gold))]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 id="whats-new-title" className="font-semibold">O que mudou nesta versão</h2>
                        <span className="rounded-full border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold-soft))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--gold))]">
                          v{whatsNew.version}
                        </span>
                      </div>
                      {whatsNew.date && <div className="mt-0.5 text-[11px] text-muted-foreground">{whatsNew.date}</div>}
                      <ul className="mt-3 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                        {whatsNew.changes.slice(0, 8).map((change) => (
                          <li key={change} className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--gold))]" />
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                      <NavLink to="/ajuda" onClick={dismissWhatsNew} className="mt-3 inline-flex text-xs font-medium text-primary hover:underline">
                        Consultar Ajuda & Guia
                      </NavLink>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={dismissWhatsNew}>Compreendi</Button>
                </div>
              </section>
            </div>
          )}

          {(updateAvailable || releaseNotesUpdateAvailable) && !deferUpdate && (
            <section className="premium-surface mb-5 border-warning/35 bg-warning/10 p-4 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-semibold">Nova versão disponível{latestEntry?.version ? ` — v${latestEntry.version}` : ""}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    A atualização limpa apenas a cache da aplicação. Cadeiras, notas, histórico, plano pessoal, backups e sincronização permanecem preservados.
                  </div>
                  {latestEntry?.changes?.length ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-primary">Ver alterações</summary>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                        {latestEntry.changes.slice(0, 10).map((change) => <li key={change}>{change}</li>)}
                      </ul>
                    </details>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={downloadBackup}>
                    <Download className="mr-2 h-4 w-4" />
                    Backup
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const version = latestEntry?.version;
                      try {
                        if (version) localStorage.setItem(UPDATE_DEFER_KEY, version);
                      } catch {
                        // Sem impacto nos dados.
                      }
                      setDeferUpdate(true);
                    }}
                  >
                    Mais tarde
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      try {
                        localStorage.removeItem(UPDATE_DEFER_KEY);
                      } catch {
                        // Sem impacto nos dados.
                      }
                      void applyUpdate();
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Atualizar
                  </Button>
                </div>
              </div>
            </section>
          )}

          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {MOBILE_NAV.map((item) => <NavigationLink key={item.to} item={item} compact />)}
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors",
                  [...SUPPORT_NAV, PRIMARY_NAV[4]].some((item) => isNavActive(location.pathname, item))
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
                <span>Mais</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-3xl px-4 pb-8 pt-5">
              <MobileMoreContent
                stateDegree={state.degree?.name}
                displayName={displayName}
                theme={theme}
                onTheme={changeTheme}
                onBackup={downloadBackup}
                canInstall={!installed && Boolean(deferred)}
                onInstall={handleInstall}
              />
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}

function MobileMoreContent({
  stateDegree,
  displayName,
  theme,
  onTheme,
  onBackup,
  canInstall,
  onInstall,
}: {
  stateDegree?: string;
  displayName: string;
  theme: ThemeMode;
  onTheme: (theme: ThemeMode) => void;
  onBackup: () => void;
  canInstall: boolean;
  onInstall: () => Promise<void>;
}) {
  return (
    <div className="space-y-5 p-1 sm:p-5">
      <SheetHeader className="pr-8 text-left">
        <div className="flex items-center gap-3">
          <ProfileAvatar className="h-12 w-12 text-sm" />
          <div className="min-w-0">
            <SheetTitle className="truncate">{displayName}</SheetTitle>
            <SheetDescription className="truncate">{stateDegree || "Licenciatura não definida"}</SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="grid gap-2">
        {[PRIMARY_NAV[4], ...SUPPORT_NAV].map((item) => {
          const Icon = item.icon;
          return (
            <SheetClose asChild key={item.to}>
              <NavLink to={item.to} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3 text-sm font-medium">
                <Icon className="h-4 w-4 text-primary" />
                {item.label}
              </NavLink>
            </SheetClose>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-muted/30 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
          <Monitor className="h-4 w-4" />
          Aparência
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: "light" as const, label: "Claro", icon: Sun },
            { value: "dark" as const, label: "Escuro", icon: Moon },
            { value: "system" as const, label: "Sistema", icon: Monitor },
          ]).map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onTheme(option.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-medium",
                  theme === option.value ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" onClick={onBackup}>
          <Download className="mr-2 h-4 w-4" />
          Exportar backup
        </Button>
        {canInstall && (
          <Button onClick={() => void onInstall()}>
            <Download className="mr-2 h-4 w-4" />
            Instalar aplicação
          </Button>
        )}
      </div>

      <div className="text-center text-[10px] text-muted-foreground">Academic Hub v{APP_VERSION} · aplicação independente</div>
    </div>
  );
}
