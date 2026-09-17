import type { CloudConfig } from "@/lib/cloudSync";

const ACADEMIC_HUB_SUPABASE_URL = "https://apgoyzfzuukkpmuxiqvy.supabase.co";
const ACADEMIC_HUB_PUBLISHABLE_KEY = "sb_publishable_Cn8kLCy2lm01kOgA7kK5kg_hCsBwAwM";

function hostedAcademicHubOrigin() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "academichub.sergioneto.pt" || host.endsWith(".academic-hub-app.pages.dev");
}

/**
 * Returns the browser-safe Supabase project configuration.
 *
 * Cloudflare Pages keeps Preview and Production variables in separate scopes.
 * A branch preview can therefore be deployed successfully while Vite receives no
 * VITE_SUPABASE_* variables, causing the app to fail before React mounts.
 *
 * The fallback below is restricted to Academic Hub's own hosted origins and uses
 * only the Supabase publishable key, which is designed to be present in browser
 * bundles. Local/unknown origins still require explicit environment variables so
 * development cannot silently connect to production.
 */
export function getPublicSupabaseConfig(): CloudConfig | null {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  const envKey = (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  if (envUrl && envKey) return { supabaseUrl: envUrl, supabaseAnonKey: envKey };
  if (hostedAcademicHubOrigin()) {
    return {
      supabaseUrl: ACADEMIC_HUB_SUPABASE_URL,
      supabaseAnonKey: ACADEMIC_HUB_PUBLISHABLE_KEY,
    };
  }
  return null;
}
