import type { AppState } from "@/lib/types";
import { migrate } from "@/lib/storage";

export const CLOUD_SYNC_BASELINE_KEY = "academic_hub_cloud_sync_baseline_v2";
export const CLOUD_CONFLICT_KEY = "academic_hub_cloud_conflict";
export const CLOUD_CONFLICT_CHANGED_EVENT = "academic-hub:cloud-conflict-changed";
export const DEVICE_ID_KEY = "academic_hub_device_id";
export const DEVICE_LABEL_KEY = "academic_hub_device_label";

function stableKey(value: unknown): string {
  if (value && typeof value === "object") {
    const item = value as { id?: string; code?: string; courseId?: string };
    if (item.id) return `id:${item.id}`;
    if (item.code) return `code:${item.code}`;
    if (item.courseId) return `course:${item.courseId}`;
  }
  try { return JSON.stringify(value); } catch { return String(value); }
}

function stableSort<T>(items: T[] | undefined): T[] {
  return [...(items ?? [])].sort((a, b) => stableKey(a).localeCompare(stableKey(b), "pt-PT"));
}

/** Normaliza backups/cloud antigos para a estrutura atual antes de comparar ou aplicar. */
export function normalizeCloudState(raw: unknown): AppState {
  return migrate(raw);
}

/**
 * Fingerprint apenas dos dados académicos/preferências que devem sincronizar.
 * Exclui metadados de sincronização e ordena coleções para evitar falsos conflitos.
 */
export function cloudStateFingerprint(raw: AppState | unknown): string {
  const state = normalizeCloudState(raw);
  return JSON.stringify({
    degree: state.degree ?? null,
    courses: stableSort(state.courses),
    assessments: stableSort(state.assessments),
    rules: stableSort(state.rules),
    studyBlocks: stableSort(state.studyBlocks),
    profile: state.profile ?? {},
    appearance: state.appearance ?? { theme: "system" },
    notifications: state.notifications ?? { deadlines: true, exams: true, grades: true },
    lastSeenRelease: state.lastSeenRelease ?? null,
  });
}

export function getSyncBaseline(): string | null {
  try { return localStorage.getItem(CLOUD_SYNC_BASELINE_KEY); } catch { return null; }
}

export function setSyncBaseline(stateOrFingerprint: AppState | string) {
  const fingerprint = typeof stateOrFingerprint === "string" ? stateOrFingerprint : cloudStateFingerprint(stateOrFingerprint);
  try { localStorage.setItem(CLOUD_SYNC_BASELINE_KEY, fingerprint); } catch { /* ignore */ }
}

export function clearSyncBaseline() {
  try { localStorage.removeItem(CLOUD_SYNC_BASELINE_KEY); } catch { /* ignore */ }
}

export function clearCloudConflict() {
  try { localStorage.removeItem(CLOUD_CONFLICT_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event(CLOUD_CONFLICT_CHANGED_EVENT));
}

export function hasCloudConflict(): boolean {
  try { return Boolean(localStorage.getItem(CLOUD_CONFLICT_KEY)); } catch { return false; }
}

export function isLocallyFresh(raw: AppState | unknown): boolean {
  const state = normalizeCloudState(raw);
  const hasMeaningfulCourseData = state.courses.some((course) => course.isActive || course.isCompleted);
  const hasGrades = state.assessments.some((assessment) => assessment.grade !== null);
  const hasStudyBlocks = Boolean(state.studyBlocks?.length);
  return !state.degree && !hasMeaningfulCourseData && !hasGrades && !hasStudyBlocks;
}

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceLabel() {
  let label = localStorage.getItem(DEVICE_LABEL_KEY);
  if (label) return label;
  const ua = navigator.userAgent.toLowerCase();
  const type = /ipad|tablet/.test(ua) ? "tablet" : /mobi|android|iphone/.test(ua) ? "telemóvel" : "computador";
  let platform = navigator.platform || "dispositivo";
  if (/windows/.test(ua)) platform = "Windows";
  else if (/android/.test(ua)) platform = "Android";
  else if (/iphone|ipad/.test(ua)) platform = "iOS/iPadOS";
  else if (/mac os/.test(ua)) platform = "macOS";
  label = `${type} · ${platform}`;
  localStorage.setItem(DEVICE_LABEL_KEY, label);
  return label;
}
