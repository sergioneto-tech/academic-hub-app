export const MIGRATION_NOTICE_KEY = "academic_hub_migration_notice_2026_08_05";
export const MIGRATION_NOTICE_DISMISSED_EVENT = "academic-hub:migration-notice-dismissed";

const STATE_KEYS = ["academic_hub_state", "academic_hub_state_v2", "academic_hub_state_v1"] as const;

function hasMeaningfulData(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  const profile = state.profile && typeof state.profile === "object" && !Array.isArray(state.profile)
    ? state.profile as Record<string, unknown>
    : {};

  return Boolean(
    state.degree ||
    (Array.isArray(state.courses) && state.courses.length > 0) ||
    (Array.isArray(state.assessments) && state.assessments.length > 0) ||
    (Array.isArray(state.studyBlocks) && state.studyBlocks.length > 0) ||
    profile.displayName ||
    profile.avatarUrl ||
    profile.avatarPath
  );
}

export function hasLegacyDataToMigrate(): boolean {
  try {
    return STATE_KEYS.some((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      try {
        return hasMeaningfulData(JSON.parse(raw));
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function isMigrationNoticePending(): boolean {
  try {
    if (localStorage.getItem(MIGRATION_NOTICE_KEY) === "dismissed") return false;
  } catch {
    return false;
  }
  return hasLegacyDataToMigrate();
}
