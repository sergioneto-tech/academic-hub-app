import { useEffect } from "react";
import {
  FEEDBACK_BETA_EVENT,
  isFeedbackBetaManager,
  loadFeedbackStore,
} from "@/lib/feedbackBeta";
import {
  getStoredSession,
  refreshSession,
  storeSession,
  type AuthSession,
  type CloudConfig,
} from "@/lib/cloudSync";
import { getPublicSupabaseConfig } from "@/lib/publicSupabaseConfig";

const STYLE_ID = "academic-hub-feedback-ui-fix";
const SUPPORT_ID_PATTERN = /^AH-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
const supportIdsByReference = new Map<string, string>();
let supportIdsLoadedAt = 0;
let supportIdsBusy = false;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    [data-ah-feedback-sound="true"] { display: none !important; }
    #academic-hub-feedback-filters { display: none !important; }

    [data-feedback-kind="opinion"] { border-color: rgb(59 130 246 / .58) !important; background: rgb(59 130 246 / .035) !important; }
    [data-feedback-kind="opinion"] svg { color: rgb(96 165 250) !important; }
    [data-feedback-kind="opinion"][data-selected="true"] { border-color: rgb(96 165 250) !important; background: rgb(59 130 246 / .16) !important; box-shadow: 0 0 0 1px rgb(96 165 250 / .3); }

    [data-feedback-kind="suggestion"] { border-color: rgb(34 197 94 / .58) !important; background: rgb(34 197 94 / .035) !important; }
    [data-feedback-kind="suggestion"] svg { color: rgb(74 222 128) !important; }
    [data-feedback-kind="suggestion"][data-selected="true"] { border-color: rgb(74 222 128) !important; background: rgb(34 197 94 / .15) !important; box-shadow: 0 0 0 1px rgb(74 222 128 / .28); }

    [data-feedback-kind="bug"] { border-color: rgb(239 68 68 / .58) !important; background: rgb(239 68 68 / .035) !important; }
    [data-feedback-kind="bug"] svg { color: rgb(248 113 113) !important; }
    [data-feedback-kind="bug"][data-selected="true"] { border-color: rgb(248 113 113) !important; background: rgb(239 68 68 / .15) !important; box-shadow: 0 0 0 1px rgb(248 113 113 / .28); }

    button[data-feedback-list-kind="opinion"] { border-left: 4px solid rgb(59 130 246) !important; }
    button[data-feedback-list-kind="suggestion"] { border-left: 4px solid rgb(34 197 94) !important; }
    button[data-feedback-list-kind="bug"] { border-left: 4px solid rgb(239 68 68) !important; }

    .ah-feedback-support-id {
      display: inline-flex;
      width: fit-content;
      max-width: 100%;
      align-items: center;
      margin-top: .45rem;
      border: 1px solid rgb(16 185 129 / .34);
      border-radius: 9999px;
      background: rgb(16 185 129 / .08);
      padding: .22rem .48rem;
      color: rgb(16 185 129);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: .68rem;
      font-weight: 650;
      line-height: 1rem;
      white-space: nowrap;
    }
    .dark .ah-feedback-support-id { color: rgb(110 231 183); }

    .ah-feedback-stats { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    @media (min-width: 1280px) { .ah-feedback-stats { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }
  `;
  document.head.appendChild(style);
}

function sessionNeedsRefresh(session: AuthSession) {
  const expiresAtMs = Number(session.expires_at ?? 0) * 1000;
  return Boolean(expiresAtMs && expiresAtMs <= Date.now() + 60_000);
}

async function requestSupportIds(config: CloudConfig, session: AuthSession) {
  const url = new URL(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/feedback_requests`);
  url.searchParams.set("select", "reference,sender_support_id");
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", "200");

  return fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
      Accept: "application/json",
    },
  });
}

