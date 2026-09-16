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

function isAllowedPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host.endsWith(".academic-hub-app.pages.dev") && host !== "academic-hub-app.pages.dev";
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
