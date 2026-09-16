import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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

function pucClient(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
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

/**
 * O estado local da cadeira não guarda atualmente a edição/turma UAb.
 * Por isso nunca escolhemos silenciosamente entre duas edições ativas do mesmo
 * ano letivo. Se o catálogo tiver mais do que uma edição para o ano mais recente,
 * o chamador deve recorrer ao PDF até existir um seletor explícito de edição.
 */
export function selectUnambiguousSharedPucEntry(entries: SharedPucCatalogEntry[]): SharedPucCatalogEntry | null {
  if (entries.length === 0) return null;
  const latestAcademicYear = entries.reduce(
    (latest, entry) => entry.academic_year > latest ? entry.academic_year : latest,
    entries[0].academic_year,
  );
  const latest = entries.filter((entry) => entry.academic_year === latestAcademicYear);
  const editions = new Set(latest.map((entry) => entry.edition));
  if (editions.size !== 1) return null;
  return latest[0] ?? null;
}

export async function fetchSharedPucCatalogEntries(courseCode: string): Promise<SharedPucCatalogEntry[]> {
  const code = courseCode.trim();
  if (!/^\d{4,8}$/.test(code)) return [];

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) return [];

  const { data, error } = await pucClient()
    .from("puc_catalog_entries")
    .select("id,course_code,course_name,academic_year,edition,evaluation_model,payload,version,validated_at,updated_at")
    .eq("course_code", code)
    .eq("is_active", true)
    .order("academic_year", { ascending: false })
    .order("edition", { ascending: true })
    .limit(10);

  if (error) throw new Error(error.message || "shared_puc_catalog_unavailable");
  return Array.isArray(data) ? data as SharedPucCatalogEntry[] : [];
}
