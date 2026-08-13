import { getStoredSession, type CloudConfig } from "@/lib/cloudSync";

export const FEEDBACK_BETA_MANAGER_USER_ID = "b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c";
export const FEEDBACK_BETA_EVENT = "academic-hub-feedback-beta-changed";
const STORAGE_KEY = "academic_hub_feedback_beta_v1";
const SOUND_KEY = "academic_hub_notification_sound";

export type FeedbackKind = "opinion" | "suggestion" | "bug";
export type FeedbackStatus = "new" | "reviewing" | "waiting_user" | "planned" | "in_development" | "completed" | "not_planned" | "archived";
export type FeedbackMessage = { id: string; author: "student" | "academic_hub"; body: string; createdAt: string };
export type FeedbackHistoryItem = { id: string; status: FeedbackStatus; note?: string; createdAt: string };
export type FeedbackAttachment = { id: string; name: string; type: string; size: number; previewUrl?: string };
export type FeedbackEntry = {
  id: string;
  reference: string;
  userId: string;
  kind: FeedbackKind;
  area?: string;
  title: string;
  body: string;
  steps?: string;
  expected?: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
  resolutionNote?: string;
  resolvedVersion?: string;
  appVersion: string;
  device: string;
  attachments: FeedbackAttachment[];
  messages: FeedbackMessage[];
  history: FeedbackHistoryItem[];
};

export type AcademicHubSoundKind = "confirm" | "warning" | "error" | "notification";
type FeedbackStore = { entries: FeedbackEntry[]; counter: number };
let lastSoundAt = 0;

function cloudConfig(): CloudConfig | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

function isPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host === "feature-feedback-beta.academic-hub-app.pages.dev") return true;
  return host.endsWith(".academic-hub-app.pages.dev") && host !== "academic-hub-app.pages.dev";
}

export function currentFeedbackUserId(): string | null {
  const config = cloudConfig();
  if (!config) return isPreviewHost() ? "feedback-beta-preview" : null;
  return getStoredSession(config)?.user.id ?? (isPreviewHost() ? "feedback-beta-preview" : null);
}

export function isFeedbackBetaManager(): boolean {
  return currentFeedbackUserId() === FEEDBACK_BETA_MANAGER_USER_ID || isPreviewHost();
}

export function isFeedbackBetaEnabled(): boolean {
  return isFeedbackBetaManager();
}

function emptyStore(): FeedbackStore { return { entries: [], counter: 0 }; }

export function loadFeedbackStore(): FeedbackStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as FeedbackStore;
    return { entries: Array.isArray(parsed.entries) ? parsed.entries : [], counter: Number(parsed.counter) || 0 };
  } catch {
    return emptyStore();
  }
}

export function saveFeedbackStore(store: FeedbackStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(FEEDBACK_BETA_EVENT));
}

export function unreadFeedbackCount(): number {
  if (!isFeedbackBetaManager()) return 0;
  return loadFeedbackStore().entries.filter((entry) => !entry.readAt).length;
}

export function createFeedback(input: Omit<FeedbackEntry, "id" | "reference" | "status" | "createdAt" | "updatedAt" | "readAt" | "messages" | "history">): FeedbackEntry {
  const store = loadFeedbackStore();
  const now = new Date().toISOString();
  const next = store.counter + 1;
  const entry: FeedbackEntry = {
    ...input,
    id: crypto.randomUUID(),
    reference: `AH-${String(next).padStart(4, "0")}`,
    status: "new",
    createdAt: now,
    updatedAt: now,
    messages: [],
    history: [{ id: crypto.randomUUID(), status: "new", note: "Feedback recebido pelo Academic Hub.", createdAt: now }],
  };
  saveFeedbackStore({ entries: [entry, ...store.entries], counter: next });
  return entry;
}

export function updateFeedback(entryId: string, updater: (entry: FeedbackEntry) => FeedbackEntry): FeedbackEntry | null {
  const store = loadFeedbackStore();
  let updated: FeedbackEntry | null = null;
  const entries = store.entries.map((entry) => {
    if (entry.id !== entryId) return entry;
    updated = { ...updater(entry), updatedAt: new Date().toISOString() };
    return updated;
  });
  saveFeedbackStore({ ...store, entries });
  return updated;
}

export function markFeedbackRead(entryId: string) {
  updateFeedback(entryId, (entry) => ({ ...entry, readAt: entry.readAt ?? new Date().toISOString() }));
}

export function setFeedbackStatus(entryId: string, status: FeedbackStatus, note?: string, resolvedVersion?: string) {
  return updateFeedback(entryId, (entry) => ({
    ...entry,
    status,
    resolutionNote: note || entry.resolutionNote,
    resolvedVersion: resolvedVersion || entry.resolvedVersion,
    history: [...entry.history, { id: crypto.randomUUID(), status, note, createdAt: new Date().toISOString() }],
  }));
}

export function addFeedbackMessage(entryId: string, body: string, author: "student" | "academic_hub") {
  const text = body.trim();
  if (!text) return null;
  return updateFeedback(entryId, (entry) => ({
    ...entry,
    messages: [...entry.messages, { id: crypto.randomUUID(), author, body: text, createdAt: new Date().toISOString() }],
  }));
}

export function notificationSoundEnabled(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
}

export function setNotificationSoundEnabled(enabled: boolean) {
  try { localStorage.setItem(SOUND_KEY, enabled ? "on" : "off"); } catch {}
}

const SOUND_PROFILES: Record<AcademicHubSoundKind, { start: number; end: number; duration: number; volume: number; type: OscillatorType }> = {
  confirm: { start: 620, end: 820, duration: 0.18, volume: 0.042, type: "sine" },
  warning: { start: 430, end: 330, duration: 0.22, volume: 0.047, type: "sine" },
  error: { start: 290, end: 185, duration: 0.25, volume: 0.052, type: "triangle" },
  notification: { start: 740, end: 980, duration: 0.24, volume: 0.056, type: "sine" },
};

export function playAcademicHubAppSound(kind: AcademicHubSoundKind = "confirm") {
  if (!notificationSoundEnabled() || typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastSoundAt < 140) return;
  lastSoundAt = now;
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const profile = SOUND_PROFILES[kind];
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = profile.type;
    oscillator.frequency.setValueAtTime(profile.start, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(profile.end, context.currentTime + profile.duration * 0.62);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(profile.volume, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + profile.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + profile.duration + 0.02);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {}
}

export function playAcademicHubNotificationSound() {
  playAcademicHubAppSound("notification");
}

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "Novo",
  reviewing: "Em análise",
  waiting_user: "A aguardar informação",
  planned: "Planeado",
  in_development: "Em desenvolvimento",
  completed: "Concluído",
  not_planned: "Não previsto",
  archived: "Arquivado",
};
