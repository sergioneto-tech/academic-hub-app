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

const TEST_BRANCH_URL = "https://ufkungluwocxqwquoqcl.supabase.co";
const TEST_BRANCH_PUBLISHABLE_KEY = "sb_publishable_gyBLug3WnRh2nicQBtCa6g_ofeA3aKb";

function isAllowedPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "localhost"
    || host === "127.0.0.1"
    || host === "feature-puc-import-test.academic-hub-app.pages.dev"
    || /^([a-z0-9-]+\.)?academic-hub-app\.pages\.dev$/.test(host);
}

export async function fetchSharedPucCatalogEntries(courseCode: string): Promise<SharedPucCatalogEntry[]> {
  const code = courseCode.trim();
  if (!/^\d{4,8}$/.test(code) || !isAllowedPreviewHost()) return [];

  const params = new URLSearchParams({
    select: "id,course_code,course_name,academic_year,edition,evaluation_model,payload,version,validated_at,updated_at",
    course_code: `eq.${code}`,
    is_active: "eq.true",
    order: "academic_year.desc,edition.asc",
    limit: "10",
  });

  const response = await fetch(`${TEST_BRANCH_URL}/rest/v1/puc_catalog_entries?${params.toString()}`, {
    method: "GET",
    headers: {
      apikey: TEST_BRANCH_PUBLISHABLE_KEY,
      Authorization: `Bearer ${TEST_BRANCH_PUBLISHABLE_KEY}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`shared_puc_catalog_${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];
  return data as SharedPucCatalogEntry[];
}
