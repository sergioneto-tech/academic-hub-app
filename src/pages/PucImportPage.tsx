import { useMemo, useState, type ChangeEvent } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSearch2, FileText, Loader2, LockKeyhole, ShieldAlert } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import PucInitialCatalogProposal from "@/components/PucInitialCatalogProposal";
import PucReviewDraft from "@/components/PucReviewDraft";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/AppStore";
import { buildPucImportDraft, type PucImportDraft } from "@/lib/pucImportDraft";
import { extractPucPdfText, type PdfExtractionProgress } from "@/lib/pucPdf";
import { parsePucText, type PucParseResult } from "@/lib/pucParser";

function normalizeName(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-PT")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCode(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, "").trim().toLocaleLowerCase("pt-PT");
}

function isReliableNumericCode(value: string | undefined): boolean {
  return /^\d{4,8}$/.test(normalizeCode(value));
}

function matchesCourse(targetCourse: { code?: string; name?: string }, result: PucParseResult): "matched" | "mismatch" | "uncertain" {
  const targetCode = normalizeCode(targetCourse.code);
  const parsedCode = normalizeCode(result.courseCode);
  const targetName = normalizeName(targetCourse.name);
  const parsedName = normalizeName(result.courseName);

  if (targetCode && parsedCode && targetCode === parsedCode) return "matched";
  if (targetName && parsedName && targetName === parsedName) return "matched";
  if (isReliableNumericCode(targetCourse.code) && isReliableNumericCode(result.courseCode) && targetCode !== parsedCode) return "mismatch";
  return "uncertain";
}

