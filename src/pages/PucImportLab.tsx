import { useMemo, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSearch2,
  FileText,
  Loader2,
  LockKeyhole,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { extractPucPdfText, type PdfExtractionProgress } from "@/lib/pucPdf";
import {
  parsePucText,
  type PucConfidence,
  type PucDetectedEvent,
  type PucParseResult,
} from "@/lib/pucParser";

const MODEL_LABELS: Record<string, string> = {
  type1: "Tipologia 1",
  type2: "Tipologia 2",
  type3: "Tipologia 3",
  type4: "Tipologia 4",
  "exam-only": "Apenas exame",
  custom: "Configuração personalizada",
};

const KIND_LABELS: Record<string, string> = {
  assessment: "Avaliação",
  exam: "Prova / exame",
  resit: "Recurso",
  "second-exam-date": "Segunda data de prova",
};

function confidenceLabel(confidence: PucConfidence) {
  if (confidence === "high") return "Confirmado no PUC";
  if (confidence === "medium") return "Necessita confirmação";
  return "Leitura parcial";
}

function confidenceClass(confidence: PucConfidence) {
  if (confidence === "high") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (confidence === "medium") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-muted bg-muted/40 text-muted-foreground";
}

function formatIsoDate(value?: string, time?: string) {
  if (!value) return "Não encontrada";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match ? `${match[3]}/${match[2]}/${match[1]}` : value;
  return time ? `${date}, ${time}` : date;
}

function EventCard({ event }: { event: PucDetectedEvent }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card/55 p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold">{event.name}</div>
          <div className="mt-1 text-xs text-muted-foreground">{KIND_LABELS[event.kind] ?? event.kind}</div>
        </div>
        <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-semibold ${confidenceClass(event.confidence)}`}>
          {confidenceLabel(event.confidence)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-xl border bg-background/55 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Início / disponibilização</div>
          <div className="mt-1 text-sm font-medium">{formatIsoDate(event.startDate, event.startTime)}</div>
          {event.rawStartDate && <div className="mt-1 text-[10px] text-muted-foreground">Origem: {event.rawStartDate}</div>}
        </div>
        <div className="rounded-xl border bg-background/55 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fim / entrega</div>
          <div className="mt-1 text-sm font-medium">{formatIsoDate(event.endDate, event.endTime)}</div>
          {event.rawEndDate && <div className="mt-1 text-[10px] text-muted-foreground">Origem: {event.rawEndDate}</div>}
        </div>
        <div className="rounded-xl border bg-background/55 p-3 sm:col-span-2 xl:col-span-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Publicação da nota</div>
          <div className="mt-1 text-sm font-medium">{formatIsoDate(event.gradeReleaseDate)}</div>
        </div>
      </div>

      {event.notes.length > 0 && (
        <div className="mt-3 space-y-1 text-xs leading-5 text-amber-700 dark:text-amber-300">
          {event.notes.map((note) => <p key={note}>⚠ {note}</p>)}
        </div>
      )}
    </div>
  );
}

export default function PucImportLab() {
  const [result, setResult] = useState<PucParseResult | null>(null);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<PdfExtractionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  const modelLabel = result?.evaluationModel
    ? MODEL_LABELS[result.evaluationModel] ?? result.evaluationModel
    : "Não identificada";

  const fileSizeLabel = useMemo(() => {
    if (fileSize === null) return null;
    if (fileSize < 1024 * 1024) return `${Math.max(1, Math.round(fileSize / 1024))} KB`;
    return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
  }, [fileSize]);

  const analyseFile = async (file: File) => {
    setIsReading(true);
    setError(null);
    setResult(null);
    setRawText("");
    setPageCount(null);
    setProgress(null);
    setFileName(file.name);
    setFileSize(file.size);

    try {
      const extracted = await extractPucPdfText(file, setProgress);
      setRawText(extracted.text);
      setPageCount(extracted.pageCount);
      setResult(parsePucText(extracted.text));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível analisar este PDF.";
      setError(message);
    } finally {
      setIsReading(false);
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void analyseFile(file);
  };

  return (
    <div className="space-y-5 pb-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/cadeiras"><ArrowLeft className="mr-2 h-4 w-4" />Voltar às cadeiras</Link>
        </Button>
      </div>

      <section className="premium-surface overflow-hidden">
        <div className="relative p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                <FileSearch2 className="h-7 w-7" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Teste privado · não publicar</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Leitor experimental de PUC</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Seleciona um PUC em PDF para verificar o que o Academic Hub consegue reconhecer. Nesta fase nada é gravado na cadeira, na conta ou no Supabase.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
              <div className="flex items-center gap-2 font-semibold"><LockKeyhole className="h-4 w-4" />Processamento local</div>
              <div className="mt-1 max-w-xs">O PDF é lido no teu navegador. O ficheiro não é enviado para a base de dados.</div>
            </div>
          </div>
        </div>
      </section>

      <Card className="premium-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Upload className="h-5 w-5 text-primary" />Selecionar PUC em PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-primary/35 bg-primary/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <div className="text-sm font-semibold">{fileName || "Ainda não selecionaste nenhum ficheiro"}</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                PDF com texto digital · máximo 20 MB e 80 páginas nesta fase de teste.
                {fileSizeLabel ? ` · ${fileSizeLabel}` : ""}
                {pageCount ? ` · ${pageCount} páginas lidas` : ""}
              </p>
            </div>
            <div className="shrink-0">
              <input
                id="puc-pdf-test-input"
                className="sr-only"
                type="file"
                accept="application/pdf,.pdf"
                onClick={(event) => { event.currentTarget.value = ""; }}
                onChange={handleFile}
                disabled={isReading}
              />
              <Button asChild disabled={isReading}>
                <label htmlFor="puc-pdf-test-input" className="cursor-pointer">
                  {isReading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  {isReading ? "A analisar…" : "Escolher PDF"}
                </label>
              </Button>
            </div>
          </div>

          {isReading && (
            <div className="mt-4 rounded-xl border bg-muted/25 p-3 text-xs text-muted-foreground" role="status" aria-live="polite">
              {progress
                ? `A ler página ${progress.currentPage} de ${progress.totalPages}…`
                : "A preparar o motor de leitura PDF…"}
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div><div className="font-semibold">Não foi possível analisar o PUC</div><div className="mt-1 text-xs leading-5">{error}</div></div>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card className="premium-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-5 w-5 text-emerald-500" />PUC analisado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border bg-background/55 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Unidade curricular</div>
                  <div className="mt-1 text-sm font-semibold">{result.courseName || "Não identificada"}</div>
                </div>
                <div className="rounded-xl border bg-background/55 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Código</div>
                  <div className="mt-1 text-sm font-semibold">{result.courseCode || "Não encontrado"}</div>
                </div>
                <div className="rounded-xl border bg-background/55 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ano letivo / edição</div>
                  <div className="mt-1 text-sm font-semibold">{result.academicYear || "Não encontrado"}{result.edition ? ` · ${result.edition}` : ""}</div>
                </div>
                <div className="rounded-xl border bg-background/55 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tipologia</div>
                  <div className="mt-1 text-sm font-semibold">{modelLabel}</div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
                <strong>Confirmação obrigatória:</strong> este leitor apenas propõe dados. Mesmo quando um campo aparece como confirmado no PUC, a futura importação só poderá ser guardada após revisão do aluno.
              </div>
            </CardContent>
          </Card>

          <section>
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Datas encontradas</h2>
                <p className="mt-1 text-xs text-muted-foreground">{result.events.length} elemento(s) identificado(s) pelo parser determinístico.</p>
              </div>
              <div className="text-xs font-medium text-muted-foreground">Nenhum dado foi guardado</div>
            </div>

            {result.events.length > 0 ? (
              <div className="space-y-3">
                {result.events.map((event) => <EventCard key={`${event.key}-${event.startDate ?? "sem-data"}`} event={event} />)}
              </div>
            ) : (
              <Card className="premium-card"><CardContent className="p-4 text-sm text-muted-foreground">Não foram encontradas datas suficientemente estruturadas para apresentar.</CardContent></Card>
            )}
          </section>

          {result.warnings.length > 0 && (
            <Card className="premium-card border-amber-500/25">
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-5 w-5 text-amber-500" />Pontos a rever</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.warnings.map((warning) => (
                  <div key={warning} className="rounded-xl bg-amber-500/8 px-3 py-2 text-xs leading-5 text-muted-foreground">{warning}</div>
                ))}
              </CardContent>
            </Card>
          )}

          <details className="premium-card group overflow-hidden">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold sm:px-5">Ver texto extraído do PDF <span className="ml-1 text-xs font-normal text-muted-foreground">(diagnóstico desta fase)</span></summary>
            <div className="border-t px-4 py-4 sm:px-5">
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted/30 p-3 text-[11px] leading-5 text-muted-foreground">{rawText}</pre>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
