import { AlertTriangle, ExternalLink, History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { EvaluationRegime } from "@/lib/types";

const UAB_EVALUATION_URL = "https://portal.uab.pt/avaliacao/";

export default function EvaluationFrameworkNotice({ regime }: { regime: EvaluationRegime }) {
  const isFlexible = regime === "regulation-2026";

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 md:px-6 md:pt-6">
      <Card className={isFlexible
        ? "premium-card border-warning/40 bg-warning/10"
        : "premium-card border-primary/25 bg-primary/5"}
      >
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between md:p-5">
          <div className="flex min-w-0 gap-3">
            <div className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isFlexible
              ? "bg-warning/15 text-warning"
              : "bg-primary/10 text-primary"}`}
            >
              {isFlexible ? <AlertTriangle className="h-5 w-5" /> : <History className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {isFlexible ? "Estrutura definida pelo PUC" : "Avaliação da cadeira"}
              </div>
              <h2 className="mt-1 font-semibold">
                {isFlexible ? "Configuração flexível de avaliação" : "Regime anterior ou histórico"}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                {isFlexible
                  ? "Configura os elementos, ponderações e mínimos exatamente como estiverem definidos no PUC da unidade curricular."
                  : "As formas de avaliação variaram ao longo dos anos. Escolhe abaixo a estrutura realmente utilizada: e-fólios, exame, avaliação personalizada ou apenas a nota final quando já não existir detalhe fiável."}
              </p>
            </div>
          </div>

          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href={UAB_EVALUATION_URL} target="_blank" rel="noopener noreferrer">
              Consultar UAb
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
