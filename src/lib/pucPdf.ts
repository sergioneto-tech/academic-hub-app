export type PdfExtractionProgress = {
  currentPage: number;
  totalPages: number;
};

export type PdfExtractionResult = {
  text: string;
  pageCount: number;
};

type PdfTextItem = {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
};

type PdfPage = {
  getTextContent: (options?: Record<string, unknown>) => Promise<{ items: unknown[] }>;
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy?: () => Promise<void>;
};

type PdfLoadingTask = {
  promise: Promise<PdfDocument>;
  destroy?: () => Promise<void>;
};

type PdfJsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (source: Record<string, unknown>) => PdfLoadingTask;
};

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 80;
const PDFJS_MODULE_URL = "/vendor/pdfjs/pdf.mjs";
const PDFJS_WORKER_URL = "/vendor/pdfjs/pdf.worker.mjs";

let pdfJsPromise: Promise<PdfJsModule> | null = null;

function isTextItem(value: unknown): value is PdfTextItem {
  if (!value || typeof value !== "object") return false;
  return "str" in value;
}

function itemY(item: PdfTextItem): number | null {
  const transform = item.transform;
  if (!Array.isArray(transform) || transform.length < 6) return null;
  const value = Number(transform[5]);
  return Number.isFinite(value) ? value : null;
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Reconstrói texto legível a partir dos itens devolvidos pelo PDF.js.
 * Mantém quebras por coordenada vertical e por hasEOL para dar ao parser
 * uma estrutura suficientemente próxima do documento sem tentar recriar layout visual.
 */
export function textItemsToPageText(items: unknown[]): string {
  const lines: string[] = [];
  let currentLine = "";
  let previousY: number | null = null;

  const flushLine = () => {
    const line = normalizeLine(currentLine);
    if (line) lines.push(line);
    currentLine = "";
  };

  for (const rawItem of items) {
    if (!isTextItem(rawItem) || typeof rawItem.str !== "string") continue;

    const text = rawItem.str.trim();
    const y = itemY(rawItem);
    const changedVisualLine =
      previousY !== null && y !== null && Math.abs(previousY - y) > 2.5;

    if (changedVisualLine && currentLine.trim()) flushLine();

    if (text) {
      if (currentLine && !currentLine.endsWith(" ")) currentLine += " ";
      currentLine += text;
    }

    if (rawItem.hasEOL) flushLine();
    if (y !== null) previousY = y;
  }

  flushLine();
  return lines.join("\n");
}

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = import(/* @vite-ignore */ PDFJS_MODULE_URL).then((module) => {
      const pdfjs = module as unknown as PdfJsModule;
      if (!pdfjs?.getDocument || !pdfjs?.GlobalWorkerOptions) {
        throw new Error("O motor de leitura PDF não ficou disponível.");
      }
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

function validatePdfFile(file: File): void {
  const nameLooksPdf = file.name.toLocaleLowerCase("pt-PT").endsWith(".pdf");
  const typeLooksPdf = !file.type || file.type === "application/pdf";

  if (!nameLooksPdf || !typeLooksPdf) {
    throw new Error("Seleciona um ficheiro PDF válido do PUC.");
  }

  if (file.size <= 0) throw new Error("O ficheiro PDF está vazio.");
  if (file.size > MAX_PDF_BYTES) {
    throw new Error("O PDF ultrapassa o limite de 20 MB definido para esta fase de teste.");
  }
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

export async function extractPucPdfText(
  file: File,
  onProgress?: (progress: PdfExtractionProgress) => void,
): Promise<PdfExtractionResult> {
  validatePdfFile(file);

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (!hasPdfSignature(bytes)) {
    throw new Error("O conteúdo selecionado não tem uma assinatura PDF válida.");
  }

  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useWorkerFetch: false,
  });

  let document: PdfDocument | null = null;
  try {
    document = await loadingTask.promise;
    if (!Number.isFinite(document.numPages) || document.numPages < 1) {
      throw new Error("Não foi possível identificar páginas neste PDF.");
    }
    if (document.numPages > MAX_PDF_PAGES) {
      throw new Error("O PDF tem mais de 80 páginas e não será processado nesta fase de teste.");
    }

    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      onProgress?.({ currentPage: pageNumber, totalPages: document.numPages });
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent({ disableNormalization: false });
      const pageText = textItemsToPageText(content.items);
      pages.push(`[PÁGINA ${pageNumber}]\n${pageText}`);
    }

    const text = pages.join("\n\n").trim();
    if (text.length < 80) {
      throw new Error(
        "Foi extraído muito pouco texto. O PDF pode ser uma digitalização/imagem e necessitar de outro método de leitura.",
      );
    }

    return { text, pageCount: document.numPages };
  } finally {
    try {
      await document?.destroy?.();
    } catch {
      // A destruição é apenas limpeza; não deve transformar uma análise concluída em erro.
    }
    try {
      await loadingTask.destroy?.();
    } catch {
      // Idem.
    }
  }
}
