import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

type AuthCtxValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  storageKey: string; // per-user storage key for the app state
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtxValue | null>(null);

function makeStorageKey(user: User | null): string {
  const base = "academic_hub_state_v2";
  const email = (user?.email ?? "").trim().toLowerCase();
  if (!email) return `${base}:anon`;
  // keep it simple + safe for localStorage keys
  return `${base}:${email.replace(/[^a-z0-9@._-]+/g, "_")}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthCtxValue>(() => {
    const user = session?.user ?? null;
    return {
      user,
      session,
      loading,
      storageKey: makeStorageKey(user),
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [session, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
