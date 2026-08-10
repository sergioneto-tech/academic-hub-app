import React, { createContext, useContext, useEffect, useRef, useState } from "react";

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

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
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

        void reg.update().catch(() => {});
        if (reg.waiting && !applyingRef.current) setUpdateAvailable(true);

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (installing.state !== "installed" || applyingRef.current) return;
            if (navigator.serviceWorker.controller && reg.waiting) {
              setUpdateAvailable(true);
            }
          });
        });

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibility);
      })
      .catch(() => {
        // Sem Service Worker não há atualização automática, mas a app continua utilizável.
      });

    const onControllerChange = () => {
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

    // O utilizador acabou de aceitar a atualização: o aviso deve desaparecer logo,
    // em vez de ficar preso no ecrã enquanto o navegador troca o Service Worker.
    setUpdateAvailable(false);
    const reg = regRef.current;

    await clearAcademicHubCaches();

    if (reg) {
      try {
        await reg.update();
      } catch {
        // O reload com cache-buster abaixo continua a ser um fallback válido.
      }

      if (reg.waiting) {
        try {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });

          // Alguns PWAs móveis não disparam controllerchange de forma previsível.
          // Se isso acontecer, força a recarga pouco depois sem tocar nos dados locais.
          window.setTimeout(() => {
            if (refreshingRef.current) return;
            refreshingRef.current = true;
            hardReload();
          }, 1400);
          return;
        } catch {
          // Segue para o fallback abaixo.
        }
      }
    }

    refreshingRef.current = true;
    hardReload();
  };

  return <UpdateCtx.Provider value={{ updateAvailable, applyUpdate, isSupported }}>{children}</UpdateCtx.Provider>;
}

export function useUpdate() {
  const ctx = useContext(UpdateCtx);
  if (!ctx) throw new Error("useUpdate must be used within UpdateProvider");
  return ctx;
}