async function refreshSupportIds(force = false) {
  if (!window.location.hash.includes("/feedback") || !isFeedbackBetaManager() || supportIdsBusy) return;
  if (!force && Date.now() - supportIdsLoadedAt < 30_000) return;

  const config = getPublicSupabaseConfig();
  if (!config) return;
  let session = getStoredSession(config);
  if (!session) return;

  supportIdsBusy = true;
  try {
    if (sessionNeedsRefresh(session)) {
      try {
        session = await refreshSession(config, session);
        storeSession(config, session);
      } catch {
        return;
      }
    }

    let response = await requestSupportIds(config, session);
    if (response.status === 401) {
      try {
        session = await refreshSession(config, session);
        storeSession(config, session);
        response = await requestSupportIds(config, session);
      } catch {
        return;
      }
    }
    if (!response.ok) return;

    const rows = (await response.json().catch(() => [])) as Array<{
      reference?: unknown;
      sender_support_id?: unknown;
    }>;
    supportIdsByReference.clear();
    for (const row of rows) {
      const reference = typeof row.reference === "string" ? row.reference.trim() : "";
      const supportId = typeof row.sender_support_id === "string" ? row.sender_support_id.trim().toUpperCase() : "";
      if (reference && SUPPORT_ID_PATTERN.test(supportId)) supportIdsByReference.set(reference, supportId);
    }
    supportIdsLoadedAt = Date.now();
    window.requestAnimationFrame(applyFixes);
  } finally {
    supportIdsBusy = false;
  }
}

function ensureSupportBadge(button: HTMLButtonElement, supportId: string) {
  let badge = button.querySelector<HTMLElement>("[data-ah-feedback-support-id]");
  if (!badge) {
    badge = document.createElement("span");
    badge.dataset.ahFeedbackSupportId = "true";
    badge.className = "ah-feedback-support-id";
    button.appendChild(badge);
  }
  badge.textContent = `Remetente · ${supportId}`;
  badge.setAttribute("aria-label", `ID Academic Hub do remetente: ${supportId}`);
}

function applyFixes() {
  if (!window.location.hash.includes("/feedback")) return;

  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const text = (button.textContent || "").trim();
    if (text.startsWith("Som interno")) button.dataset.ahFeedbackSound = "true";
    if (text === "Opinião") button.dataset.feedbackKind = "opinion";
    if (text === "Sugestão") button.dataset.feedbackKind = "suggestion";
    if (text === "Problema") button.dataset.feedbackKind = "bug";
    if (button.dataset.feedbackKind) button.dataset.selected = button.className.includes("bg-primary/10") ? "true" : "false";
  });

  const statLabels = ["Novos", "Em análise", "Em desenvolvimento", "Concluídos"];
  const cards = statLabels.map((label) => {
    const node = Array.from(document.querySelectorAll<HTMLElement>("div")).find((item) => item.textContent?.trim() === label);
    return node?.closest<HTMLElement>(".premium-card") ?? null;
  }).filter((item): item is HTMLElement => Boolean(item));
  if (cards.length === 4 && cards.every((card) => card.parentElement === cards[0].parentElement)) cards[0].parentElement?.classList.add("ah-feedback-stats");

  const entries = loadFeedbackStore().entries;
  const manager = isFeedbackBetaManager();
  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const entry = entries.find((item) => button.textContent?.includes(item.reference));
    if (!entry) return;
    button.dataset.feedbackListKind = entry.kind;
    const supportId = manager ? supportIdsByReference.get(entry.reference) : undefined;
    if (supportId) ensureSupportBadge(button, supportId);
  });
}

function schedule(forceSupportRefresh = false) {
  [0, 80, 250, 700].forEach((delay) => window.setTimeout(() => window.requestAnimationFrame(applyFixes), delay));
  void refreshSupportIds(forceSupportRefresh);
}

export default function FeedbackBetaUiFix() {
  useEffect(() => {
    ensureStyles();
    schedule(true);
    const refresh = () => schedule(true);
    const click = () => { if (window.location.hash.includes("/feedback")) window.setTimeout(applyFixes, 0); };
    window.addEventListener(FEEDBACK_BETA_EVENT, refresh);
    window.addEventListener("hashchange", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener(FEEDBACK_BETA_EVENT, refresh);
      window.removeEventListener("hashchange", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("click", click, true);
    };
  }, []);
  return null;
}
