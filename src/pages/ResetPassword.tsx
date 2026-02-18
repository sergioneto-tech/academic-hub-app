import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Compatibilidade: alguns emails mais antigos podem apontar para /reset-password.
// Nesta versão, a recuperação é feita no separador "Definições".
export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has("recovery")) params.set("recovery", "1");

    navigate(
      {
        pathname: "/definicoes",
        search: `?${params.toString()}`,
        hash: location.hash,
      },
      { replace: true }
    );
  }, [location.search, location.hash, navigate]);

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Recuperar password</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          A redirecionar para Definições...
        </CardContent>
      </Card>
    </div>
  );
}
