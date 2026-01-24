import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Evita "ecrã branco" quando existe um erro runtime.
 * Mostra uma mensagem simples e permite recarregar.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log em dev para ajudar a diagnosticar
    console.error("ErrorBoundary caught an error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-dvh bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-xl border bg-card p-6 space-y-3">
          <div className="text-lg font-semibold">Ocorreu um erro</div>
          <p className="text-sm text-muted-foreground">
            A aplicação encontrou um erro inesperado. Normalmente isto acontece quando existe um problema num componente ou num import.
          </p>

          <pre className="text-xs overflow-auto rounded-md bg-muted p-3">{String(this.state.error?.message ?? this.state.error)}</pre>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => window.location.reload()}>Recarregar</Button>
            <Button
              variant="outline"
              onClick={() => {
                try {
                  localStorage.clear();
                } catch {}
                window.location.reload();
              }}
            >
              Limpar dados e recarregar
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
