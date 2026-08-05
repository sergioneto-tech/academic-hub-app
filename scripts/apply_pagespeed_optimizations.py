from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Insertion point not found: {label}")
    return text.replace(old, new, 1)


# 1) Route-level code splitting and fixed-size loading fallback.
Path("src/App.tsx").write_text(r'''import { Suspense, lazy, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import MigrationNotice from "./components/MigrationNotice";
import Dashboard from "./pages/Dashboard";
import MaintenancePage from "./pages/Maintenance";
import { useAutoSync } from "./hooks/useAutoSync";

const CalendarPage = lazy(() => import("./pages/Calendar"));
const HistoryPage = lazy(() => import("./pages/History"));
const CoursesPage = lazy(() => import("./pages/Courses"));
const CourseDetailPremium = lazy(() => import("./pages/CourseDetailPremium"));
const SettingsPremium = lazy(() => import("./pages/SettingsPremium"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword"));
const StudyPlan = lazy(() => import("./pages/StudyPlan"));
const PersonalStudyPlan = lazy(() => import("./pages/PersonalStudyPlan"));
const HelpPage = lazy(() => import("./pages/Help"));
const LegalPage = lazy(() => import("./pages/Legal"));
const AcademicReportPage = lazy(() => import("./pages/AcademicReport"));

const maintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE !== "false";

function RouteFallback() {
  return (
    <div className="grid min-h-[42vh] place-items-center" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary motion-reduce:animate-none" />
      <span className="sr-only">A carregar…</span>
    </div>
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function AcademicHubApp() {
  useAutoSync();

  return (
    <>
      <MigrationNotice />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cadeiras" element={<LazyPage><CoursesPage /></LazyPage>} />
          <Route path="/cadeiras/:id" element={<LazyPage><CourseDetailPremium /></LazyPage>} />
          <Route path="/calendario" element={<LazyPage><CalendarPage /></LazyPage>} />
          <Route path="/historico" element={<LazyPage><HistoryPage /></LazyPage>} />
          <Route path="/historico/relatorio" element={<LazyPage><AcademicReportPage /></LazyPage>} />
          <Route path="/plano" element={<LazyPage><StudyPlan /></LazyPage>} />
          <Route path="/plano/estudo" element={<LazyPage><PersonalStudyPlan /></LazyPage>} />
          <Route path="/definicoes" element={<LazyPage><SettingsPremium /></LazyPage>} />
          <Route path="/reset-password" element={<LazyPage><ResetPasswordPage /></LazyPage>} />
          <Route path="/ajuda" element={<LazyPage><HelpPage /></LazyPage>} />
          <Route path="/legal" element={<LazyPage><LegalPage /></LazyPage>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  if (maintenanceMode) return <MaintenancePage />;
  return <AcademicHubApp />;
}
''', encoding="utf-8")


# 2) Show the migration modal only when this browser actually contains old data.
Path("src/lib/migrationNoticeState.ts").write_text(r'''export const MIGRATION_NOTICE_KEY = "academic_hub_migration_notice_2026_08_05";
export const MIGRATION_NOTICE_DISMISSED_EVENT = "academic-hub:migration-notice-dismissed";

const STATE_KEYS = ["academic_hub_state", "academic_hub_state_v2", "academic_hub_state_v1"] as const;

function hasMeaningfulData(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  const profile = state.profile && typeof state.profile === "object" && !Array.isArray(state.profile)
    ? state.profile as Record<string, unknown>
    : {};

  return Boolean(
    state.degree ||
    (Array.isArray(state.courses) && state.courses.length > 0) ||
    (Array.isArray(state.assessments) && state.assessments.length > 0) ||
    (Array.isArray(state.studyBlocks) && state.studyBlocks.length > 0) ||
    profile.displayName ||
    profile.avatarUrl ||
    profile.avatarPath
  );
}

export function hasLegacyDataToMigrate(): boolean {
  try {
    return STATE_KEYS.some((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      try {
        return hasMeaningfulData(JSON.parse(raw));
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function isMigrationNoticePending(): boolean {
  try {
    if (localStorage.getItem(MIGRATION_NOTICE_KEY) === "dismissed") return false;
  } catch {
    return false;
  }
  return hasLegacyDataToMigrate();
}
''', encoding="utf-8")

