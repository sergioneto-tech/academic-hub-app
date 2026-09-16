import type { PucImportDraft } from "./pucImportDraft";
import type { EvaluationModel } from "./types";

export type SharedPucCatalogEvent = {
  name: string;
  maxPoints: number | null;
  startDate: string;
  endDate: string;
  gradeReleaseDate: string;
};

export type SharedPucCatalogFinalAssessment = {
  name: string;
  maxPoints: number | null;
};

export type SharedPucCatalogPayload = {
  events?: SharedPucCatalogEvent[];
  finalAssessment?: SharedPucCatalogFinalAssessment | null;
};

export type SharedPucCatalogEntry = {
  id: string;
  course_code: string;
  course_name: string;
  academic_year: string;
  edition: string;
  evaluation_model: string;
  payload: SharedPucCatalogPayload;
  version: number;
  validated_at: string;
  updated_at: string;
};

const ALLOWED_MODELS = new Set<EvaluationModel>(["type1", "type2", "type3", "type4", "exam-only", "custom"]);

function isAllowedPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host.endsWith(".academic-hub-app.pages.dev") && host !== "academic-hub-app.pages.dev";
}

export function buildSharedPucImportDraft(entry: SharedPucCatalogEntry): PucImportDraft {
  const model = ALLOWED_MODELS.has(entry.evaluation_model as EvaluationModel)
    ? entry.evaluation_model as EvaluationModel
    : "custom";

  const events = (entry.payload.events ?? []).map((event, index) => ({
    key: `shared-${index + 1}`,
    name: event.name,
    maxPoints: event.maxPoints,
    startDate: event.startDate || "",
    endDate: event.endDate || "",
    gradeReleaseDate: event.gradeReleaseDate || "",
  }));

  const finalAssessment = entry.payload.finalAssessment
    ? {
        name: entry.payload.finalAssessment.name,
        maxPoints: entry.payload.finalAssessment.maxPoints,
      }
    : null;

  const warnings: string[] = [];
  const values = [
    ...events.map((event) => event.maxPoints),
    finalAssessment?.maxPoints ?? null,
  ];

  if (values.some((value) => value === null)) {
    warnings.push("Há cotações ainda por confirmar nesta estrutura partilhada; revê os valores antes de guardar.");
  }

  if (values.length > 0 && values.every((value): value is number => value !== null)) {
    const total = values.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 20) > 0.001) {
      warnings.push(`As cotações desta estrutura totalizam ${total} valores em vez de 20; confirma antes de guardar.`);
    }
  }

  return { model, events, finalAssessment, warnings };
}

export async function fetchSharedPucCatalogEntries(courseCode: string): Promise<SharedPucCatalogEntry[]> {
  const code = courseCode.trim();
  if (!/^\d{4,8}$/.test(code) || !isAllowedPreviewHost()) return [];

  const response = await fetch(`/api/puc-catalog-test?courseCode=${encodeURIComponent(code)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`shared_puc_catalog_${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data as SharedPucCatalogEntry[];
}
