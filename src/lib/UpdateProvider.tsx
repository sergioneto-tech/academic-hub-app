import React, { createContext, useContext, useEffect, useRef, useState } from "react";

type Ctx = {
  updateAvailable: boolean;
  applyUpdate: () => void;
  isSupported: boolean;
};

const UpdateCtx = createContext<Ctx | null>(null);

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const regRef = useRef<ServiceWorkerRegistration | null>(null);
  const refreshingRef = useRef(false);

  const isSupported = typeof window !== "undefined" && "serviceWorker" in navigator;

  useEffect(() => {
    if (!isSupported) return;

    // Em desenvolvimento isto costuma atrapalhar (cache), por isso só registamos em PROD.
    if (!import.meta.env.PROD) return;

    const swUrl = `${import.meta.env.BASE_URL ?? "./"}sw.js`;

    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        regRef.current = reg;

        // Se já há uma versão nova em "waiting", mostrar já o aviso.
        if (reg.waiting) setUpdateAvailable(true);

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (installing.state !== "installed") return;
            // Se já existe controller, então isto é update (não 1ª instalação).
            if (navigator.serviceWorker.controller && reg.waiting) {
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch(() => {
        // ignore
      });

    const onControllerChange = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [isSupported]);

  const applyUpdate = () => {
    const reg = regRef.current;
    if (!reg) return;

    // Se existir SW à espera, ativar e fazer reload quando mudar o controller.
    if (reg.waiting) {
      try {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      } catch {
        window.location.reload();
      }
      return;
    }

    // Fallback: reload normal
    window.location.reload();
  };

  return <UpdateCtx.Provider value={{ updateAvailable, applyUpdate, isSupported }}>{children}</UpdateCtx.Provider>;
}

export function useUpdate() {
  const ctx = useContext(UpdateCtx);
  if (!ctx) throw new Error("useUpdate must be used within UpdateProvider");
  return ctx;
}
