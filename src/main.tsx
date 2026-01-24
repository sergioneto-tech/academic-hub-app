import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import { AppStoreProvider } from "./lib/AppStore";
import { ErrorBoundary } from "./components/ErrorBoundary";

/**
 * IMPORTANTE (Lovable/Preview):
 * - "ecrã branco" muito frequentemente é cache/stale Service Worker.
 * - Para parar o ciclo infinito durante desenvolvimento/preview, removemos qualquer SW existente.
 * - Quando a app estiver estável, podes voltar a registar o SW de forma controlada.
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

// Corre sempre no load para eliminar SW/caches antigos que podem estar a servir bundles desatualizados.
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
        <div style={{ width: "100%", maxWidth: 720, fontFamily: "ui-sans-serif, system-ui", lineHeight: 1.4 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Erro ao carregar a aplicação</div>
          <div style={{ marginTop: 8, opacity: 0.8 }}>
            Isto costuma ser um import em falta, conflito de ficheiros, ou um erro antes do React montar.
          </div>
          <pre
            style={{
              marginTop: 12,
              background: "#f4f4f5",
              padding: 12,
              borderRadius: 12,
              overflow: "auto",
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {msg}
          </pre>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #d4d4d8",
                background: "white",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Recarregar
            </button>
          </div>
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
