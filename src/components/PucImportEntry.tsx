import { FileUp, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

export default function PucImportEntry({ courseId }: { courseId: string }) {
  return (
    <section className="mx-auto mb-4 max-w-5xl px-4 md:px-6">
      <div className="rounded-2xl border border-[hsl(var(--gold)/0.35)] bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--gold-soft))] text-[hsl(var(--gold))]">
                <FileUp className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold">Preencher a partir do PUC</div>
                <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Fase de teste · não grava dados
                </div>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Importa o PDF do PUC para pré-preencher a tipologia e as atividades encontradas. Antes de guardar, poderás rever e corrigir tudo. O preenchimento manual continua disponível.
            </p>
            <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>As datas de exame e recurso mantêm-se as do calendário oficial já usado pelo Academic Hub e não serão substituídas pelo PUC.</span>
            </div>
          </div>

          <Button asChild className="min-h-11 shrink-0 sm:min-w-40">
            <Link to={`/_teste/puc?courseId=${encodeURIComponent(courseId)}`}>
              <FileUp className="mr-2 h-4 w-4" />
              Importar PUC
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
