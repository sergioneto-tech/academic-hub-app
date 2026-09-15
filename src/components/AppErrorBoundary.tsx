import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

function isChunkLikeError(error: Error | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("dynamically imported module") ||
    message.includes("loading chunk") ||
    message.includes("chunkloaderror") ||
    message.includes("importing a module script")
  );
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Academic Hub] Erro de interface recuperado", error, info);
  }

  private reload = () => {
    window.location.reload();
  };

  private goHome = () => {
    window.location.hash = "#/";
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkError = isChunkLikeError(error);
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl items-center px-4 py-10">
        <div className="w-full rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Academic Hub</div>
          <h1 className="mt-2 text-xl font-semibold">Não foi possível abrir esta área</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {chunkError
              ? "A aplicação detetou uma mistura entre ficheiros de versões diferentes. Os teus dados não foram apagados. Recarrega para concluir a atualização da interface."
              : "Ocorreu um erro de interface nesta área. Os teus dados permanecem guardados; recarrega a aplicação e tenta novamente."}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={this.reload} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Recarregar aplicação
            </button>
            <button type="button" onClick={this.goHome} className="inline-flex min-h-10 items-center justify-center rounded-xl border bg-background px-4 py-2 text-sm font-semibold">
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    );
  }
}
