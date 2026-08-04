import { AlertTriangle, ExternalLink, FileCheck2 } from "lucide-react";

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
        : "premium-card border-emerald-300/70 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/25"}
      >
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between md:p-5">
          <div className="flex min-w-0 gap-3">
            <div className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isFlexible
              ? "bg-warning/15 text-warning"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"}`}
            >
              {isFlexible ? <AlertTriangle className="h-5 w-5" /> : <FileCheck2 className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {isFlexible ? "Configuração flexível / experimental" : "Regime atualmente publicado pela UAb"}
              </div>
              <h2 className="mt-1 font-semibold">
                {isFlexible
                  ? "Estrutura adaptável ao PUC da cadeira"
                  : "Avaliação contínua ou final, conforme o PUC"}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                {isFlexible
                  ? "Os modelos adicionais permitem organizar estruturas diferentes de avaliação, mas não são apresentados como um novo regulamento definitivo. Utiliza-os apenas quando o PUC da cadeira indicar essa estrutura."
                  : "Esta cadeira mantém o modelo anterior de e-fólios e g-fólio. Datas, mínimos, ponderações e condições devem ser sempre confirmados no PUC e nas fontes oficiais da Universidade Aberta."}
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
