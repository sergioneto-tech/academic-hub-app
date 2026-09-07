import React, { createContext, useContext, useEffect, useRef } from "react";

type Ctx = {
  updateAvailable: boolean;
  applyUpdate: () => Promise<void>;
  isSupported: boolean;
};

const UpdateCtx = createContext<Ctx | null>(null);

async function clearAcademicHubCaches() {
  if (typeof window === "undefined" || !("caches" in window)) return;

  try {
    const keys = await window.caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("academic-hub"))
        .map((key) => window.caches.delete(key))
    );
  } catch {
    // A atualização não deve falhar só porque a limpeza de cache falhou.
  }
}

function hardReload() {
  // Recarrega a app sem tocar no localStorage/IndexedDB onde estão cadeiras, notas e histórico.
  const url = new URL(window.location.href);
  url.searchParams.set("ah_update", Date.now().toString());
  window.location.replace(url.toString());
}

function activateWaitingWorker(registration: ServiceWorkerRegistration | null) {
  const waiting = registration?.waiting;
  if (!waiting) return false;
  try {
    waiting.postMessage({ type: "SKIP_WAITING" });
    return true;
  } catch {
    return false;
  }
}

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const regRef = useRef<ServiceWorkerRegistration | null>(null);
  const refreshingRef = useRef(false);
  const applyingRef = useRef(false);

  const isSupported = typeof window !== "undefined" && "serviceWorker" in navigator;

  useEffect(() => {
    if (!isSupported) return;
    if (!import.meta.env.PROD) return;

    const swUrl = `${import.meta.env.BASE_URL ?? "./"}sw.js`;
    let disposed = false;
    let registered: ServiceWorkerRegistration | null = null;
    let hasControlledPage = Boolean(navigator.serviceWorker.controller);

    const checkForUpdate = () => {
      const reg = regRef.current;
      if (!reg || applyingRef.current) return;
      void reg.update().catch(() => {});
    };

    const onFocus = () => checkForUpdate();
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        if (disposed) return;
        registered = reg;
        regRef.current = reg;

        // Alterações técnicas do Service Worker são aplicadas silenciosamente.
        // O cartão de "Nova versão" fica reservado ao manifesto de versões da app,
        // evitando anunciar versões antigas devido a workers/cache residuais.
        activateWaitingWorker(reg);
        void reg.update().catch(() => {});

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (installing.state !== "installed" || applyingRef.current) return;
            if (navigator.serviceWorker.controller) activateWaitingWorker(reg);
          });
        });

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibility);
      })
      .catch(() => {
        // Sem Service Worker não há atualização automática, mas a app continua utilizável.
      });

    const onControllerChange = () => {
      // Na primeira instalação apenas passa a existir um controlador; não é necessário
      // recarregar. Nas trocas seguintes, recarrega para usar imediatamente o novo bundle.
      if (!hasControlledPage) {
        hasControlledPage = true;
        return;
      }
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      hardReload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      disposed = true;
      if (registered) {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisibility);
      }
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [isSupported]);

  const applyUpdate = async () => {
    if (applyingRef.current) return;
    applyingRef.current = true;
    const reg = regRef.current;

    await clearAcademicHubCaches();

    if (reg) {
      try {
        await reg.update();
      } catch {
        // O reload com cache-buster abaixo continua a ser um fallback válido.
      }

      if (activateWaitingWorker(reg)) {
        window.setTimeout(() => {
          if (refreshingRef.current) return;
          refreshingRef.current = true;
          hardReload();
        }, 1400);
        return;
      }
    }

    refreshingRef.current = true;
    hardReload();
  };

  // Um Service Worker diferente não é, por si só, uma nova versão pública da app.
  // A interface só anuncia versões superiores através do release-notes.json.
  const updateAvailable = false;

  return <UpdateCtx.Provider value={{ updateAvailable, applyUpdate, isSupported }}>{children}</UpdateCtx.Provider>;
}

export function useUpdate() {
  const ctx = useContext(UpdateCtx);
  if (!ctx) throw new Error("useUpdate must be used within UpdateProvider");
  return ctx;
}
