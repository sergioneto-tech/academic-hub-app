import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import { applyTheme, getStoredTheme, getSystemTheme } from "@/lib/theme";
import { UpdateProvider } from "@/lib/UpdateProvider";
import { AppStoreProvider } from "./lib/AppStore";
import { Toaster } from "@/components/ui/toaster";
import App from "./App";
import { supabase } from "@/integrations/supabase/client";

// Aplicar tema o mais cedo possível (evita "flash" ao abrir)
const initialTheme = getStoredTheme() ?? getSystemTheme();
applyTheme(initialTheme);

// ────────────────────────────────────────────────────────────────────────────
// CORREÇÃO: Interceptar tokens de recuperação de password ANTES do HashRouter.
//
// O Supabase redireciona com tokens no hash (#access_token=...&type=recovery)
// mas o HashRouter também usa o hash para rotas (#/definicoes).
// Sem esta intercepção, o HashRouter interpreta os tokens como rota inválida,
// redireciona para "/" e os tokens perdem-se.
// ────────────────────────────────────────────────────────────────────────────
const rawHash = window.location.hash || "";
const rawSearch = window.location.search || "";

// Caso 1: Implicit flow — tokens no hash (#access_token=...&type=recovery)
if (rawHash.includes("type=recovery") && rawHash.includes("access_token")) {
  const hashParams = new URLSearchParams(rawHash.substring(1)); // remove o '#'
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (accessToken && refreshToken) {
    // Estabelecer sessão de recuperação (async, resolve antes do Settings montar)
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  }

  // Reescrever o hash para que o HashRouter encaminhe para /definicoes
  window.location.hash = "#/definicoes?recovery=1";
}
// Caso 2: PKCE flow — code nos query params (?code=...); o path pode ser /definicoes
else if (rawSearch.includes("code=") && (rawSearch.includes("recovery") || rawHash.includes("type=recovery"))) {
  const params = new URLSearchParams(rawSearch.substring(1));
  const code = params.get("code");

  if (code) {
    supabase.auth.exchangeCodeForSession(code).catch((err) =>
      console.warn("[RecoveryPKCE]", err),
    );
  }

  // Limpar query string e redirecionar para definições via hash
  window.history.replaceState({}, "", window.location.pathname);
  window.location.hash = "#/definicoes?recovery=1";
}
// Caso 3: URL path-based (/definicoes?recovery=1) sem HashRouter — redirecionar
else if (
  window.location.pathname.includes("/definicoes") &&
  rawSearch.includes("recovery")
) {
  window.history.replaceState({}, "", window.location.pathname.replace(/\/definicoes.*/, "/"));
  window.location.hash = "#/definicoes?recovery=1";
}

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
  </React.StrictMode>
);
