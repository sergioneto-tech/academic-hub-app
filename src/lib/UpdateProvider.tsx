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

function hardReload() {
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
  // Em produção, enquanto o primeiro check do Service Worker ainda não terminou,
  // tratamos o estado como potencial atualização. Isto impede o cartão "O que mudou"
  // de aparecer antes de sabermos se existe um worker novo em waiting.
  const [updateAvailable, setUpdateAvailable] = useState(() => Boolean(isSupported && import.meta.env.PROD));

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("ah_update")) return;
    url.searchParams.delete("ah_update");
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  useEffect(() => {
    if (!isSupported || !import.meta.env.PROD) {
      setUpdateAvailable(false);
      return;
    }

    const swUrl = `${import.meta.env.BASE_URL ?? "./"}sw.js`;
    let disposed = false;
    let registered: ServiceWorkerRegistration | null = null;
    let observedInstalling: ServiceWorker | null = null;
    let hasControlledPage = Boolean(navigator.serviceWorker.controller);

    const syncRegistrationState = (reg: ServiceWorkerRegistration | null) => {
      if (disposed) return;
      const hasPendingUpdate = Boolean(reg?.waiting || (reg?.installing && navigator.serviceWorker.controller));
      setUpdateAvailable(hasPendingUpdate);
    };

    const onInstallingStateChange = () => {
      const reg = regRef.current;
      syncRegistrationState(reg);
    };

    const observeInstallingWorker = (reg: ServiceWorkerRegistration) => {
      if (observedInstalling) observedInstalling.removeEventListener("statechange", onInstallingStateChange);
      observedInstalling = reg.installing;
      observedInstalling?.addEventListener("statechange", onInstallingStateChange);
      syncRegistrationState(reg);
    };

    const runUpdateCheck = async () => {
      const reg = regRef.current;
      if (!reg || applyingRef.current) return;
      try {
        await reg.update();
      } catch {
        // Mantém a app funcional mesmo se a verificação pontual falhar.
      } finally {
        if (reg.installing) observeInstallingWorker(reg);
        else syncRegistrationState(reg);
      }
    };

    const onFocus = () => void runUpdateCheck();
    const onOnline = () => void runUpdateCheck();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void runUpdateCheck();
    };

    navigator.serviceWorker
      .register(swUrl, { updateViaCache: "none" })
      .then((reg) => {
        if (disposed) return;
        registered = reg;
        regRef.current = reg;
        syncRegistrationState(reg);

        const onUpdateFound = () => observeInstallingWorker(reg);
        reg.addEventListener("updatefound", onUpdateFound);
        (reg as ServiceWorkerRegistration & { __ahUpdateFoundHandler?: () => void }).__ahUpdateFoundHandler = onUpdateFound;

        void runUpdateCheck();
        window.addEventListener("focus", onFocus);
        window.addEventListener("online", onOnline);
        document.addEventListener("visibilitychange", onVisibility);
      })
      .catch(() => {
        setUpdateAvailable(false);
      });

    const onControllerChange = () => {
      if (!hasControlledPage) {
        hasControlledPage = true;
        setUpdateAvailable(false);
        return;
      }

      if (!applyingRef.current) {
        setUpdateAvailable(false);
        return;
      }

      if (refreshingRef.current) return;
      refreshingRef.current = true;
      setUpdateAvailable(false);
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
        const handler = (registered as ServiceWorkerRegistration & { __ahUpdateFoundHandler?: () => void }).__ahUpdateFoundHandler;
        if (handler) registered.removeEventListener("updatefound", handler);
      }
      observedInstalling?.removeEventListener("statechange", onInstallingStateChange);
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
      const reg = regRef.current;
      completePhase("preparing");

      if (reg) {
        setUpdatePhase("checking");
        try {
          await reg.update();
          completePhase("checking");
        } catch {
          // Se o check direto falhar, o reload com cache-buster continua como fallback.
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
