import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import { AppStoreProvider } from "./lib/AppStore";
import { ErrorBoundary } from "./components/ErrorBoundary";

/**
 * IMPORTANTE (Lovable/Preview):
 * - "ecrã branco" muitas vezes é cache/stale Service Worker.
 * - Para parar o ciclo durante preview, removemos SW e caches existentes.
 */
async function disableServiceWorkerAndCaches() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    // ignore
  }

  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    // ignore
  }
}

window.addEventListener("load", () => {
  void disableServiceWorkerAndCaches();
});

function Boot() {
  const [AppComp, setAppComp] = useState<React.ComponentType | null>(null);
  const [err, setErr] = useState<unknown>(null);

  useEffect(() => {
    (async () => {
      try {
        const mod = await import("./App");
        setAppComp(() => mod.default);
      } catch (e) {
        console.error("Bootstrap import failed:", e);
        setErr(e);
      }
    })();
  }, []);

  if (err) {
    const msg = String((err as any)?.message ?? err);
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 720, fontFamily: "ui-sans-serif, system-ui" }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Erro ao carregar a aplicação</div>
          <pre style={{ marginTop: 12, background: "#f4f4f5", padding: 12, borderRadius: 12 }}>
            {msg}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid #d4d4d8" }}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }

  if (!AppComp) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <div className="text-sm text-muted-foreground">A carregar…</div>
      </div>
    );
  }

  const App = AppComp;

  return (
    <HashRouter>
      <AppStoreProvider>
        <App />
      </AppStoreProvider>
    </HashRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Boot />
    </ErrorBoundary>
  </React.StrictMode>
);