export default function PucImportPage() {
  const [searchParams] = useSearchParams();
  const { state } = useAppStore();
  const courseId = searchParams.get("courseId") ?? "";
  const targetCourse = useMemo(
    () => state.courses.find((course) => course.id === courseId),
    [state.courses, courseId],
  );

  const [result, setResult] = useState<PucParseResult | null>(null);
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [sourceHash, setSourceHash] = useState("");
  const [progress, setProgress] = useState<PdfExtractionProgress | null>(null);
  const [error, setError] = useState("");
  const [mismatch, setMismatch] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [saved, setSaved] = useState(false);

  const backPath = targetCourse ? `/cadeiras/${encodeURIComponent(targetCourse.id)}` : "/cadeiras";
  const backLabel = targetCourse ? `Voltar a ${targetCourse.name}` : "Voltar às cadeiras";

  const savedDraft = useMemo<PucImportDraft | null>(() => {
    if (!saved || !result || !targetCourse) return null;
    const parsedDraft = buildPucImportDraft(result, rawText);
    const assessments = state.assessments.filter((item) => item.courseId === targetCourse.id);
    const imported = assessments
      .filter((item) => item.type !== "exam" && item.type !== "resit" && item.type !== "special")
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const exam = assessments.find((item) => item.type === "exam");

    return {
      model: targetCourse.evaluationModel ?? parsedDraft.model,
      events: imported.map((item, index) => ({
        key: `saved-${item.id || index}`,
        name: item.name,
        maxPoints: item.maxPoints,
        startDate: item.startDate ?? "",
        endDate: item.endDate ?? "",
        gradeReleaseDate: item.gradeReleaseDate ?? "",
      })),
      finalAssessment: parsedDraft.finalAssessment
        ? {
            name: parsedDraft.finalAssessment.name,
            maxPoints: exam?.maxPoints ?? parsedDraft.finalAssessment.maxPoints,
          }
        : null,
      warnings: [],
    };
  }, [saved, result, targetCourse, rawText, state.assessments]);

  const analyseFile = async (file: File) => {
    setIsReading(true);
    setError("");
    setMismatch("");
    setResult(null);
    setRawText("");
    setPageCount(null);
    setSourceHash("");
    setProgress(null);
    setSaved(false);
    setFileName(file.name);

    try {
      if (!targetCourse) throw new Error("Não foi possível identificar a cadeira selecionada.");
      const extracted = await extractPucPdfText(file, setProgress);
      const parsed = parsePucText(extracted.text);
      const match = matchesCourse(targetCourse, parsed);
      setPageCount(extracted.pageCount);
      setSourceHash(extracted.sourceHash);

      if (match === "mismatch") {
        setMismatch(`Este PDF pertence a ${parsed.courseName || "outra unidade curricular"}${parsed.courseCode ? ` (${parsed.courseCode})` : ""}, e não a ${targetCourse.name} (${targetCourse.code}). Seleciona o PUC correto para continuar.`);
        return;
      }

      setRawText(extracted.text);
      setResult(parsed);
      if (match === "uncertain") {
        setError(`Não foi possível confirmar automaticamente que o PDF pertence a ${targetCourse.name} (${targetCourse.code}). Revê cuidadosamente os dados antes de guardar.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível analisar este PDF.");
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
          <Link to={backPath}><ArrowLeft className="mr-2 h-4 w-4" />{backLabel}</Link>
        </Button>
      </div>

      <section className="premium-surface overflow-hidden">
        <div className="relative p-5 sm:p-7">
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
                <FileSearch2 className="h-7 w-7" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">PUC · importação assistida</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Importar dados do PUC</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  Seleciona o PDF do PUC desta UC. O Academic Hub lê o documento localmente, propõe os dados encontrados e só grava depois da tua revisão e confirmação explícita.
                </p>
                {targetCourse && (
                  <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                    <span className="font-semibold">Cadeira:</span>
                    <span>{targetCourse.name}</span>
                    <span className="rounded-md bg-background/70 px-2 py-0.5 font-semibold text-muted-foreground">{targetCourse.code}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
              <div className="flex items-center gap-2 font-semibold"><LockKeyhole className="h-4 w-4" />Processamento local</div>
              <div className="mt-1 max-w-xs">O PDF é lido no navegador e não é guardado na base de dados.</div>
            </div>
          </div>
        </div>
      </section>

      <Card className="premium-card">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5 text-primary" />Selecionar PUC em PDF</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-primary/35 bg-primary/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <div className="text-sm font-semibold">{fileName || "Ainda não selecionaste nenhum ficheiro"}</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">PDF com texto digital · máximo 20 MB e 80 páginas{pageCount ? ` · ${pageCount} páginas lidas` : ""}.</p>
            </div>
            <div className="shrink-0">
              <input id="puc-pdf-input" className="sr-only" type="file" accept="application/pdf,.pdf" onClick={(event) => { event.currentTarget.value = ""; }} onChange={handleFile} disabled={isReading} />
              <Button asChild disabled={isReading}>
                <label htmlFor="puc-pdf-input" className="cursor-pointer">
                  {isReading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  {isReading ? "A analisar…" : "Escolher PDF"}
                </label>
              </Button>
            </div>
          </div>

          {isReading && (
            <div className="mt-4 rounded-xl border bg-muted/25 p-3 text-xs text-muted-foreground" role="status" aria-live="polite">
              {progress ? `A ler página ${progress.currentPage} de ${progress.totalPages}…` : "A preparar a leitura do PDF…"}
            </div>
          )}

          {mismatch && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div><div className="font-semibold">PUC de outra cadeira</div><div className="mt-1 text-xs leading-5">{mismatch}</div></div>
            </div>
          )}

          {error && !mismatch && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{error}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {result && targetCourse && (
        <>
          <Card className="premium-card">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <div className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <div>
                  <div className="font-semibold">PUC analisado</div>
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {result.courseName || targetCourse.name}{result.courseCode ? ` · ${result.courseCode}` : ""}{result.academicYear ? ` · ${result.academicYear}` : ""}. Revê todos os campos antes de guardar.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <PucReviewDraft
            result={result}
            rawText={rawText}
            courseId={targetCourse.id}
            courseName={targetCourse.name}
            courseCode={targetCourse.code}
            defaultOpen
            onSaved={() => setSaved(true)}
          />

          {saved && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-800 dark:text-emerald-200">
              Dados revistos e guardados na cadeira. O método manual continua disponível para alterações posteriores.
            </div>
          )}

          {saved && savedDraft && pageCount && sourceHash && (
            <PucInitialCatalogProposal
              courseCode={targetCourse.code}
              courseName={targetCourse.name}
              academicYear={result.academicYear}
              edition={result.edition}
              draft={savedDraft}
              sourceHash={sourceHash}
              sourcePageCount={pageCount}
            />
          )}
        </>
      )}
    </div>
  );
}