Path("src/components/MigrationNotice.tsx").write_text(r'''import { useState } from "react";
import { CloudUpload, FileJson, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  isMigrationNoticePending,
  MIGRATION_NOTICE_DISMISSED_EVENT,
  MIGRATION_NOTICE_KEY,
} from "@/lib/migrationNoticeState";

export default function MigrationNotice() {
  const [open, setOpen] = useState(() => isMigrationNoticePending());

  const dismiss = () => {
    try {
      localStorage.setItem(MIGRATION_NOTICE_KEY, "dismissed");
    } catch {
      // O aviso pode voltar a aparecer se o armazenamento local estiver indisponível.
    }
    setOpen(false);
    window.dispatchEvent(new Event(MIGRATION_NOTICE_DISMISSED_EVENT));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="migration-title">
      <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[hsl(var(--gold)/0.45)] bg-background shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border bg-background/90 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Fechar aviso"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b bg-primary/5 px-6 py-6 pr-16 sm:px-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold-soft))] px-3 py-1 text-xs font-semibold text-[hsl(var(--gold))]">
            <ShieldCheck className="h-4 w-4" />
            Nova base de dados ativa
          </div>
          <h2 id="migration-title" className="text-2xl font-semibold tracking-tight">Os teus dados antigos precisam de uma migração única</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            O Academic Hub passou para uma infraestrutura nova e controlada diretamente pela aplicação. Contas e registos criados antes de 5 de agosto de 2026 não são transferidos automaticamente pelo fornecedor anterior.
          </p>
        </div>

        <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
          <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border bg-muted/25 p-5 text-center">
            <FileJson className="mb-3 h-7 w-7 text-primary" />
            <div className="font-semibold">Já usavas o Academic Hub</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Cria e confirma a conta nova, entra na aplicação, importa o último backup JSON e confirma que as cadeiras, notas, perfil e histórico reapareceram.
            </p>
          </div>
          <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border bg-muted/25 p-5 text-center">
            <CloudUpload className="mb-3 h-7 w-7 text-[hsl(var(--gold))]" />
            <div className="font-semibold">Concluir a migração</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Ativa a sincronização e usa “Guardar na cloud (upload)”. Depois testa “Carregar da cloud (download)” noutro navegador ou dispositivo.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t bg-muted/20 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-xs text-muted-foreground">Contas criadas a partir de 5 de agosto de 2026 já usam diretamente a nova base de dados.</p>
          <Button type="button" onClick={dismiss} className="sm:min-w-40">Compreendi</Button>
        </div>
      </div>
    </div>
  );
}
''', encoding="utf-8")


# 3) Load Supabase only for password-recovery URLs, not on every first visit.
Path("src/main.tsx").write_text(r'''import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import { applyTheme, getStoredTheme, getSystemTheme } from "@/lib/theme";
import { UpdateProvider } from "@/lib/UpdateProvider";
import { AppStoreProvider } from "./lib/AppStore";
import { Toaster } from "@/components/ui/toaster";
import App from "./App";

const initialTheme = getStoredTheme() ?? getSystemTheme();
applyTheme(initialTheme);
document.documentElement.lang = "pt-PT";

async function prepareRecoveryFlow(): Promise<void> {
  const rawHash = window.location.hash || "";
  const rawSearch = window.location.search || "";

  if (rawHash.includes("type=recovery") && rawHash.includes("access_token")) {
    const hashParams = new URLSearchParams(rawHash.substring(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (accessToken && refreshToken) {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }
    window.location.hash = "#/definicoes?recovery=1";
    return;
  }

  if (rawSearch.includes("code=") && (rawSearch.includes("recovery") || rawHash.includes("type=recovery"))) {
    const params = new URLSearchParams(rawSearch.substring(1));
    const code = params.get("code");

    if (code) {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.auth.exchangeCodeForSession(code).catch((error) =>
        console.warn("[RecoveryPKCE]", error),
      );
    }
    window.history.replaceState({}, "", window.location.pathname);
    window.location.hash = "#/definicoes?recovery=1";
    return;
  }

  if (window.location.pathname.includes("/definicoes") && rawSearch.includes("recovery")) {
    window.history.replaceState({}, "", window.location.pathname.replace(/\/definicoes.*/, "/"));
    window.location.hash = "#/definicoes?recovery=1";
  }
}

function renderApp() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <HashRouter>
        <UpdateProvider>
          <AppStoreProvider>
            <App />
            <Toaster />
          </AppStoreProvider>
        </UpdateProvider>
      </HashRouter>
    </React.StrictMode>,
  );
}

void prepareRecoveryFlow().finally(renderApp);
''', encoding="utf-8")


