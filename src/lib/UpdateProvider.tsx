import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { APP_VERSION } from "@/lib/version";
import {
  clearUpdateTarget,
  getUpdateTargetVersion,
  markUpdateTarget,
  registerUpdateStartup,
  UPDATE_REPAIR_PARAM,
  UPDATE_RESTART_PARAM,
  type UpdateStartupStatus,
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
  url.searchParams.delete(UPDATE_REPAIR_PARAM);
  window.location.replace(url.toString());
}

async function resolvePublishedTargetVersion(explicitVersion?: string) {
  const explicit = explicitVersion?.trim();
  if (explicit) return explicit;

  try {
    const notesUrl = `${import.meta.env.BASE_URL ?? "./"}release-notes.json?update_target=${Date.now()}`;
    const response = await fetch(notesUrl, { cache: "no-store" });
    if (!response.ok) return "";
    const data = await response.json() as { latest?: unknown };
    return typeof data.latest === "string" ? data.latest.trim() : "";
  } catch {
    return "";
  }
}

async function repairStaleInstallation() {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const origin = window.location.origin;
    await Promise.all(
      registrations
        .filter((registration) => registration.scope.startsWith(origin))
        .map((registration) => registration.unregister().catch(() => false)),
    );
  } catch {
    // A limpeza de caches abaixo continua mesmo que o unregister falhe.
  }

  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("academic-hub-"))
        .map((key) => caches.delete(key)),
    );
  } catch {
    // O reload de reparação ainda força uma navegação nova pela rede.
  }

  const url = new URL(window.location.href);
  url.searchParams.delete(UPDATE_RESTART_PARAM);
  url.searchParams.set(UPDATE_REPAIR_PARAM, Date.now().toString());
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
  const startupStatusRef = useRef<UpdateStartupStatus>("normal");
  const [updatePhase, setUpdatePhase] = useState<UpdatePhase>("idle");
  const [completedUpdatePhases, setCompletedUpdatePhases] = useState<UpdatePhase[]>([]);

  const isSupported = typeof window !== "undefined" && "serviceWorker" in navigator;
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useLayoutEffect(() => {
    startupStatusRef.current = registerUpdateStartup(APP_VERSION, window.location.href);
    const url = new URL(window.location.href);
    const hadLifecycleParam = url.searchParams.has(UPDATE_RESTART_PARAM) || url.searchParams.has(UPDATE_REPAIR_PARAM);
    if (!hadLifecycleParam) return;
    url.searchParams.delete(UPDATE_RESTART_PARAM);
    url.searchParams.delete(UPDATE_REPAIR_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  useEffect(() => {
    if (!isSupported || !import.meta.env.PROD) {
      setUpdateAvailable(false);
      return;
    }

    if (startupStatusRef.current === "repair-needed") {
      void repairStaleInstallation();
      return;
    }

    const swUrl = `${import.meta.env.BASE_URL ?? "./"}sw.js`;
    let disposed = false;
    let registered: ServiceWorkerRegistration | null = null;
    let observedInstalling: ServiceWorker | null = null;
    let onUpdateFoundHandler: (() => void) | null = null;

    const syncRegistrationState = (reg: ServiceWorkerRegistration | null) => {
      if (disposed) return;
      const targetVersion = getUpdateTargetVersion();
      const hasPendingWorker = Boolean(reg?.waiting || (reg?.installing && navigator.serviceWorker.controller));
      setUpdateAvailable(Boolean(hasPendingWorker && targetVersion && targetVersion !== APP_VERSION));
    };

    const onInstallingStateChange = () => syncRegistrationState(regRef.current);

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
    setCompletedUpdatePhases([]);
    const startedAt = performance.now();
    let resolvedTargetVersion = "";

    try {
      setUpdatePhase("preparing");
      await nextPaint();
      resolvedTargetVersion = await resolvePublishedTargetVersion(targetVersion);
      if (!resolvedTargetVersion) throw new Error("Versão-alvo indisponível");
      markUpdateTarget(resolvedTargetVersion);
      completePhase("preparing");

      const reg = regRef.current;
      if (!reg && isSupported) throw new Error("Service Worker indisponível");

      if (reg) {
        setUpdatePhase("checking");
        await nextPaint();
        await reg.update();
        completePhase("checking");

        if (reg.installing) {
          const installingWorker = reg.installing;
          setUpdatePhase("installing");
          await nextPaint();
          await waitForWorkerInstall(installingWorker);
          if (installingWorker.state === "redundant") throw new Error("Instalação rejeitada pelo navegador");
          completePhase("installing");
        } else if (reg.waiting) {
          setUpdatePhase("installing");
          await nextPaint();
          completePhase("installing");
          await nextPaint();
        }

        if (!reg.waiting) await delay(120);
        if (!reg.waiting) throw new Error("Nova versão não ficou pronta para ativação");

        setUpdatePhase("activating");
        await nextPaint();
        const controllerChanged = waitForControllerChange();
        if (!activateWaitingWorker(reg)) throw new Error("Não foi possível ativar a nova versão");
        if (!(await controllerChanged)) throw new Error("O navegador não confirmou a ativação");
        completePhase("activating");
        setUpdateAvailable(false);
      } else {
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
      clearUpdateTarget(resolvedTargetVersion || targetVersion);
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
