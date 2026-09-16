import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { PucImportDraft } from "@/lib/pucImportDraft";

export const PUC_NEW_ENTRY_DECLARATION_VERSION = "puc-new-entry-v1";

export type PucInitialSubmissionInput = {
  courseCode: string;
  courseName: string;
  academicYear: string;
  edition: string;
  draft: PucImportDraft;
  sourceHash: string;
  sourcePageCount: number;
};

type InitialSubmissionResult =
  | { ok: true; id: string; message: string }
  | { ok: false; reason: "not-authenticated" | "duplicate" | "rate-limited" | "invalid" | "catalog-exists" | "unknown"; message: string };

function pucClient(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

function payloadFromDraft(draft: PucImportDraft) {
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
  };
}

export async function submitInitialPucCatalogEntry(input: PucInitialSubmissionInput): Promise<InitialSubmissionResult> {
  if (!/^\d{4,8}$/.test(input.courseCode)
      || !/^\d{4}\/\d{4}$/.test(input.academicYear)
      || !input.edition.trim()
      || !/^[0-9a-f]{64}$/.test(input.sourceHash)
      || !Number.isInteger(input.sourcePageCount)
      || input.sourcePageCount < 1
      || input.sourcePageCount > 80) {
    return { ok: false, reason: "invalid", message: "Os dados do PUC não estão completos o suficiente para propor uma entrada ao catálogo." };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) {
    return { ok: false, reason: "not-authenticated", message: "A sessão terminou. Inicia sessão novamente antes de enviar a proposta." };
  }

  const client = pucClient();
  const { data: existing, error: catalogError } = await client
    .from("puc_catalog_entries")
    .select("id")
    .eq("course_code", input.courseCode)
    .eq("academic_year", input.academicYear)
    .eq("edition", input.edition)
    .eq("is_active", true)
    .limit(1);

  if (catalogError) {
    return { ok: false, reason: "unknown", message: "Não foi possível confirmar o estado atual do catálogo. Nenhuma proposta foi enviada." };
  }
  if (Array.isArray(existing) && existing.length > 0) {
    return { ok: false, reason: "catalog-exists", message: "Já existe uma versão validada para esta UC, ano letivo e edição. Atualiza a cadeira e usa o fluxo de correção do catálogo partilhado." };
  }

  const { data, error } = await client
    .from("puc_catalog_submissions")
    .insert({
      user_id: user.id,
      kind: "new_entry",
      course_code: input.courseCode,
      course_name: input.courseName,
      academic_year: input.academicYear,
      edition: input.edition,
      evaluation_model: input.draft.model,
      proposed_payload: payloadFromDraft(input.draft),
      source_hash: input.sourceHash,
      source_page_count: input.sourcePageCount,
      base_catalog_id: null,
      base_version: null,
      reason: "Primeira proposta de estrutura PUC para validação do catálogo partilhado.",
      status: "pending",
      submitter_declaration_version: PUC_NEW_ENTRY_DECLARATION_VERSION,
      submitter_declared_at: new Date().toISOString(),
      submitter_source_confirmed: true,
    })
    .select("id")
    .single();

  if (!error && data?.id) {
    return {
      ok: true,
      id: data.id,
      message: "Proposta enviada para validação. Não altera dados de outros alunos até ser aprovada.",
    };
  }

  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (error?.code === "23505" || text.includes("pending_new_entry_dedupe")) {
    return { ok: false, reason: "duplicate", message: "Já existe uma proposta igual pendente para esta UC, ano letivo e edição." };
  }
  if (text.includes("puc_submission_rate_limited")) {
    return { ok: false, reason: "rate-limited", message: "Foram enviadas várias propostas num curto período. Tenta novamente mais tarde." };
  }

  return { ok: false, reason: "unknown", message: "Não foi possível enviar a proposta. Nenhum dado foi alterado." };
}
