import { useEffect } from "react";
import { FEEDBACK_BETA_EVENT, isFeedbackBetaManager } from "@/lib/feedbackBeta";

const MANAGER_POLL_MS = 60_000;

export default function FeedbackGlobalSyncPulse() {
  useEffect(() => {
    const requestSync = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine || !isFeedbackBetaManager()) return;
      window.dispatchEvent(new Event(FEEDBACK_BETA_EVENT));
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") requestSync();
    };

    requestSync();
    const interval = window.setInterval(requestSync, MANAGER_POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", requestSync);
    window.addEventListener("academic-hub-auth-changed", requestSync);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", requestSync);
      window.removeEventListener("academic-hub-auth-changed", requestSync);
    };
  }, []);

  return null;
}
