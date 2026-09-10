import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStoredSession, refreshSession, type CloudConfig } from "@/lib/cloudSync";
import {
  FEEDBACK_BETA_EVENT,
  isFeedbackBetaManager,
  loadFeedbackStore,
  unreadFeedbackCount,
} from "@/lib/feedbackBeta";

const STYLE_ID = "academic-hub-feedback-beta-enhancements";
const FILTER_ID = "academic-hub-feedback-filters";
const RECEIPT_ID = "academic-hub-feedback-read-receipts";
const RECEIPT_REFRESH_MS = 15_000;
const READ_ATTEMPT_THROTTLE_MS = 5_000;

let activeType = "all";
let activeStatus = "all";
let lastDeepLinkKey = "";
const lastReadAttempt = new Map<string, number>();
let receiptRequestInFlight = "";

type ReceiptRow = {
  id: string;
  created_at: string;
  read_at: string | null;
};

const KIND_META = {
  opinion: { label: "Opinião", className: "opinion" },
  suggestion: { label: "Sugestão", className: "suggestion" },
  bug: { label: "Problema", className: "bug" },
} as const;

const STATUS_OPTIONS = [
  ["all", "Todos os estados"],
  ["new", "Novo"],
  ["reviewing", "Em análise"],
  ["waiting_user", "A aguardar informação"],
  ["planned", "Planeado"],
  ["in_development", "Em desenvolvimento"],
  ["completed", "Concluído"],
  ["not_planned", "Não previsto"],
  ["archived", "Arquivado"],
] as const;

function cloudConfig(): CloudConfig | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

