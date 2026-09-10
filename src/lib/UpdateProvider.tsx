import React, { createContext, useContext, useEffect, useRef, useState } from "react";

export type UpdatePhase = "idle" | "preparing" | "checking" | "installing" | "activating" | "restarting" | "error";

type Ctx = {
  updateAvailable: boolean;
  applyUpdate: () => Promise<void>;
  isSupported: boolean;
  updatePhase: UpdatePhase;
  completedUpdatePhases: UpdatePhase[];
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

function waitForWorkerInstall(worker: ServiceWorker, timeoutMs = 20_000) {
  if (["installed", "activated", "redundant"].includes(worker.state)) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      worker.removeEventListener("statechange", onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (["installed", "activated", "redundant"].includes(worker.state)) finish();
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    worker.addEventListener("statechange", onStateChange);
  });
}

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const regRef = useRef<ServiceWorkerRegistration | null>(null);
  const refreshingRef = useRef(false);
  const applyingRef = useRef(false);
  const [updatePhase, setUpdatePhase] = useState<UpdatePhase>("idle");
  const [completedUpdatePhases, setCompletedUpdatePhases] = useState<UpdatePhase[]>([]);

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
      // O script do worker não deve depender do HTTP cache. Isto é especialmente
      // importante em Safari/iOS e em web apps instaladas no ecrã principal.
      void reg.update().catch(() => {});
    };

    const onFocus = () => checkForUpdate();
    const onOnline = () => checkForUpdate();
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    navigator.serviceWorker
      .register(swUrl, { updateViaCache: "none" })
      .then((reg) => {
        if (disposed) return;
        registered = reg;
        regRef.current = reg;
        void reg.update().catch(() => {});

        window.addEventListener("focus", onFocus);
        window.addEventListener("online", onOnline);
        document.addEventListener("visibilitychange", onVisibility);
      })
      .catch(() => {
        // Sem Service Worker não há atualização controlada, mas a app continua utilizável.
      });

    const onControllerChange = () => {
      if (!hasControlledPage) {
        hasControlledPage = true;
        return;
      }
      if (refreshingRef.current || !applyingRef.current) return;
      refreshingRef.current = true;
      setUpdatePhase("restarting");
      hardReload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      disposed = true;
      if (registered) {
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("online", onOnline);
        document.removeEventListener("visibilitychange", onVisibility);
      }
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [isSupported]);

  const completePhase = (phase: UpdatePhase) => {
    setCompletedUpdatePhases((current) => current.includes(phase) ? current : [...current, phase]);
  };

  const applyUpdate = async () => {
    if (applyingRef.current) return;
    applyingRef.current = true;
    refreshingRef.current = false;
    setCompletedUpdatePhases([]);

    try {
      setUpdatePhase("preparing");
      await clearAcademicHubCaches();
      completePhase("preparing");

      const reg = regRef.current;
      if (reg) {
        setUpdatePhase("checking");
        try {
          await reg.update();
          completePhase("checking");
        } catch {
          // Se a verificação direta falhar, o reload com cache-buster continua a ser
          // um fallback real para obter o HTML/bundle atual do servidor.
        }

        const installing = reg.installing;
        if (installing) {
          setUpdatePhase("installing");
          await waitForWorkerInstall(installing);
          if (installing.state !== "redundant") completePhase("installing");
        }

        if (reg.waiting) {
          setUpdatePhase("activating");
          if (activateWaitingWorker(reg)) {
            completePhase("activating");
            setUpdatePhase("restarting");
            window.setTimeout(() => {
              if (refreshingRef.current) return;
              refreshingRef.current = true;
              hardReload();
            }, 1400);
            return;
          }
        }
      }

      setUpdatePhase("restarting");
      refreshingRef.current = true;
      hardReload();
    } catch {
      applyingRef.current = false;
      setUpdatePhase("error");
    }
  };

  // A interface anuncia uma nova versão apenas quando release-notes.json contém
  // uma versão superior. Um worker técnico, por si só, não cria um falso aviso.
  const updateAvailable = false;

  return (
    <UpdateCtx.Provider value={{ updateAvailable, applyUpdate, isSupported, updatePhase, completedUpdatePhases }}>
      {children}
    </UpdateCtx.Provider>
  );
}

export function useUpdate() {
  const ctx = useContext(UpdateCtx);
  if (!ctx) throw new Error("useUpdate must be used within UpdateProvider");
  return ctx;
}
