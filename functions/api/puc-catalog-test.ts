type PagesContext = {
  request: Request;
};

const TEST_BRANCH_URL = "https://ufkungluwocxqwquoqcl.supabase.co";
const TEST_BRANCH_PUBLISHABLE_KEY = "sb_publishable_gyBLug3WnRh2nicQBtCa6g_ofeA3aKb";

function isAllowedPreviewHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host.endsWith(".academic-hub-app.pages.dev") && host !== "academic-hub-app.pages.dev";
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const onRequestGet = async ({ request }: PagesContext): Promise<Response> => {
  const requestUrl = new URL(request.url);

  // This endpoint is intentionally test-only. Even if the file were merged by mistake,
  // the production Pages hostname/custom domain cannot use it.
  if (!isAllowedPreviewHost(requestUrl.hostname)) {
    return json({ error: "preview_only" }, 404);
  }

  const courseCode = (requestUrl.searchParams.get("courseCode") ?? "").trim();
  if (!/^\d{4,8}$/.test(courseCode)) {
    return json({ error: "invalid_course_code" }, 400);
  }

  const params = new URLSearchParams({
    select: "id,course_code,course_name,academic_year,edition,evaluation_model,payload,version,validated_at,updated_at",
    course_code: `eq.${courseCode}`,
    is_active: "eq.true",
    order: "academic_year.desc,edition.asc",
    limit: "10",
  });

  try {
    const upstream = await fetch(`${TEST_BRANCH_URL}/rest/v1/puc_catalog_entries?${params.toString()}`, {
      method: "GET",
      headers: {
        apikey: TEST_BRANCH_PUBLISHABLE_KEY,
        Accept: "application/json",
      },
    });

    if (!upstream.ok) {
      return json({ error: "catalog_unavailable", status: upstream.status }, 502);
    }

    const data = await upstream.json();
    return json(Array.isArray(data) ? data : []);
  } catch {
    return json({ error: "catalog_unavailable" }, 502);
  }
};
