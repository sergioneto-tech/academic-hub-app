import { useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import {
  FEEDBACK_BETA_EVENT,
  isFeedbackBetaManager,
  loadFeedbackStore,
  playAcademicHubAppSound,
} from "@/lib/feedbackBeta";

const NOTIFIED_KEY = "academic_hub_admin_feedback_notified_v1";

function readNotified(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    const values = raw ? JSON.parse(raw) as unknown : [];
    return new Set(Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : []);
  } catch {
    return new Set();
  }
}

function saveNotified(values: Set<string>) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(Array.from(values).slice(-250)));
  } catch {
    // O alerta continua funcional na sessão atual mesmo sem armazenamento persistente.
  }
}

export default function AdminFeedbackMonitor() {
  useEffect(() => {
    const check = () => {
      if (!isFeedbackBetaManager()) return;

      const unread = loadFeedbackStore().entries.filter((entry) => !entry.readAt);
      if (!unread.length) return;

      const notified = readNotified();
      const fresh = unread.filter((entry) => !notified.has(entry.id));
      if (!fresh.length) return;

      fresh.forEach((entry) => notified.add(entry.id));
      saveNotified(notified);
      playAcademicHubAppSound("notification");

      if (fresh.length === 1) {
        const entry = fresh[0];
        toast({
          title: "Novo feedback recebido",
          description: `${entry.reference} · ${entry.title}`,
        });
      } else {
        toast({
          title: `${fresh.length} novos feedbacks recebidos`,
          description: "Existem novos pedidos por consultar na área de Feedback.",
        });
      }
    };

    const onFeedbackChange = () => check();
    const onAuthChanged = () => window.setTimeout(check, 250);

    check();
    window.addEventListener(FEEDBACK_BETA_EVENT, onFeedbackChange);
    window.addEventListener("academic-hub-auth-changed", onAuthChanged);

    return () => {
      window.removeEventListener(FEEDBACK_BETA_EVENT, onFeedbackChange);
      window.removeEventListener("academic-hub-auth-changed", onAuthChanged);
    };
  }, []);

  return null;
}
