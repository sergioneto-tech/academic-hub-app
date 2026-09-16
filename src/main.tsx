import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import "./settings-catalog.css";
import "./tablet-sidebar-layout.css";
import "./dashboard-mobile-fixes.css";
import "./portable-compact-layout.css";
import "./interaction-feedback.css";
import { applyTheme, getStoredTheme, getSystemTheme } from "@/lib/theme";
import { UpdateProvider } from "@/lib/UpdateProvider";
import { AppStoreProvider } from "./lib/AppStore";
import { Toaster } from "@/components/ui/toaster";
import LocalTimeIndicator from "@/components/LocalTimeIndicator";
import { parseImplicitAuthCallback } from "@/lib/authCallback";
import {
  getStoredSession,
  isUabStudentEmail,
  storeSession,
  type AuthSession,
  type CloudConfig,
} from "@/lib/cloudSync";
import App from "./App";

const initialTheme = getStoredTheme() ?? getSystemTheme();
applyTheme(initialTheme);
document.documentElement.lang = "pt-PT";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event?.data?.type !== "ACADEMIC_HUB_NOTIFICATION_NAVIGATE" || typeof event.data.url !== "string") return;
    try {
      const target = new URL(event.data.url, window.location.href);
      if (target.origin !== window.location.origin) return;
      if (target.pathname === window.location.pathname && target.search === window.location.search && target.hash) {
        window.location.hash = target.hash;
      } else {
        window.location.assign(target.href);
      }
    } catch {
      // Ignora payloads de navegação inválidos; a app continua funcional.
    }
  });
}

function getCloudConfig(): CloudConfig | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

function toAppSession(session: {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at?: number;
  user: { id: string; email?: string };
}): AuthSession {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    user: {
      id: session.user.id,
      email: session.user.email,
    },
  };
}

async function recoverSupabaseSession(): Promise<void> {
  const cloudConfig = getCloudConfig();
  if (!cloudConfig || getStoredSession(cloudConfig)) return;

  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: sessionData } = await supabase.auth.getSession();
    const candidate = sessionData.session;
    if (!candidate || !isUabStudentEmail(candidate.user.email)) return;

    // Confirma a identidade no servidor antes de promover a sessão persistida pelo
    // supabase-js para a sessão interna usada pelo Academic Hub.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user || userData.user.id !== candidate.user.id) return;

    storeSession(cloudConfig, toAppSession(candidate));
  } catch (error) {
    console.warn("[AuthBridge][recoverSupabaseSession]", error);
  }
}

async function prepareAuthFlow(): Promise<void> {
  const rawHash = window.location.hash || "";
  const rawSearch = window.location.search || "";
  const implicitCallback = parseImplicitAuthCallback(rawHash);

  if (implicitCallback) {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.auth.setSession({
      access_token: implicitCallback.accessToken,
      refresh_token: implicitCallback.refreshToken,
    });

    if (error) {
      console.warn("[AuthCallback][setSession]", error);
      window.history.replaceState({}, "", window.location.pathname);
      if (implicitCallback.kind === "recovery") {
        window.location.hash = "#/definicoes?recovery=1";
      } else {
        sessionStorage.setItem("academic_hub_account_confirmation_error", "1");
        window.location.hash = "#/definicoes?conta=entrar";
      }
      return;
    }

    if (implicitCallback.kind === "recovery") {
      window.history.replaceState({}, "", window.location.pathname);
      window.location.hash = "#/definicoes?recovery=1";
      return;
    }

    if (data.session) {
      const cloudConfig = getCloudConfig();
      if (cloudConfig) storeSession(cloudConfig, toAppSession(data.session));
      sessionStorage.setItem("academic_hub_account_confirmed_notice", "1");
    } else {
      sessionStorage.setItem("academic_hub_account_confirmation_error", "1");
    }

    window.history.replaceState({}, "", window.location.pathname);
    window.location.hash = "#/definicoes";
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
    return;
  }

  // Recupera também quem já confirmou o email antes deste hotfix e ainda tenha
  // uma sessão Supabase válida neste dispositivo. Não cria contas nem dados novos.
  await recoverSupabaseSession();
}

function renderApp() {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <HashRouter>
        <UpdateProvider>
          <AppStoreProvider>
            <App />
            <LocalTimeIndicator />
            <Toaster />
          </AppStoreProvider>
        </UpdateProvider>
      </HashRouter>
    </React.StrictMode>,
  );
}

void prepareAuthFlow().finally(renderApp);
