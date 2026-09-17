import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportClientError } from "@/lib/clientErrorReporting";
import { APP_VERSION } from "@/lib/version";

type Props = { children: ReactNode };
type State = { error: Error | null };

const CHUNK_RECOVERY_KEY = `academic-hub:chunk-recovery:${APP_VERSION}`;
const CHUNK_RECOVERY_CLEAR_MS = 12_000;
const CHUNK_RECOVERY_RELOAD_MS = 450;

function isChunkLikeError(error: Error | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("dynamically imported module") ||
    message.includes("loading chunk") ||
    message.includes("chunkloaderror") ||
    message.includes("importing a module script") ||
    message.includes("valid javascript mime type") ||
    (message.includes("mime type") && message.includes("text/html"))
  );
}

function hasChunkRecoveryAttempt(): boolean {
  try {
    return sessionStorage.getItem(CHUNK_RECOVERY_KEY) === "1";
  } catch {
    return false;
  }
}

function markChunkRecoveryAttempt(): void {
  try {
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, "1");
  } catch {
    // Se sessionStorage não estiver disponível, mantém apenas o fallback visual.
  }
}

function clearChunkRecoveryAttempt(): void {
  try {
    sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
  } catch {
    // Sem impacto funcional.
  }
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  private chunkRecoveryClearTimer: number | null = null;

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidMount() {
    this.chunkRecoveryClearTimer = window.setTimeout(
      clearChunkRecoveryAttempt,
      CHUNK_RECOVERY_CLEAR_MS,
    );
  }

  componentWillUnmount() {
    if (this.chunkRecoveryClearTimer !== null) window.clearTimeout(this.chunkRecoveryClearTimer);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Academic Hub] Erro de interface recuperado", error, info);
    const chunkError = isChunkLikeError(error);
    void reportClientError({
      errorCode: chunkError ? "interface_chunk" : "unexpected_ui",
      summary: chunkError
        ? "A interface tentou carregar ficheiros de versões diferentes."
        : (error.message || "Erro inesperado da interface."),
    });

    if (chunkError && !hasChunkRecoveryAttempt()) {
      markChunkRecoveryAttempt();
      window.setTimeout(() => window.location.reload(), CHUNK_RECOVERY_RELOAD_MS);
    }
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
    const alreadyTriedRecovery = chunkError && hasChunkRecoveryAttempt();
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-xl items-center px-4 py-10">
        <div className="w-full rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Academic Hub</div>
          <h1 className="mt-2 text-xl font-semibold">
            {chunkError && !alreadyTriedRecovery ? "A concluir a atualização" : "Não foi possível abrir esta área"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {chunkError
              ? alreadyTriedRecovery
                ? "A aplicação detetou novamente uma mistura entre ficheiros de versões diferentes. Os teus dados não foram apagados. Recarrega para tentar concluir a atualização da interface."
                : "A aplicação detetou ficheiros de versões diferentes e está a fazer uma recuperação automática. Os teus dados não foram apagados."
              : "Ocorreu um erro de interface nesta área. Os teus dados permanecem guardados; recarrega a aplicação e tenta novamente."}
          </p>
          {(!chunkError || alreadyTriedRecovery) && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={this.reload} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Recarregar aplicação
              </button>
              <button type="button" onClick={this.goHome} className="inline-flex min-h-10 items-center justify-center rounded-xl border bg-background px-4 py-2 text-sm font-semibold">
                Voltar ao início
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
}
