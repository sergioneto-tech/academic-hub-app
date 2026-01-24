import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-sm text-muted-foreground">
        A verificar sessão…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}
