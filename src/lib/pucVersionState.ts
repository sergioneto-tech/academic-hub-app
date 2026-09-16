import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type PucVersionStatus = {
  accepted_catalog_id: string;
  course_code: string;
  academic_year: string;
  edition: string;
  accepted_version: number;
  accepted_at: string;
  active_catalog_id: string | null;
  active_version: number | null;
  active_validated_at: string | null;
  update_available: boolean;
};

function pucClient(): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

export async function acceptCurrentPucCatalogVersion(catalogId: string, expectedVersion: number) {
  if (!catalogId || !Number.isInteger(expectedVersion) || expectedVersion <= 0) {
    throw new Error("puc_acceptance_invalid_input");
  }

  const { data, error } = await pucClient().rpc("accept_puc_catalog_version", {
    p_catalog_id: catalogId,
    p_expected_version: expectedVersion,
  });

  if (error) throw new Error(error.message || "puc_acceptance_failed");
  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function fetchMyPucVersionStatus(): Promise<PucVersionStatus[]> {
  const { data, error } = await pucClient().rpc("get_my_puc_catalog_version_status");
  if (error) throw new Error(error.message || "puc_version_status_failed");
  return Array.isArray(data) ? data as PucVersionStatus[] : [];
}
