import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { getStoredSession, refreshSession, type CloudConfig } from "@/lib/cloudSync";
import { FEEDBACK_BETA_MANAGER_USER_ID, playAcademicHubAppSound } from "@/lib/feedbackBeta";

const STORAGE_KEY = "academic_hub_admin_user_count";
const POLL_MS = 5 * 60_000;

type Summary = { totalUsers: number; latestCreatedAt: string | null };

function cloudConfig(): CloudConfig | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

async function loadSummary(): Promise<Summary | null> {
  const config = cloudConfig();
  if (!config) return null;
  let session = getStoredSession(config);
  if (!session || session.user.id !== FEEDBACK_BETA_MANAGER_USER_ID) return null;

  const expiresAt = Number(session.expires_at ?? 0) * 1000;
  if (expiresAt && expiresAt <= Date.now() + 60_000) {
    try {
      session = await refreshSession(config, session);
    } catch {
      return null;
    }
  }

  const response = await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/functions/v1/admin-user-summary`, {
    method: "GET",
    cache: "no-store",
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if (!response.ok) return null;
  const data = await response.json() as Partial<Summary>;
  return {
    totalUsers: Number(data.totalUsers) || 0,
    latestCreatedAt: typeof data.latestCreatedAt === "string" ? data.latestCreatedAt : null,
  };
}

export default function AdminUserMonitor() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const next = await loadSummary();
      if (!next || cancelled) return;
      setSummary(next);

      const previous = Number(localStorage.getItem(STORAGE_KEY) || "0");
      if (previous > 0 && next.totalUsers > previous) {
        const added = next.totalUsers - previous;
        playAcademicHubAppSound("notification");
        toast({
          title: added === 1 ? "Novo utilizador registado" : `${added} novos utilizadores registados`,
          description: `O Academic Hub tem agora ${next.totalUsers} contas registadas.`,
        });
      }
      localStorage.setItem(STORAGE_KEY, String(next.totalUsers));
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const onAuthChanged = () => void check();

    void check();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("academic-hub-auth-changed", onAuthChanged);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("academic-hub-auth-changed", onAuthChanged);
    };
  }, []);

  if (!summary) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 hidden items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur sm:flex" title={summary.latestCreatedAt ? `Último registo: ${new Date(summary.latestCreatedAt).toLocaleString("pt-PT")}` : undefined}>
      <Users className="h-4 w-4 text-primary" />
      <span>{summary.totalUsers} utilizadores</span>
    </div>
  );
}
