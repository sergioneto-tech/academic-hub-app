import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import { applyTheme, getStoredTheme, getSystemTheme } from "@/lib/theme";
import { UpdateProvider } from "@/lib/UpdateProvider";
import { AppStoreProvider } from "./lib/AppStore";
import { Toaster } from "@/components/ui/toaster";
import LocalTimeIndicator from "@/components/LocalTimeIndicator";
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
            <LocalTimeIndicator />
            <Toaster />
          </AppStoreProvider>
        </UpdateProvider>
      </HashRouter>
    </React.StrictMode>,
  );
}

void prepareRecoveryFlow().finally(renderApp);