# 4) Keep print-only CSS out of the initial bundle.
app_path = Path("src/pages/AcademicReport.tsx")
app_text = app_path.read_text(encoding="utf-8")
if 'import "@/report-print.css";' not in app_text:
    app_text = app_text.replace('import { useMemo } from "react";\n', 'import { useMemo } from "react";\nimport "@/report-print.css";\n', 1)
app_path.write_text(app_text, encoding="utf-8")


# 5) Coordinate the migration notice and release notes, and avoid in-flow CLS.
layout_path = Path("src/components/Layout.tsx")
layout = layout_path.read_text(encoding="utf-8")
layout = replace_once(
    layout,
    'import { ProfileAvatar } from "@/components/ProfileAvatarEditor";\n',
    'import { ProfileAvatar } from "@/components/ProfileAvatarEditor";\nimport { isMigrationNoticePending, MIGRATION_NOTICE_DISMISSED_EVENT } from "@/lib/migrationNoticeState";\n',
    "Layout migration state import",
)
layout = replace_once(
    layout,
    '  const [showWhatsNew, setShowWhatsNew] = useState(false);\n',
    '''  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [migrationNoticePending, setMigrationNoticePending] = useState(() => isMigrationNoticePending());

  useEffect(() => {
    const dismissed = () => setMigrationNoticePending(false);
    window.addEventListener(MIGRATION_NOTICE_DISMISSED_EVENT, dismissed);
    return () => window.removeEventListener(MIGRATION_NOTICE_DISMISSED_EVENT, dismissed);
  }, []);
''',
    "Layout migration pending state",
)
layout = replace_once(
    layout,
    '  useEffect(() => {\n    const versions = releaseNotes?.versions ?? [];\n',
    '  useEffect(() => {\n    if (migrationNoticePending) return;\n    const versions = releaseNotes?.versions ?? [];\n',
    "Layout release notes guard",
)
layout = replace_once(
    layout,
    '  }, [releaseNotes, state.lastSeenRelease]);\n',
    '  }, [migrationNoticePending, releaseNotes, state.lastSeenRelease]);\n',
    "Layout release notes dependencies",
)

# Increase low-opacity sidebar text contrast.
layout = layout.replace("text-sidebar-foreground/55", "text-sidebar-foreground/72")
layout = layout.replace("text-sidebar-foreground/60", "text-sidebar-foreground/75")
layout = layout.replace("text-sidebar-foreground/40", "text-sidebar-foreground/65")

# Convert the release notes card from normal flow to a fixed modal.
old_whats_new = '''          {showWhatsNew && whatsNew && (
            <section className="premium-surface mb-5 overflow-hidden border-[hsl(var(--gold)/0.45)]">
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between md:p-5">
                <div className="flex min-w-0 gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--gold-soft))] text-[hsl(var(--gold))]">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">O que mudou nesta versão</h2>
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
                    <NavLink to="/ajuda" className="mt-3 inline-flex text-xs font-medium text-primary hover:underline">
                      Consultar Ajuda & Guia
                    </NavLink>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={dismissWhatsNew}>Compreendi</Button>
              </div>
            </section>
          )}
'''
new_whats_new = '''          {showWhatsNew && whatsNew && (
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
'''
layout = replace_once(layout, old_whats_new, new_whats_new, "fixed release notes modal")
layout_path.write_text(layout, encoding="utf-8")


