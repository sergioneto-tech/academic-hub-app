import { useEffect } from "react";
import { FEEDBACK_BETA_EVENT, loadFeedbackStore, unreadFeedbackCount } from "@/lib/feedbackBeta";

const STYLE_ID = "academic-hub-feedback-beta-enhancements";
const FILTER_ID = "academic-hub-feedback-filters";

let activeType = "all";
let activeStatus = "all";

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
    #${FILTER_ID} { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .55rem; margin: 0 1.5rem .8rem; padding: .7rem; border: 1px solid hsl(var(--border)); border-radius: .85rem; background: hsl(var(--muted) / .22); }
    #${FILTER_ID} label { display: grid; gap: .3rem; min-width: 0; font-size: .68rem; font-weight: 700; color: hsl(var(--muted-foreground)); }
    #${FILTER_ID} select { width: 100%; min-width: 0; height: 2.35rem; border: 1px solid hsl(var(--input)); border-radius: .7rem; padding: 0 .65rem; background: hsl(var(--background)); color: hsl(var(--foreground)); font-size: .78rem; }
    @keyframes ah-feedback-pulse { 0%,100% { box-shadow: 0 0 0 1px hsl(var(--gold) / .18), 0 0 0 hsl(var(--gold) / 0); } 50% { box-shadow: 0 0 0 1px hsl(var(--gold) / .42), 0 0 20px hsl(var(--gold) / .22); } }
    @media (max-width: 639px) { #${FILTER_ID} { grid-template-columns: minmax(0, 1fr); margin-inline: 1rem; } .ah-feedback-kind-counts { gap: .18rem; } }
    @media (prefers-reduced-motion: reduce) { a[href$="/feedback"][data-feedback-unread="true"] { animation: none; } }
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
    const desired = (Object.keys(KIND_META) as Array<keyof typeof KIND_META>).filter((kind) => byKind[kind] > 0).map((kind) => `${kind}:${byKind[kind]}`).join("|");
    const current = link.dataset.feedbackKinds || "";
    if (current === desired) return;
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
  typeSelect.addEventListener("change", () => { activeType = typeSelect.value; enhanceFeedbackPage(); });
  typeLabel.appendChild(typeSelect);
  const statusLabel = document.createElement("label");
  statusLabel.textContent = "Estado";
  const statusSelect = document.createElement("select");
  statusSelect.innerHTML = STATUS_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  statusSelect.value = activeStatus;
  statusSelect.addEventListener("change", () => { activeStatus = statusSelect.value; enhanceFeedbackPage(); });
  statusLabel.appendChild(statusSelect);
  filters.append(typeLabel, statusLabel);
  const header = card.firstElementChild;
  if (header?.nextSibling) card.insertBefore(filters, header.nextSibling);
  else card.appendChild(filters);
}

function enhanceInbox() {
  const entries = loadFeedbackStore().entries;
  const title = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,div")).find((node) => node.textContent?.trim() === "Caixa de feedback");
  const card = title?.closest<HTMLElement>(".premium-card");
  if (!card) return;
  createFilters(card);
  card.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const entry = entries.find((item) => button.textContent?.includes(item.reference));
    if (!entry) return;
    button.dataset.feedbackListKind = entry.kind;
    button.dataset.feedbackListStatus = entry.status;
    button.hidden = !((activeType === "all" || entry.kind === activeType) && (activeStatus === "all" || entry.status === activeStatus));
  });
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
}

function scheduleEnhance() {
  window.requestAnimationFrame(() => enhanceFeedbackPage());
  window.setTimeout(enhanceFeedbackPage, 80);
}

export default function FeedbackBetaEnhancements() {
  useEffect(() => {
    ensureStyles();
    scheduleEnhance();
    const handler = () => scheduleEnhance();
    window.addEventListener(FEEDBACK_BETA_EVENT, handler);
    window.addEventListener("hashchange", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(FEEDBACK_BETA_EVENT, handler);
      window.removeEventListener("hashchange", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return null;
}
