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
    // ignore: a atualização não deve falhar só porque a limpeza de cache falhou
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

        const checkForUpdate = () => reg.update().catch(() => {});

        // Forçar verificação de atualização logo após o registo.
        checkForUpdate();

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

        const onFocus = () => checkForUpdate();
        const onVisibility = () => {
          if (document.visibilityState === "visible") checkForUpdate();
        };

        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
          window.removeEventListener("focus", onFocus);
          document.removeEventListener("visibilitychange", onVisibility);
        };
      })
      .catch(() => {
        // ignore
      });

    const onControllerChange = () => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      hardReload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [isSupported]);

  const applyUpdate = async () => {
    const reg = regRef.current;

    // Limpa apenas caches da PWA. Não apaga localStorage/IndexedDB/Supabase.
    await clearAcademicHubCaches();

    if (reg) {
      try {
        await reg.update();
      } catch {
        // ignore
      }

      // Se existir SW à espera, ativar e fazer reload quando mudar o controller.
      if (reg.waiting) {
        try {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
          return;
        } catch {
          // fallback abaixo
        }
      }
    }

    // Fallback para casos em que o browser/PWA ficou preso na cache mas não reportou SW waiting.
    hardReload();
  };

  return <UpdateCtx.Provider value={{ updateAvailable, applyUpdate, isSupported }}>{children}</UpdateCtx.Provider>;
}

export function useUpdate() {
  const ctx = useContext(UpdateCtx);
  if (!ctx) throw new Error("useUpdate must be used within UpdateProvider");
  return ctx;
}
