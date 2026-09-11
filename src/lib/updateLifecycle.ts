export const UPDATE_RESTART_PARAM = "ah_update";
export const UPDATE_TARGET_VERSION_KEY = "academicHub:updateTargetVersion";
export const UPDATE_COMPLETED_VERSION_KEY = "academicHub:updateCompletedVersion";
export const UPDATE_DEFER_KEY = "academicHub:updateDeferred";
export const LOCAL_LAST_SEEN_VERSION_KEY = "academic_hub_last_seen_version";

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

export function markUpdateTarget(version: string | undefined) {
  const normalized = version?.trim();
  if (!normalized) return;
  safeSet(UPDATE_TARGET_VERSION_KEY, normalized);
  if (safeGet(UPDATE_DEFER_KEY) === normalized) safeRemove(UPDATE_DEFER_KEY);
}

export function registerUpdateStartup(currentVersion: string, href: string) {
  let restartedFromUpdater = false;
  try {
    restartedFromUpdater = new URL(href).searchParams.has(UPDATE_RESTART_PARAM);
  } catch {
    restartedFromUpdater = false;
  }

  const targetVersion = safeGet(UPDATE_TARGET_VERSION_KEY);
  const explicitCompletion = restartedFromUpdater || targetVersion === currentVersion;

  if (explicitCompletion) {
    safeSet(UPDATE_COMPLETED_VERSION_KEY, currentVersion);
    safeRemove(UPDATE_TARGET_VERSION_KEY);
  }

  return explicitCompletion;
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
