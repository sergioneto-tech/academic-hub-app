export const UPDATE_RESTART_PARAM = "ah_update";
export const UPDATE_REPAIR_PARAM = "ah_repair";
export const UPDATE_TARGET_VERSION_KEY = "academicHub:updateTargetVersion";
export const UPDATE_COMPLETED_VERSION_KEY = "academicHub:updateCompletedVersion";
export const UPDATE_DEFER_KEY = "academicHub:updateDeferred";
export const LOCAL_LAST_SEEN_VERSION_KEY = "academic_hub_last_seen_version";

export type UpdateStartupStatus = "normal" | "completed" | "repair-needed";

function safeGet(key: string) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // O estado visual da atualização não pode bloquear a aplicação.
  }
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // O estado visual da atualização não pode bloquear a aplicação.
  }
}

export function getUpdateTargetVersion() {
  return safeGet(UPDATE_TARGET_VERSION_KEY);
}

export function markUpdateTarget(version: string | undefined) {
  const normalized = version?.trim();
  if (!normalized) return;
  safeSet(UPDATE_TARGET_VERSION_KEY, normalized);
  if (safeGet(UPDATE_DEFER_KEY) === normalized) safeRemove(UPDATE_DEFER_KEY);
}

export function clearUpdateTarget(version?: string) {
  const normalized = version?.trim();
  if (!normalized || safeGet(UPDATE_TARGET_VERSION_KEY) === normalized) {
    safeRemove(UPDATE_TARGET_VERSION_KEY);
  }
}

export function registerUpdateStartup(currentVersion: string, href: string): UpdateStartupStatus {
  let restartedFromUpdater = false;
  try {
    restartedFromUpdater = new URL(href).searchParams.has(UPDATE_RESTART_PARAM);
  } catch {
    restartedFromUpdater = false;
  }

  const targetVersion = safeGet(UPDATE_TARGET_VERSION_KEY);
  const reachedTarget = Boolean(targetVersion && targetVersion === currentVersion);

  if (reachedTarget) {
    safeSet(UPDATE_COMPLETED_VERSION_KEY, currentVersion);
    safeRemove(UPDATE_TARGET_VERSION_KEY);
    if (safeGet(LOCAL_LAST_SEEN_VERSION_KEY) === currentVersion) {
      safeRemove(LOCAL_LAST_SEEN_VERSION_KEY);
    }
    return "completed";
  }

  if (restartedFromUpdater && targetVersion && targetVersion !== currentVersion) {
    // O atualizador reiniciou, mas o bundle carregado continua numa versão
    // diferente da versão-alvo. Não declara sucesso: pede reparação local do
    // Service Worker/cache e mantém a versão-alvo para validar o novo arranque.
    return "repair-needed";
  }

  if (safeGet(UPDATE_COMPLETED_VERSION_KEY) !== currentVersion) {
    // Se o bundle novo entrar antes de existir um reinício confirmado pelo
    // atualizador, impede o Layout de mostrar "O que mudou" prematuramente.
    safeSet(LOCAL_LAST_SEEN_VERSION_KEY, currentVersion);
  }

  return "normal";
}

export function shouldShowCompletedRelease(currentVersion: string) {
  return safeGet(UPDATE_COMPLETED_VERSION_KEY) === currentVersion
    && safeGet(LOCAL_LAST_SEEN_VERSION_KEY) !== currentVersion;
}

export function markCompletedReleaseSeen(currentVersion: string) {
  safeSet(LOCAL_LAST_SEEN_VERSION_KEY, currentVersion);
  if (safeGet(UPDATE_COMPLETED_VERSION_KEY) === currentVersion) {
    safeRemove(UPDATE_COMPLETED_VERSION_KEY);
  }
}

export function deferReleaseUpdate(version: string | undefined) {
  const normalized = version?.trim();
  if (!normalized) return;
  safeSet(UPDATE_DEFER_KEY, normalized);
}

export function isReleaseUpdateDeferred(version: string | undefined) {
  const normalized = version?.trim();
  return Boolean(normalized && safeGet(UPDATE_DEFER_KEY) === normalized);
}
