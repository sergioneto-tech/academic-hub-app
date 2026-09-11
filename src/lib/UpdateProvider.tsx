import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { APP_VERSION } from "@/lib/version";
import {
  clearUpdateTarget,
  markUpdateTarget,
  registerUpdateStartup,
  UPDATE_RESTART_PARAM,
} from "@/lib/updateLifecycle";

export type UpdatePhase = "idle" | "preparing" | "checking" | "installing" | "activating" | "restarting" | "error";

type Ctx = {
  updateAvailable: boolean;
  applyUpdate: (targetVersion?: string) => Promise<void>;
  isSupported: boolean;
  updatePhase: UpdatePhase;
  completedUpdatePhases: UpdatePhase[];
};

const UpdateCtx = createContext<Ctx | null>(null);
const MIN_PROGRESS_VISIBLE_MS = 1800;
const FINAL_STATE_VISIBLE_MS = 900;

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function nextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

function hardReload() {
  const url = new URL(window.location.href);
  url.searchParams.set(UPDATE_RESTART_PARAM, Date.now().toString());
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

function waitForControllerChange(timeoutMs = 8_000) {
  return new Promise<boolean>((resolve) => {
    let finished = false;
    const finish = (changed: boolean) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener("controllerchange", onChange);
      resolve(changed);
    };
    const onChange = () => finish(true);
    const timeout = window.setTimeout(() => finish(false), timeoutMs);
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
  });
}

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const regRef = useRef<ServiceWorkerRegistration | null>(null);
  const applyingRef = useRef(false);
  const [updatePhase, setUpdatePhase] = useState<UpdatePhase>("idle");
  const [completedUpdatePhases, setCompletedUpdatePhases] = useState<UpdatePhase[]>([]);

  const isSupported = typeof window !== "undefined" && "serviceWorker" in navigator;
  const [updateAvailable, setUpdateAvailable] = useState(() => Boolean(isSupported && import.meta.env.PROD));

  useLayoutEffect(() => {
    registerUpdateStartup(APP_VERSION, window.location.href);
    const url = new URL(window.location.href);
    if (!url.searchParams.has(UPDATE_RESTART_PARAM)) return;
    url.searchParams.delete(UPDATE_RESTART_PARAM);
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
    let onUpdateFoundHandler: (() => void) | null = null;

    const syncRegistrationState = (reg: ServiceWorkerRegistration | null) => {
      if (disposed) return;
      const hasPendingUpdate = Boolean(reg?.waiting || (reg?.installing && navigator.serviceWorker.controller));
      setUpdateAvailable(hasPendingUpdate);
    };

    const onInstallingStateChange = () => syncRegistrationState(regRef.current);

    const observeInstallingWorker = (reg: ServiceWorkerRegistration) => {
      if (observedInstalling) observedInstalling.removeEventListener("statechange", onInstallingStateChange);
      observedInstalling = reg.installing;
      observedInstalling?.addEventListener("statechange", onInstallingStateChange);
      if (observedInstalling && navigator.serviceWorker.controller) setUpdateAvailable(true);
    };

    const runUpdateCheck = async () => {
      const reg = regRef.current;
      if (!reg || applyingRef.current) return;
      try {
        await reg.update();
      } catch {
        // Mantém a aplicação funcional se esta verificação pontual falhar.
      } finally {
        if (reg.installing) observeInstallingWorker(reg);
        syncRegistrationState(reg);
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
        onUpdateFoundHandler = () => observeInstallingWorker(reg);
        reg.addEventListener("updatefound", onUpdateFoundHandler);
        void runUpdateCheck();
        window.addEventListener("focus", onFocus);
        window.addEventListener("online", onOnline);
        document.addEventListener("visibilitychange", onVisibility);
      })
      .catch(() => setUpdateAvailable(false));

    const onControllerChange = () => {
      // A troca do controller já não provoca reload imediato. Quando a atualização
      // foi iniciada pelo aluno, applyUpdate espera este evento, conclui a barra
      // e só depois reinicia. Fora de uma atualização, apenas sincroniza o estado.
      if (!applyingRef.current) setUpdateAvailable(false);
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      disposed = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      if (registered && onUpdateFoundHandler) registered.removeEventListener("updatefound", onUpdateFoundHandler);
      observedInstalling?.removeEventListener("statechange", onInstallingStateChange);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, [isSupported]);

  const completePhase = (phase: UpdatePhase) => {
    setCompletedUpdatePhases((current) => current.includes(phase) ? current : [...current, phase]);
  };

  const applyUpdate = async (targetVersion?: string) => {
    if (applyingRef.current) return;
    applyingRef.current = true;
    markUpdateTarget(targetVersion);
    setCompletedUpdatePhases([]);
    const startedAt = performance.now();

    try {
      setUpdatePhase("preparing");
      await nextPaint();
      completePhase("preparing");

      const reg = regRef.current;
      if (!reg && isSupported) throw new Error("Service Worker indisponível");

      if (reg) {
        setUpdatePhase("checking");
        await nextPaint();
        await reg.update();
        completePhase("checking");

        if (reg.installing) {
          setUpdatePhase("installing");
          await nextPaint();
          await waitForWorkerInstall(reg.installing);
          if (reg.installing?.state === "redundant") throw new Error("Instalação rejeitada pelo navegador");
          completePhase("installing");
        } else if (reg.waiting) {
          // Se já está em waiting, o browser descarregou e instalou os ficheiros
          // em segundo plano antes do clique. Mostramos esse facto como concluído,
          // sem inventar uma transferência que já aconteceu.
          setUpdatePhase("installing");
          await nextPaint();
          completePhase("installing");
          await nextPaint();
        }

        if (!reg.waiting) {
          // Dá uma pequena oportunidade ao estado installing -> waiting de ficar
          // refletido na Registration antes de considerar a atualização falhada.
          await delay(120);
        }

        if (!reg.waiting) throw new Error("Nova versão não ficou pronta para ativação");

        setUpdatePhase("activating");
        await nextPaint();
        const controllerChanged = waitForControllerChange();
        if (!activateWaitingWorker(reg)) throw new Error("Não foi possível ativar a nova versão");
        if (!(await controllerChanged)) throw new Error("O navegador não confirmou a ativação");
        completePhase("activating");
        setUpdateAvailable(false);
      } else {
        // Navegadores sem Service Worker só podem obter os novos ficheiros através
        // de uma navegação integral; ainda assim a interface não finge instalação.
        completePhase("checking");
        completePhase("installing");
        completePhase("activating");
      }

      setUpdatePhase("restarting");
      await nextPaint();
      completePhase("restarting");
      await nextPaint();

      const elapsed = performance.now() - startedAt;
      if (elapsed < MIN_PROGRESS_VISIBLE_MS) await delay(MIN_PROGRESS_VISIBLE_MS - elapsed);
      await delay(FINAL_STATE_VISIBLE_MS);
      hardReload();
    } catch {
      clearUpdateTarget(targetVersion);
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
