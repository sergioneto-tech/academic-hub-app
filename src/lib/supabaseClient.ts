import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function getRememberMe(): boolean {
  try {
    return localStorage.getItem("ah_remember_me") === "1";
  } catch {
    return true;
  }
}

/**
 * Storage adapter that routes Supabase session persistence to:
 * - localStorage when "remember me" is enabled
 * - sessionStorage when "remember me" is disabled
 */
const authStorage = {
  getItem: (key: string) => {
    try {
      const store = getRememberMe() ? localStorage : sessionStorage;
      return store.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      const store = getRememberMe() ? localStorage : sessionStorage;
      store.setItem(key, value);

      // avoid stale copies
      const other = getRememberMe() ? sessionStorage : localStorage;
      other.removeItem(key);
    } catch {
      // ignore
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[Auth] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Configure them in your .env file."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    // Avoid hash-fragment tokens (HashRouter). PKCE uses ?code=... which works.
    flowType: "pkce",
    detectSessionInUrl: true,
    persistSession: true,
    storage: authStorage,
  },
});

export function setRememberMe(enabled: boolean) {
  try {
    localStorage.setItem("ah_remember_me", enabled ? "1" : "0");
  } catch {
    // ignore
  }
}