# 6) Remove the global print CSS import and improve base stability/contrast.
app = Path("src/App.tsx").read_text(encoding="utf-8")
app = app.replace('import "./report-print.css";\n', '')
Path("src/App.tsx").write_text(app, encoding="utf-8")

css_path = Path("src/index.css")
css = css_path.read_text(encoding="utf-8")
css = css.replace("--muted-foreground: 217 17% 43%;", "--muted-foreground: 217 20% 36%;")
css = css.replace("--muted-foreground: 218 14% 66%;", "--muted-foreground: 218 18% 73%;")
css = css.replace("  html { background: hsl(var(--background)); }", "  html { background: hsl(var(--background)); scrollbar-gutter: stable; }")
css = css.replace("    background-attachment: fixed;", "    background-attachment: scroll;")
css += '''

@layer utilities {
  .content-auto {
    content-visibility: auto;
    contain-intrinsic-size: 1px 720px;
  }
}
'''
css_path.write_text(css, encoding="utf-8")


# 7) SEO metadata, preload and production discovery files.
index_path = Path("index.html")
index = index_path.read_text(encoding="utf-8")
index = replace_once(
    index,
    '    <link rel="manifest" href="./manifest.webmanifest?v=7" />\n',
    '''    <link rel="preload" href="./academic-hub-premium.svg?v=7" as="image" type="image/svg+xml" />
    <link rel="manifest" href="./manifest.webmanifest?v=7" />
''',
    "logo preload",
)
index = replace_once(
    index,
    '    <meta name="description" content="Gestor académico pessoal — cadeiras, avaliações, calendário, progresso e alertas." />\n',
    '''    <meta name="description" content="Gestor académico pessoal — cadeiras, avaliações, calendário, progresso e alertas." />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="https://academichub.sergioneto.pt/" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Academic Hub" />
    <meta property="og:description" content="Gestão académica pessoal para estudantes da Universidade Aberta." />
    <meta property="og:url" content="https://academichub.sergioneto.pt/" />
    <meta property="og:image" content="https://academichub.sergioneto.pt/academic-hub-icon-v6-512.png" />
''',
    "SEO metadata",
)
index_path.write_text(index, encoding="utf-8")

Path("public/llms.txt").write_text('''# Academic Hub

> Aplicação Web pessoal para organizar o percurso académico de estudantes da Universidade Aberta.

## Finalidade
- Gerir cadeiras ativas e concluídas.
- Registar e-fólios, atividades, exames, recursos, notas e datas.
- Calcular progresso, média, ECTS e estado das avaliações.
- Organizar calendário e plano pessoal de estudo.
- Sincronizar dados privados com uma conta autenticada.

## Áreas públicas da aplicação
- /#/ — painel inicial
- /#/ajuda — ajuda e guia de utilização
- /#/legal — informação legal e privacidade

## Privacidade
Os dados académicos pertencem ao utilizador e não devem ser inferidos, expostos ou indexados. As áreas com dados pessoais funcionam no navegador e, quando ativado, num backend autenticado com políticas de acesso por utilizador.

## Fonte institucional
A aplicação referencia informação pública da Universidade Aberta, incluindo planos de estudo, calendário letivo e regulamentos. A confirmação final de regras, ponderações e prazos deve ser feita no PUC e nos canais oficiais da Universidade Aberta.
''', encoding="utf-8")


# 8) Add useful security headers without changing app behavior.
headers_path = Path("public/_headers")
headers = headers_path.read_text(encoding="utf-8")
if "Strict-Transport-Security:" not in headers:
    headers = headers.replace(
        "  X-Frame-Options: DENY\n",
        "  X-Frame-Options: DENY\n  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\n  Cross-Origin-Opener-Policy: same-origin\n",
        1,
    )
headers_path.write_text(headers, encoding="utf-8")

print("PageSpeed optimizations applied.")
