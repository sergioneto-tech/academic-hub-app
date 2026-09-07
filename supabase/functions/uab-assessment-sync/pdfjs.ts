import { WorkerMessageHandler } from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";
export { getDocument } from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";

// O Edge Runtime não permite que o fake worker do PDF.js faça um import remoto
// dinâmico em runtime. Ao incluir o worker estaticamente no bundle e expô-lo
// no local esperado pelo PDF.js, a extração de texto funciona sem Canvas/Node.
(globalThis as typeof globalThis & {
  pdfjsWorker?: { WorkerMessageHandler: typeof WorkerMessageHandler };
}).pdfjsWorker = { WorkerMessageHandler };
