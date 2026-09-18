import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { APP_VERSION } from "@/lib/version";
import { reportClientError } from "@/lib/clientErrorReporting";
import {
  clearUpdateTarget,
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
const PHASE_MIN_VISIBLE_MS: Partial<Record<UpdatePhase, number>> = {
  preparing: 480,
  checking: 620,
  installing: 780,
  activating: 680,
  restarting: 520,
};
const PHASE_COMPLETE_HOLD_MS = 260;
const FINAL_STATE_VISIBLE_MS = 1050;
const WORKER_READY_FIRST_TIMEOUT_MS = 12_000;
const WORKER_READY_RETRY_TIMEOUT_MS = 30_000;
const WORKER_READY_RETRY_DELAY_MS = 1_200;

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

function waitForWaitingWorker(registration: ServiceWorkerRegistration, timeoutMs: number) {
  if (registration.waiting) return Promise.resolve(registration.waiting);

  return new Promise<ServiceWorker>((resolve, reject) => {
    let finished = false;
    let observedWorker: ServiceWorker | null = null;

    const cleanup = () => {
      window.clearTimeout(timeout);
      registration.removeEventListener("updatefound", onUpdateFound);
      observedWorker?.removeEventListener("statechange", onStateChange);
    };

    const finish = (worker: ServiceWorker) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(worker);
    };

    const fail = (message: string) => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error(message));
    };

    const observeCurrentInstallingWorker = () => {
      const current = registration.installing;
      if (!current || current === observedWorker) return;
      observedWorker?.removeEventListener("statechange", onStateChange);
      observedWorker = current;
      observedWorker.addEventListener("statechange", onStateChange);
    };

    const checkState = () => {
      if (registration.waiting) {
        finish(registration.waiting);
        return;
      }

      observeCurrentInstallingWorker();
      if (observedWorker?.state === "redundant") {
        fail("Instalação rejeitada pelo navegador");
      }
    };

    function onStateChange() {
      checkState();
    }

    function onUpdateFound() {
      checkState();
    }

    registration.addEventListener("updatefound", onUpdateFound);
    observeCurrentInstallingWorker();

    const timeout = window.setTimeout(() => {
      if (registration.waiting) finish(registration.waiting);
      else fail("Nova versão demorou demasiado a ficar pronta para ativação");
    }, timeoutMs);

    checkState();
  });
}

async function ensureWaitingWorker(registration: ServiceWorkerRegistration) {
  if (registration.waiting) return registration.waiting;

  let firstError: unknown;
  try {
    return await waitForWaitingWorker(registration, WORKER_READY_FIRST_TIMEOUT_MS);
  } catch (error) {
    firstError = error;
  }

  // Uma publicação pode estar a propagar-se entre o HTML, o Service Worker e os
  // restantes ficheiros. Faz uma segunda verificação real antes de declarar falha.
  await delay(WORKER_READY_RETRY_DELAY_MS);
  try {
    await registration.update();
    return await waitForWaitingWorker(registration, WORKER_READY_RETRY_TIMEOUT_MS);
  } catch (retryError) {
    const firstMessage = firstError instanceof Error ? firstError.message : "falha inicial desconhecida";
    const retryMessage = retryError instanceof Error ? retryError.message : "falha final desconhecida";
    throw new Error(`${retryMessage} (primeira tentativa: ${firstMessage})`);
  }
}

function waitForControllerChange(timeoutMs = 15_000) {
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
      const hasPendingWorker = Boolean(reg?.waiting || (reg?.installing && navigator.serviceWorker.controller));
      // Uma revisão técnica do Service Worker pode existir sem mudar APP_VERSION.
      // Qualquer worker novo pendente deve ser apresentado em todos os dispositivos.
      setUpdateAvailable(hasPendingWorker);
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

  const runVisiblePhase = async <T,>(phase: UpdatePhase, operation: () => Promise<T> | T) => {
    setUpdatePhase(phase);
    await nextPaint();
    const startedAt = performance.now();
    const value = await operation();
    const minimum = PHASE_MIN_VISIBLE_MS[phase] ?? 0;
    const elapsed = performance.now() - startedAt;
    if (elapsed < minimum) await delay(minimum - elapsed);
    completePhase(phase);
    await nextPaint();
    await delay(PHASE_COMPLETE_HOLD_MS);
    return value;
  };

  const applyUpdate = async (targetVersion?: string) => {
    if (applyingRef.current) return;
    applyingRef.current = true;
    setCompletedUpdatePhases([]);
    let resolvedTargetVersion = "";

    try {
      resolvedTargetVersion = await runVisiblePhase("preparing", async () => {
        const resolved = await resolvePublishedTargetVersion(targetVersion);
        if (!resolved) throw new Error("Versão-alvo indisponível");
        markUpdateTarget(resolved);
        return resolved;
      });

      const reg = regRef.current;
      if (!reg && isSupported) throw new Error("Service Worker indisponível");

      if (reg) {
        await runVisiblePhase("checking", async () => {
          await reg.update();
        });

        await runVisiblePhase("installing", async () => {
          await ensureWaitingWorker(reg);
        });

        await runVisiblePhase("activating", async () => {
          const controllerChanged = waitForControllerChange();
          if (!activateWaitingWorker(reg)) throw new Error("Não foi possível ativar a nova versão");
          if (!(await controllerChanged)) throw new Error("O navegador não confirmou a ativação");
        });
        setUpdateAvailable(false);
      } else {
        await runVisiblePhase("checking", async () => undefined);
        await runVisiblePhase("installing", async () => undefined);
        await runVisiblePhase("activating", async () => undefined);
      }

      await runVisiblePhase("restarting", async () => undefined);
      await delay(FINAL_STATE_VISIBLE_MS);
      hardReload();
    } catch (error) {
      console.error("[Academic Hub] Falha ao aplicar atualização", error);
      void reportClientError({
        errorCode: "update_failed",
        summary: error instanceof Error ? error.message : "Falha ao aplicar a atualização.",
      });
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
