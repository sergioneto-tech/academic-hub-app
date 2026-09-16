import { supabase } from "@/integrations/supabase/client";
import type { PucCorrectionDeclaration, PucDraftChange } from "@/components/PucReviewDraft";
import type { PucImportDraft } from "@/lib/pucImportDraft";
import type { SharedPucCatalogEntry } from "@/lib/pucSharedCatalogTest";

type SubmissionResult =
  | { ok: true; id: string; message: string }
  | { ok: false; reason: "not-authenticated" | "duplicate" | "rate-limited" | "catalog-mismatch" | "invalid" | "unknown"; message: string };

function proposalPayload(draft: PucImportDraft, changes: PucDraftChange[]) {
  return {
    events: draft.events.map((event) => ({
      name: event.name,
      maxPoints: event.maxPoints,
      startDate: event.startDate,
      endDate: event.endDate,
      gradeReleaseDate: event.gradeReleaseDate,
    })),
    finalAssessment: draft.finalAssessment
      ? { name: draft.finalAssessment.name, maxPoints: draft.finalAssessment.maxPoints }
      : null,
    changes,
  };
}

export async function submitPucCorrection({
  entry,
  draft,
  changes,
  declaration,
}: {
  entry: SharedPucCatalogEntry;
  draft: PucImportDraft;
  changes: PucDraftChange[];
  declaration: PucCorrectionDeclaration;
}): Promise<SubmissionResult> {
  if (!entry.id || !/^\d{4,8}$/.test(entry.course_code) || changes.length === 0) {
    return { ok: false, reason: "invalid", message: "A proposta não contém dados válidos para enviar." };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) {
    return { ok: false, reason: "not-authenticated", message: "A sessão terminou. Inicia sessão novamente antes de comunicar a correção." };
  }

  // The generated Supabase type file is intentionally minimal in this project. Cast only this
  // new table access until types are regenerated in the release-preparation step.
  const client = supabase as any;

  const { data: currentEntry, error: catalogError } = await client
    .from("puc_catalog_entries")
    .select("id,course_code,academic_year,edition,version,is_active")
    .eq("id", entry.id)
    .maybeSingle();

  if (catalogError || !currentEntry || currentEntry.is_active !== true
      || currentEntry.course_code !== entry.course_code
      || currentEntry.academic_year !== entry.academic_year
      || currentEntry.edition !== entry.edition
      || currentEntry.version !== entry.version) {
    return {
      ok: false,
      reason: "catalog-mismatch",
      message: "A versão partilhada já não coincide com a versão disponível no servidor. Atualiza os dados antes de enviar a correção.",
    };
  }

  const payload = proposalPayload(draft, changes);
  const { data, error } = await client
    .from("puc_catalog_submissions")
    .insert({
      user_id: user.id,
      kind: "correction",
      course_code: entry.course_code,
      course_name: entry.course_name,
      academic_year: entry.academic_year,
      edition: entry.edition,
      evaluation_model: draft.model,
      proposed_payload: payload,
      base_catalog_id: entry.id,
      base_version: entry.version,
      reason: "Correção comunicada a partir da revisão do catálogo partilhado.",
      status: "pending",
      submitter_declaration_version: declaration.version,
      submitter_declared_at: declaration.acceptedAt,
      submitter_source_confirmed: declaration.sourceConfirmed,
    })
    .select("id")
    .single();

  if (!error && data?.id) {
    return {
      ok: true,
      id: data.id,
      message: "Correção comunicada com sucesso. Ficou pendente de validação e não alterou os dados dos outros alunos.",
    };
  }

  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (error?.code === "23505" || text.includes("pending_dedupe")) {
    return { ok: false, reason: "duplicate", message: "Já existe uma proposta igual pendente para esta versão." };
  }
  if (text.includes("puc_submission_rate_limited")) {
    return { ok: false, reason: "rate-limited", message: "Foram enviadas várias propostas num curto período. Tenta novamente mais tarde." };
  }
  if (text.includes("puc_correction_base_mismatch") || text.includes("puc_correction_base_unavailable")) {
    return { ok: false, reason: "catalog-mismatch", message: "A versão-base deixou de estar disponível. Atualiza os dados e volta a rever a correção." };
  }

  return { ok: false, reason: "unknown", message: "Não foi possível comunicar a correção. Nenhum dado foi alterado." };
}