async function ensureFeedbackSession() {
  const config = cloudConfig();
  if (!config) return null;
  const stored = getStoredSession(config);
  if (!stored) return null;

  let session = stored;
  const expiresAt = Number(stored.expires_at ?? 0) * 1000;
  if (expiresAt && expiresAt <= Date.now() + 60_000) {
    try {
      session = await refreshSession(config, stored);
    } catch {
      return null;
    }
  }

  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  return error ? null : session;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    a[href$="/feedback"] { position: relative; border: 1px solid hsl(var(--gold) / .42); background: linear-gradient(135deg, hsl(var(--gold-soft) / .42), transparent 76%); color: hsl(var(--gold)); }
    a[href$="/feedback"]:hover { border-color: hsl(var(--gold) / .72); background: hsl(var(--gold-soft) / .68); color: hsl(var(--gold)); }
    a[href$="/feedback"]::after { content: "BETA"; margin-left: auto; border: 1px solid hsl(var(--gold) / .48); border-radius: 999px; padding: .13rem .4rem; font-size: .52rem; line-height: 1; font-weight: 800; letter-spacing: .08em; color: hsl(var(--gold)); background: hsl(var(--gold-soft) / .62); }
    a[href$="/feedback"][data-feedback-unread="true"] { box-shadow: 0 0 0 1px hsl(var(--gold) / .24), 0 0 18px hsl(var(--gold) / .18); animation: ah-feedback-pulse 1.9s ease-in-out infinite; }
    a[href$="/feedback"][data-feedback-unread="true"]::after { content: attr(data-feedback-count); min-width: 1.25rem; text-align: center; background: hsl(var(--destructive)); border-color: hsl(var(--destructive)); color: hsl(var(--destructive-foreground)); letter-spacing: 0; }
    .ah-feedback-kind-counts { display: inline-flex; align-items: center; gap: .22rem; margin-left: auto; }
    .ah-feedback-kind-count { display: inline-grid; place-items: center; min-width: 1.15rem; height: 1.15rem; padding: 0 .25rem; border-radius: 999px; font-size: .57rem; line-height: 1; font-weight: 800; color: white; box-shadow: 0 0 0 2px hsl(var(--sidebar-background)); }
    .ah-feedback-kind-count.opinion { background: rgb(59 130 246); }
    .ah-feedback-kind-count.suggestion { background: rgb(34 197 94); }
    .ah-feedback-kind-count.bug { background: rgb(239 68 68); }
    a[href$="/feedback"]:has(.ah-feedback-kind-counts)::after { margin-left: .28rem; }
    [data-feedback-kind="opinion"] { border-color: rgb(59 130 246 / .48) !important; }
    [data-feedback-kind="opinion"] svg { color: rgb(96 165 250) !important; }
    [data-feedback-kind="opinion"][data-selected="true"] { background: rgb(59 130 246 / .14) !important; border-color: rgb(96 165 250 / .92) !important; box-shadow: 0 0 0 1px rgb(96 165 250 / .28); }
    [data-feedback-kind="suggestion"] { border-color: rgb(34 197 94 / .48) !important; }
    [data-feedback-kind="suggestion"] svg { color: rgb(74 222 128) !important; }
    [data-feedback-kind="suggestion"][data-selected="true"] { background: rgb(34 197 94 / .13) !important; border-color: rgb(74 222 128 / .92) !important; box-shadow: 0 0 0 1px rgb(74 222 128 / .26); }
    [data-feedback-kind="bug"] { border-color: rgb(239 68 68 / .48) !important; }
    [data-feedback-kind="bug"] svg { color: rgb(248 113 113) !important; }
    [data-feedback-kind="bug"][data-selected="true"] { background: rgb(239 68 68 / .13) !important; border-color: rgb(248 113 113 / .92) !important; box-shadow: 0 0 0 1px rgb(248 113 113 / .26); }
    button[data-feedback-list-kind="opinion"] { border-left: 4px solid rgb(59 130 246) !important; background-image: linear-gradient(90deg, rgb(59 130 246 / .08), transparent 34%); }
    button[data-feedback-list-kind="suggestion"] { border-left: 4px solid rgb(34 197 94) !important; background-image: linear-gradient(90deg, rgb(34 197 94 / .08), transparent 34%); }
    button[data-feedback-list-kind="bug"] { border-left: 4px solid rgb(239 68 68) !important; background-image: linear-gradient(90deg, rgb(239 68 68 / .08), transparent 34%); }
    button[data-feedback-deeplink="true"] { outline: 2px solid hsl(var(--gold)); outline-offset: 2px; box-shadow: 0 0 0 5px hsl(var(--gold) / .16), 0 12px 30px hsl(var(--gold) / .18) !important; animation: ah-feedback-deeplink 1.1s ease-in-out 2; }
    #${FILTER_ID} { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .55rem; margin: 0 1.5rem .8rem; padding: .7rem; border: 1px solid hsl(var(--border)); border-radius: .85rem; background: hsl(var(--muted) / .22); }
    #${FILTER_ID} label { display: grid; gap: .3rem; min-width: 0; font-size: .68rem; font-weight: 700; color: hsl(var(--muted-foreground)); }
    #${FILTER_ID} select { width: 100%; min-width: 0; height: 2.35rem; border: 1px solid hsl(var(--input)); border-radius: .7rem; padding: 0 .65rem; background: hsl(var(--background)); color: hsl(var(--foreground)); font-size: .78rem; }
    #${RECEIPT_ID} { margin-top: 1rem; border: 1px solid hsl(var(--gold) / .28); border-radius: .85rem; padding: .85rem; background: hsl(var(--gold-soft) / .13); }
    #${RECEIPT_ID} .ah-receipt-title { font-size: .75rem; font-weight: 750; color: hsl(var(--foreground)); }
    #${RECEIPT_ID} .ah-receipt-help { margin-top: .18rem; font-size: .66rem; line-height: 1.35; color: hsl(var(--muted-foreground)); }
    #${RECEIPT_ID} .ah-receipt-list { display: grid; gap: .45rem; margin-top: .65rem; }
    #${RECEIPT_ID} .ah-receipt-row { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .35rem .75rem; border-top: 1px solid hsl(var(--border) / .7); padding-top: .45rem; font-size: .68rem; }
    #${RECEIPT_ID} .ah-receipt-sent { color: hsl(var(--muted-foreground)); }
    #${RECEIPT_ID} .ah-receipt-read { color: rgb(16 185 129); font-weight: 700; }
    #${RECEIPT_ID} .ah-receipt-pending { color: hsl(var(--muted-foreground)); font-weight: 650; }
    @keyframes ah-feedback-pulse { 0%,100% { box-shadow: 0 0 0 1px hsl(var(--gold) / .18), 0 0 0 hsl(var(--gold) / 0); } 50% { box-shadow: 0 0 0 1px hsl(var(--gold) / .42), 0 0 20px hsl(var(--gold) / .22); } }
    @keyframes ah-feedback-deeplink { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
    @media (max-width: 639px) { #${FILTER_ID} { grid-template-columns: minmax(0, 1fr); margin-inline: 1rem; } .ah-feedback-kind-counts { gap: .18rem; } #${RECEIPT_ID} .ah-receipt-row { display: grid; } }
    @media (prefers-reduced-motion: reduce) { a[href$="/feedback"][data-feedback-unread="true"], button[data-feedback-deeplink="true"] { animation: none; } }
  `;
  document.head.appendChild(style);
}

function enhanceMenu() {
  const entries = loadFeedbackStore().entries;
  const unread = entries.filter((entry) => !entry.readAt);
  const count = unreadFeedbackCount();
  const byKind = {
    opinion: unread.filter((entry) => entry.kind === "opinion").length,
    suggestion: unread.filter((entry) => entry.kind === "suggestion").length,
    bug: unread.filter((entry) => entry.kind === "bug").length,
  };

  document.querySelectorAll<HTMLAnchorElement>('a[href$="/feedback"]').forEach((link) => {
    link.dataset.feedbackUnread = count > 0 ? "true" : "false";
    link.dataset.feedbackCount = String(count);
    const desired = (Object.keys(KIND_META) as Array<keyof typeof KIND_META>)
      .filter((kind) => byKind[kind] > 0)
      .map((kind) => `${kind}:${byKind[kind]}`)
      .join("|");
    if ((link.dataset.feedbackKinds || "") === desired) return;
    link.dataset.feedbackKinds = desired;
    link.querySelector(".ah-feedback-kind-counts")?.remove();
    if (!desired) return;

    const group = document.createElement("span");
    group.className = "ah-feedback-kind-counts";
    (Object.keys(KIND_META) as Array<keyof typeof KIND_META>).forEach((kind) => {
      const kindCount = byKind[kind];
      if (!kindCount) return;
      const badge = document.createElement("span");
      badge.className = `ah-feedback-kind-count ${KIND_META[kind].className}`;
      badge.textContent = String(kindCount);
      badge.title = `${kindCount} ${KIND_META[kind].label.toLowerCase()}${kindCount > 1 ? "s" : ""} nova${kindCount > 1 ? "s" : ""}`;
      group.appendChild(badge);
    });
    link.appendChild(group);
  });
}

function createFilters(card: HTMLElement) {
  if (document.getElementById(FILTER_ID)) return;
  const entries = loadFeedbackStore().entries;
  const counts = {
    opinion: entries.filter((entry) => entry.kind === "opinion").length,
    suggestion: entries.filter((entry) => entry.kind === "suggestion").length,
    bug: entries.filter((entry) => entry.kind === "bug").length,
  };

  const filters = document.createElement("div");
  filters.id = FILTER_ID;

  const typeLabel = document.createElement("label");
  typeLabel.textContent = "Tipo";
  const typeSelect = document.createElement("select");
  typeSelect.innerHTML = `<option value="all">Todos os tipos (${entries.length})</option><option value="opinion">Opiniões (${counts.opinion})</option><option value="suggestion">Sugestões (${counts.suggestion})</option><option value="bug">Problemas (${counts.bug})</option>`;
  typeSelect.value = activeType;
  typeSelect.addEventListener("change", () => {
    activeType = typeSelect.value;
    enhanceFeedbackPage();
  });
  typeLabel.appendChild(typeSelect);

  const statusLabel = document.createElement("label");
  statusLabel.textContent = "Estado";
  const statusSelect = document.createElement("select");
  statusSelect.innerHTML = STATUS_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  statusSelect.value = activeStatus;
  statusSelect.addEventListener("change", () => {
    activeStatus = statusSelect.value;
    enhanceFeedbackPage();
  });
  statusLabel.appendChild(statusSelect);

  filters.append(typeLabel, statusLabel);
  const header = card.firstElementChild;
  if (header?.nextSibling) card.insertBefore(filters, header.nextSibling);
  else card.appendChild(filters);
}

function enhanceInbox() {
  const entries = loadFeedbackStore().entries;
  const title = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,div")).find(
    (node) => node.textContent?.trim() === "Caixa de feedback",
  );
  const card = title?.closest<HTMLElement>(".premium-card");
  if (!card) return;

  createFilters(card);
  card.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const entry = entries.find((item) => button.textContent?.includes(item.reference));
    if (!entry) return;
    button.dataset.feedbackListKind = entry.kind;
    button.dataset.feedbackListStatus = entry.status;
    button.dataset.feedbackRequestId = entry.id;
    button.hidden = !((activeType === "all" || entry.kind === activeType) && (activeStatus === "all" || entry.status === activeStatus));
  });
}

function feedbackRouteParams() {
  const hash = window.location.hash || "";
  const queryIndex = hash.indexOf("?");
  return new URLSearchParams(queryIndex >= 0 ? hash.slice(queryIndex + 1) : "");
}

function handleFeedbackDeepLink() {
  if (!window.location.hash.includes("/feedback")) return;
  const params = feedbackRouteParams();
  if (params.get("_push") !== "1") return;

  const contextKey = params.get("_pushBody") || params.get("_pushTitle") || "push";
  const survey = params.get("survey");
  if (survey === "1") {
    const key = `survey:${contextKey}`;
    if (lastDeepLinkKey !== key) {
      const surveyButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
        (button.textContent || "").includes("Resultados do inquérito"),
      );
      if (surveyButton) {
        lastDeepLinkKey = key;
        surveyButton.click();
      }
    }
    return;
  }

  const request = params.get("request");
  if (!request) return;
  const entries = loadFeedbackStore().entries;
  const entry = entries.find((item) => item.id === request || item.reference === request);
  if (!entry) return;
  const key = `request:${entry.id}:${contextKey}`;
  if (lastDeepLinkKey === key) return;

  activeType = "all";
  activeStatus = "all";
  enhanceInbox();
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-feedback-request-id]')).find(
    (item) => item.dataset.feedbackRequestId === entry.id,
  );
  if (!button) return;

  lastDeepLinkKey = key;
  button.hidden = false;
  button.dataset.feedbackDeeplink = "true";
  button.click();
  button.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => { delete button.dataset.feedbackDeeplink; }, 4500);
}

function openFeedbackDetail() {
  if (!window.location.hash.includes("/feedback")) return null;
  const entries = loadFeedbackStore().entries;
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".premium-card"));
  for (const card of cards) {
    const text = card.textContent || "";
    if (!text.includes("Informação técnica")) continue;
    const entry = entries.find((item) => text.includes(item.reference));
    if (entry) return { card, entry };
  }
  return null;
}

async function markStudentRepliesRead(requestId: string) {
  if (isFeedbackBetaManager()) return;
  const now = Date.now();
  if (now - (lastReadAttempt.get(requestId) ?? 0) < READ_ATTEMPT_THROTTLE_MS) return;
  lastReadAttempt.set(requestId, now);

  const session = await ensureFeedbackSession();
  if (!session) return;

  const client = supabase as unknown as {
    rpc: (name: string, args: Record<string, string>) => Promise<{ error: { message?: string } | null }>;
  };
  const { error } = await client.rpc("mark_feedback_messages_read", { p_request_id: requestId });
  if (error) lastReadAttempt.delete(requestId);
}

function markOpenStudentRequestRead() {
  if (isFeedbackBetaManager()) return;
  const detail = openFeedbackDetail();
  if (detail) void markStudentRepliesRead(detail.entry.id);
}

function renderReceiptRows(container: HTMLElement, rows: ReceiptRow[]) {
  container.replaceChildren();

  const title = document.createElement("div");
  title.className = "ah-receipt-title";
  title.textContent = "Confirmação de leitura das respostas";
  container.appendChild(title);

  const help = document.createElement("div");
  help.className = "ah-receipt-help";
  help.textContent = "Indica apenas se o aluno abriu este pedido depois da resposta. Não significa que tenha de responder novamente.";
  container.appendChild(help);

  const list = document.createElement("div");
  list.className = "ah-receipt-list";
  rows.forEach((row, index) => {
    const item = document.createElement("div");
    item.className = "ah-receipt-row";

    const sent = document.createElement("span");
    sent.className = "ah-receipt-sent";
    sent.textContent = `Resposta ${index + 1} · enviada ${formatDate(row.created_at)}`;

    const status = document.createElement("span");
    if (row.read_at) {
      status.className = "ah-receipt-read";
      status.textContent = `✓✓ Visualizado · ${formatDate(row.read_at)}`;
    } else {
      status.className = "ah-receipt-pending";
      status.textContent = "✓ Enviado · ainda não visualizado";
    }

    item.append(sent, status);
    list.appendChild(item);
  });
  container.appendChild(list);
}

async function enhanceManagerReadReceipts() {
  if (!isFeedbackBetaManager() || !window.location.hash.includes("/feedback")) {
    document.getElementById(RECEIPT_ID)?.remove();
    return;
  }

  const detail = openFeedbackDetail();
  if (!detail) {
    document.getElementById(RECEIPT_ID)?.remove();
    return;
  }
  if (receiptRequestInFlight === detail.entry.id) return;
  receiptRequestInFlight = detail.entry.id;

  try {
    const session = await ensureFeedbackSession();
    if (!session) return;
    const client = supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (column: string, value: string) => {
            eq: (column: string, value: string) => {
              order: (column: string, options: { ascending: boolean }) => Promise<{ data: ReceiptRow[] | null; error: { message?: string } | null }>;
            };
          };
        };
      };
    };
    const { data, error } = await client
      .from("feedback_messages")
      .select("id,created_at,read_at")
      .eq("request_id", detail.entry.id)
      .eq("author", "academic_hub")
      .order("created_at", { ascending: true });
    if (error || !data?.length) {
      document.getElementById(RECEIPT_ID)?.remove();
      return;
    }

    const current = openFeedbackDetail();
    if (!current || current.entry.id !== detail.entry.id) return;
    let container = document.getElementById(RECEIPT_ID) as HTMLElement | null;
    if (!container) {
      container = document.createElement("div");
      container.id = RECEIPT_ID;
      const cardContent = current.card.children.item(1) as HTMLElement | null;
      (cardContent ?? current.card).appendChild(container);
    }
    renderReceiptRows(container, data);
  } finally {
    receiptRequestInFlight = "";
  }
}

function enhanceFeedbackPage() {
  enhanceMenu();
  if (!window.location.hash.includes("/feedback")) return;

  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const text = (button.textContent || "").trim();
    if (text === "Opinião") button.dataset.feedbackKind = "opinion";
    if (text === "Sugestão") button.dataset.feedbackKind = "suggestion";
    if (text === "Problema") button.dataset.feedbackKind = "bug";
    if (button.dataset.feedbackKind) button.dataset.selected = button.className.includes("bg-primary/10") ? "true" : "false";
    if (text.startsWith("Som interno")) button.hidden = true;
  });

  enhanceInbox();
  handleFeedbackDeepLink();
  window.setTimeout(markOpenStudentRequestRead, 40);
  void enhanceManagerReadReceipts();
}

function scheduleEnhance() {
  window.requestAnimationFrame(() => enhanceFeedbackPage());
  window.setTimeout(enhanceFeedbackPage, 80);
  window.setTimeout(enhanceFeedbackPage, 250);
}

export default function FeedbackBetaEnhancements() {
  useEffect(() => {
    ensureStyles();
    scheduleEnhance();

    const handler = () => scheduleEnhance();
    const onFeedbackClick = (event: MouseEvent) => {
      if (isFeedbackBetaManager() || !window.location.hash.includes("/feedback")) return;
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>("button[data-feedback-request-id]");
      const requestId = button?.dataset.feedbackRequestId;
      if (!requestId) return;
      window.setTimeout(() => {
        const detail = openFeedbackDetail();
        if (detail?.entry.id === requestId) void markStudentRepliesRead(requestId);
      }, 60);
    };

    window.addEventListener(FEEDBACK_BETA_EVENT, handler);
    window.addEventListener("hashchange", handler);
    window.addEventListener("storage", handler);
    document.addEventListener("click", onFeedbackClick, true);

    const observer = new MutationObserver(() => scheduleEnhance());
    observer.observe(document.body, { childList: true, subtree: true });

    const receiptInterval = window.setInterval(() => {
      if (document.visibilityState === "visible" && window.location.hash.includes("/feedback")) {
        if (isFeedbackBetaManager()) void enhanceManagerReadReceipts();
        else markOpenStudentRequestRead();
      }
    }, RECEIPT_REFRESH_MS);

    return () => {
      window.removeEventListener(FEEDBACK_BETA_EVENT, handler);
      window.removeEventListener("hashchange", handler);
      window.removeEventListener("storage", handler);
      document.removeEventListener("click", onFeedbackClick, true);
      observer.disconnect();
      window.clearInterval(receiptInterval);
      document.getElementById(RECEIPT_ID)?.remove();
    };
  }, []);

  return null;
}
