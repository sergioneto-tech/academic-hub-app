import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { acceptCurrentPucCatalogVersion } from "@/lib/pucVersionState";

export type PucCatalogPayload = {
  events?: Array<{
    name?: string;
    maxPoints?: number | null;
    startDate?: string;
    endDate?: string;
    gradeReleaseDate?: string;
  }>;
  finalAssessment?: { name?: string; maxPoints?: number | null } | null;
};

export type PucUpdateAlert = {
  accepted_catalog_id: string;
  active_catalog_id: string;
  course_code: string;
  course_name: string;
  academic_year: string;
  edition: string;
  accepted_version: number;
  active_version: number;
  accepted_evaluation_model: string;
  active_evaluation_model: string;
  accepted_payload: PucCatalogPayload;
  active_payload: PucCatalogPayload;
  accepted_at: string;
  active_validated_at: string;
};

export type PucUpdateDifference = {
  label: string;
  before: string;
  after: string;
};

function pucClient(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

function show(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function modelLabel(value: string) {
  const labels: Record<string, string> = {
    type1: "Tipologia 1",
    type2: "Tipologia 2",
    type3: "Tipologia 3",
    type4: "Tipologia 4",
    "exam-only": "Avaliação por exame",
    custom: "Configuração personalizada",
  };
  return labels[value] ?? value;
}

export function buildPucUpdateDifferences(alert: PucUpdateAlert): PucUpdateDifference[] {
  const differences: PucUpdateDifference[] = [];

  if (alert.accepted_evaluation_model !== alert.active_evaluation_model) {
    differences.push({
      label: "Modelo de avaliação",
      before: modelLabel(alert.accepted_evaluation_model),
      after: modelLabel(alert.active_evaluation_model),
    });
  }

  const beforeEvents = Array.isArray(alert.accepted_payload?.events) ? alert.accepted_payload.events : [];
  const afterEvents = Array.isArray(alert.active_payload?.events) ? alert.active_payload.events : [];
  const count = Math.max(beforeEvents.length, afterEvents.length);
  const fields: Array<[keyof NonNullable<PucCatalogPayload["events"]>[number], string]> = [
    ["name", "Nome"],
    ["maxPoints", "Cotação"],
    ["startDate", "Data inicial"],
    ["endDate", "Data final"],
    ["gradeReleaseDate", "Divulgação da nota"],
  ];

  for (let index = 0; index < count; index += 1) {
    const before = beforeEvents[index] ?? {};
    const after = afterEvents[index] ?? {};
    const activity = after.name || before.name || `Atividade ${index + 1}`;

    for (const [field, fieldLabel] of fields) {
      if (before[field] !== after[field]) {
        differences.push({
          label: `${activity} · ${fieldLabel}`,
          before: show(before[field]),
          after: show(after[field]),
        });
      }
    }
  }

  const beforeFinal = alert.accepted_payload?.finalAssessment ?? null;
  const afterFinal = alert.active_payload?.finalAssessment ?? null;
  for (const [field, fieldLabel] of [["name", "Nome"], ["maxPoints", "Cotação"]] as const) {
    if (beforeFinal?.[field] !== afterFinal?.[field]) {
      differences.push({
        label: `Avaliação final · ${fieldLabel}`,
        before: show(beforeFinal?.[field]),
        after: show(afterFinal?.[field]),
      });
    }
  }

  return differences;
}

export async function fetchMyPucUpdateAlerts(): Promise<PucUpdateAlert[]> {
  const { data, error } = await pucClient().rpc("get_my_puc_update_alerts");
  if (error) throw new Error(error.message || "puc_update_alerts_failed");
  return Array.isArray(data) ? data as PucUpdateAlert[] : [];
}

export async function acceptPucUpdate(alert: PucUpdateAlert) {
  return acceptCurrentPucCatalogVersion(alert.active_catalog_id, alert.active_version);
}
