import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export type CloudSyncNoticeDetail = {
  kind: "updated" | "conflict" | "error";
  updatedAt?: string;
  deviceLabel?: string;
  message?: string;
};

export const CLOUD_SYNC_NOTICE_EVENT = "academic-hub:cloud-sync-notice";

function formatDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CloudSyncNotice() {
  const [notice, setNotice] = useState<CloudSyncNoticeDetail | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<CloudSyncNoticeDetail>;
      if (!custom.detail) return;

      // Falhas automáticas e transitórias de rede ficam silenciosas.
      // O utilizador continua a receber feedback explícito em ações manuais
      // (Guardar/Carregar da cloud), e conflitos reais continuam visíveis.
      if (custom.detail.kind === "error") return;

      setNotice(custom.detail);
    };
    window.addEventListener(CLOUD_SYNC_NOTICE_EVENT, handler);
    return () => window.removeEventListener(CLOUD_SYNC_NOTICE_EVENT, handler);
  }, []);

  if (!notice) return null;

  const isUpdated = notice.kind === "updated";
  const isConflict = notice.kind === "conflict";
  const Icon = isUpdated ? CheckCircle2 : AlertTriangle;

  return (
    <div className="fixed left-1/2 top-4 z-[120] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 px-2 sm:top-5">
      <section
        className={`rounded-2xl border bg-background/96 p-4 shadow-2xl backdrop-blur-xl ${
          isUpdated ? "border-emerald-500/35" : "border-amber-500/45"
        }`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
            isUpdated ? "bg-emerald-500/12 text-emerald-600" : "bg-amber-500/12 text-amber-600"
          }`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">
              {isUpdated ? "Dados atualizados automaticamente" : "Alterações em dois dispositivos"}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {notice.message || (isUpdated
                ? `Foram carregados os dados mais recentes da cloud${notice.updatedAt ? `, gravados em ${formatDateTime(notice.updatedAt)}` : ""}${notice.deviceLabel ? ` a partir de ${notice.deviceLabel}` : ""}.`
                : "Existem dados locais e dados diferentes na cloud. Por segurança, nenhuma versão foi substituída. Abre Definições para escolher a versão a utilizar.")}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setNotice(null)} aria-label="Fechar aviso">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
