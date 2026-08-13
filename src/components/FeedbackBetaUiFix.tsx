import { useEffect } from "react";
import { FEEDBACK_BETA_EVENT, loadFeedbackStore } from "@/lib/feedbackBeta";

const STYLE_ID = "academic-hub-feedback-ui-fix";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    [data-ah-feedback-sound="true"] { display: none !important; }

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

    .ah-feedback-stats { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    @media (min-width: 1280px) { .ah-feedback-stats { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }
  `;
  document.head.appendChild(style);
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
  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const entry = entries.find((item) => button.textContent?.includes(item.reference));
    if (entry) button.dataset.feedbackListKind = entry.kind;
  });
}

function schedule() {
  [0, 80, 250, 700].forEach((delay) => window.setTimeout(() => window.requestAnimationFrame(applyFixes), delay));
}

export default function FeedbackBetaUiFix() {
  useEffect(() => {
    ensureStyles();
    schedule();
    const refresh = () => schedule();
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
