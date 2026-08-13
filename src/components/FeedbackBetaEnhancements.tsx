import { useEffect } from "react";
import { FEEDBACK_BETA_EVENT, unreadFeedbackCount } from "@/lib/feedbackBeta";

const STYLE_ID = "academic-hub-feedback-beta-enhancements";
const NOTE_ID = "academic-hub-feedback-sound-note";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    a[href$="/feedback"] {
      position: relative;
      border: 1px solid hsl(var(--gold) / .42);
      background: linear-gradient(135deg, hsl(var(--gold-soft) / .42), transparent 76%);
      color: hsl(var(--gold));
    }
    a[href$="/feedback"]:hover {
      border-color: hsl(var(--gold) / .72);
      background: hsl(var(--gold-soft) / .68);
      color: hsl(var(--gold));
    }
    a[href$="/feedback"]::after {
      content: "BETA";
      margin-left: auto;
      border: 1px solid hsl(var(--gold) / .48);
      border-radius: 999px;
      padding: .13rem .4rem;
      font-size: .52rem;
      line-height: 1;
      font-weight: 800;
      letter-spacing: .08em;
      color: hsl(var(--gold));
      background: hsl(var(--gold-soft) / .62);
    }
    a[href$="/feedback"][data-feedback-unread="true"] {
      box-shadow: 0 0 0 1px hsl(var(--gold) / .24), 0 0 18px hsl(var(--gold) / .18);
      animation: ah-feedback-pulse 1.9s ease-in-out infinite;
    }
    a[href$="/feedback"][data-feedback-unread="true"]::after {
      content: attr(data-feedback-count);
      min-width: 1.25rem;
      text-align: center;
      background: hsl(var(--destructive));
      border-color: hsl(var(--destructive));
      color: hsl(var(--destructive-foreground));
      letter-spacing: 0;
    }

    [data-feedback-kind="opinion"] {
      border-color: rgb(59 130 246 / .48) !important;
    }
    [data-feedback-kind="opinion"] svg { color: rgb(96 165 250) !important; }
    [data-feedback-kind="opinion"][data-selected="true"] {
      background: rgb(59 130 246 / .14) !important;
      border-color: rgb(96 165 250 / .92) !important;
      box-shadow: 0 0 0 1px rgb(96 165 250 / .28);
    }

    [data-feedback-kind="suggestion"] {
      border-color: hsl(var(--gold) / .52) !important;
    }
    [data-feedback-kind="suggestion"] svg { color: hsl(var(--gold)) !important; }
    [data-feedback-kind="suggestion"][data-selected="true"] {
      background: hsl(var(--gold-soft) / .7) !important;
      border-color: hsl(var(--gold) / .95) !important;
      box-shadow: 0 0 0 1px hsl(var(--gold) / .28);
    }

    [data-feedback-kind="bug"] {
      border-color: rgb(239 68 68 / .48) !important;
    }
    [data-feedback-kind="bug"] svg { color: rgb(248 113 113) !important; }
    [data-feedback-kind="bug"][data-selected="true"] {
      background: rgb(239 68 68 / .13) !important;
      border-color: rgb(248 113 113 / .92) !important;
      box-shadow: 0 0 0 1px rgb(248 113 113 / .26);
    }

    #${NOTE_ID} {
      max-width: 31rem;
      margin-top: .45rem;
      font-size: .72rem;
      line-height: 1.35;
      color: hsl(var(--muted-foreground));
    }

    @keyframes ah-feedback-pulse {
      0%,100% { box-shadow: 0 0 0 1px hsl(var(--gold) / .18), 0 0 0 hsl(var(--gold) / 0); }
      50% { box-shadow: 0 0 0 1px hsl(var(--gold) / .42), 0 0 20px hsl(var(--gold) / .22); }
    }
    @media (prefers-reduced-motion: reduce) {
      a[href$="/feedback"][data-feedback-unread="true"] { animation: none; }
    }
  `;
  document.head.appendChild(style);
}

function enhanceFeedbackPage() {
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href$="/feedback"]');
  const count = unreadFeedbackCount();
  links.forEach((link) => {
    link.dataset.feedbackUnread = count > 0 ? "true" : "false";
    link.dataset.feedbackCount = String(count);
  });

  if (!window.location.hash.includes("/feedback")) return;

  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const text = (button.textContent || "").trim();
    if (text === "Opinião") button.dataset.feedbackKind = "opinion";
    if (text === "Sugestão") button.dataset.feedbackKind = "suggestion";
    if (text === "Problema") button.dataset.feedbackKind = "bug";
    if (button.dataset.feedbackKind) {
      button.dataset.selected = button.className.includes("bg-primary/10") ? "true" : "false";
    }

    if (text.startsWith("Som interno")) {
      button.setAttribute("title", "Som usado apenas dentro do Academic Hub quando a aplicação está aberta");
      if (!document.getElementById(NOTE_ID)) {
        const note = document.createElement("div");
        note.id = NOTE_ID;
        note.textContent = "Este controlo é apenas para o som dentro do Academic Hub quando a app está aberta. As notificações push no telemóvel/tablet usam o som e as permissões definidos pelo próprio sistema operativo.";
        button.insertAdjacentElement("afterend", note);
      }
    }
  });
}

export default function FeedbackBetaEnhancements() {
  useEffect(() => {
    ensureStyles();
    enhanceFeedbackPage();
    const observer = new MutationObserver(enhanceFeedbackPage);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener(FEEDBACK_BETA_EVENT, enhanceFeedbackPage);
    window.addEventListener("hashchange", enhanceFeedbackPage);
    window.addEventListener("storage", enhanceFeedbackPage);
    return () => {
      observer.disconnect();
      window.removeEventListener(FEEDBACK_BETA_EVENT, enhanceFeedbackPage);
      window.removeEventListener("hashchange", enhanceFeedbackPage);
      window.removeEventListener("storage", enhanceFeedbackPage);
    };
  }, []);
  return null;
}
