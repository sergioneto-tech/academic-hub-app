import { supabase } from "@/integrations/supabase/client";

export const PUC_ADMIN_MANAGER_USER_ID = "b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c";

export type PucAdminSubmission = {
  id: string;
  user_id: string;
  kind: "correction" | "new_entry";
  course_code: string;
  course_name: string;
  academic_year: string;
  edition: string;
  evaluation_model: string;
  proposed_payload: {
    events?: Array<{
      name: string;
      maxPoints: number | null;
      startDate?: string;
      endDate?: string;
      gradeReleaseDate?: string;
    }>;
    finalAssessment?: { name: string; maxPoints: number | null } | null;
    changes?: Array<{ field: string; before: string; after: string }>;
  };
  base_catalog_id: string | null;
  base_version: number | null;
  status: "pending" | "approved" | "rejected" | "superseded";
  reason: string | null;
  resolution_note: string | null;
  submitter_declaration_version: string | null;
  submitter_declared_at: string | null;
  submitter_source_confirmed: boolean;
  created_at: string;
  resolved_at: string | null;
  reviewed_by: string | null;
};

type ReviewResult = {
  submission_id: string;
  submission_status: "approved" | "rejected" | "superseded";
  new_catalog_id: string | null;
  new_catalog_version: number | null;
};

export async function isCurrentUserPucAdmin(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser();
  return !error && data.user?.id === PUC_ADMIN_MANAGER_USER_ID;
}

export async function fetchPendingPucSubmissions(): Promise<PucAdminSubmission[]> {
  if (!(await isCurrentUserPucAdmin())) throw new Error("puc_admin_forbidden");
  const client = supabase as any;
  const { data, error } = await client
    .from("puc_catalog_submissions")
    .select("id,user_id,kind,course_code,course_name,academic_year,edition,evaluation_model,proposed_payload,base_catalog_id,base_version,status,reason,resolution_note,submitter_declaration_version,submitter_declared_at,submitter_source_confirmed,created_at,resolved_at,reviewed_by")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? data as PucAdminSubmission[] : [];
}

export async function reviewPucSubmission(
  submissionId: string,
  decision: "approve" | "reject",
  note: string,
): Promise<ReviewResult> {
  if (!(await isCurrentUserPucAdmin())) throw new Error("puc_admin_forbidden");
  const client = supabase as any;
  const { data, error } = await client.rpc("review_puc_catalog_submission", {
    p_submission_id: submissionId,
    p_decision: decision,
    p_note: note.trim() || null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("puc_admin_empty_result");
  return row as ReviewResult;
}
