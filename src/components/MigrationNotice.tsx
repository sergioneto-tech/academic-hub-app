import { useEffect, useState } from "react";
import { CloudUpload, FileJson, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const NOTICE_KEY = "academic_hub_migration_notice_2026_08_05";

export default function MigrationNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(NOTICE_KEY) !== "dismissed");
    } catch {
      setOpen(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(NOTICE_KEY, "dismissed");
    } catch {
      // O aviso pode voltar a aparecer se o armazenamento local estiver indisponível.
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="migration-title">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[hsl(var(--gold)/0.45)] bg-background shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border bg-background/90 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Fechar aviso"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b bg-primary/5 px-6 py-6 pr-16 sm:px-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold-soft))] px-3 py-1 text-xs font-semibold text-[hsl(var(--gold))]">
            <ShieldCheck className="h-4 w-4" />
            Nova base de dados ativa
          </div>
          <h2 id="migration-title" className="text-2xl font-semibold tracking-tight">Os teus dados antigos precisam de uma migração única</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            O Academic Hub passou para uma infraestrutura nova e controlada diretamente pela aplicação. Contas e registos criados antes de 5 de agosto de 2026 não são transferidos automaticamente pelo fornecedor anterior.
          </p>
        </div>

        <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
          <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border bg-muted/25 p-5 text-center">
            <FileJson className="mb-3 h-7 w-7 text-primary" />
            <div className="font-semibold">Já usavas o Academic Hub</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Cria e confirma a conta nova, entra na aplicação, importa o último backup JSON e confirma que as cadeiras, notas, perfil e histórico reapareceram.
            </p>
          </div>
          <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border bg-muted/25 p-5 text-center">
            <CloudUpload className="mb-3 h-7 w-7 text-[hsl(var(--gold))]" />
            <div className="font-semibold">Concluir a migração</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Ativa a sincronização e usa “Guardar na cloud (upload)”. Depois testa “Carregar da cloud (download)” noutro navegador ou dispositivo.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t bg-muted/20 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-xs text-muted-foreground">Contas criadas a partir de 5 de agosto de 2026 já usam diretamente a nova base de dados.</p>
          <Button type="button" onClick={dismiss} className="sm:min-w-40">Compreendi</Button>
        </div>
      </div>
    </div>
  );
}
