import type { Course } from "@/types";

const API_BASE = "https://wiki.dcet.uab.pt/files/api.php";

export type DegreeOption = {
  label: string;          // ex: "Engenharia Informática"
  categoryTitle: string;  // ex: "Categoria:Engenharia_Informática"
};

async function api(params: Record<string, string>) {
  const url = new URL(API_BASE);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Wiki API error (${res.status})`);
  return res.json();
}

function norm(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function labelFromCategoryTitle(categoryTitle: string) {
  const raw = categoryTitle.replace(/^Categoria:/, "");
  return decodeURIComponent(raw).replace(/_/g, " ").trim();
}

function uuid(): string {
  // stable enough for local usage
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export async function fetchDegrees(): Promise<DegreeOption[]> {
  const data = await api({
    action: "query",
    list: "categorymembers",
    cmtitle: "Categoria:Licenciaturas",
    cmtype: "subcat",
    cmlimit: "max",
  });

  const members = data?.query?.categorymembers ?? [];
  const degrees: DegreeOption[] = members
    .map((m: any) => String(m.title ?? ""))
    .filter((t: string) => t.startsWith("Categoria:"))
    .map((categoryTitle: string) => ({
      categoryTitle,
      label: labelFromCategoryTitle(categoryTitle),
    }))
    .sort((a: DegreeOption, b: DegreeOption) => a.label.localeCompare(b.label, "pt-PT"));

  return degrees;
}

function parseCoursesFromHtml(html: string): Array<Pick<Course, "code" | "name" | "year" | "semester">> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const out: Array<Pick<Course, "code" | "name" | "year" | "semester">> = [];
  const seen = new Set<string>();

  let currentYear = 1;
  let currentSemester: 1 | 2 = 1;

  const elements = Array.from(doc.body.querySelectorAll("h2,h3,h4,h5,table"));

  for (const el of elements) {
    const txt = norm(el.textContent ?? "");

    const y = txt.match(/(\d+)\s*[ºo]\s*Ano/i);
    if (y) currentYear = Math.max(1, Number(y[1]));

    const s = txt.match(/(\d+)\s*[ºo]\s*Semestre/i);
    if (s) currentSemester = (Number(s[1]) === 2 ? 2 : 1);

    if (el.tagName.toLowerCase() !== "table") continue;

    const rows = Array.from(el.querySelectorAll("tr"));
    for (const row of rows) {
      const tds = Array.from(row.querySelectorAll("td")).map((td) => norm(td.textContent ?? ""));
      if (tds.length < 2) continue;

      // tables frequently come as pairs (code, desc) for each semester
      const pairs: Array<{ code: string; name: string; semester: 1 | 2 }> = [];

      if (tds.length >= 4 && /^\d{4,6}$/.test(tds[0]) && /^\d{4,6}$/.test(tds[2])) {
        // pattern: code1, desc1, code2, desc2 (sem1, sem2)
        pairs.push({ code: tds[0], name: tds[1], semester: 1 });
        pairs.push({ code: tds[2], name: tds[3], semester: 2 });
      } else {
        // generic: iterate pairs
        for (let i = 0; i + 1 < tds.length; i += 2) {
          const code = tds[i];
          const name = tds[i + 1];
          if (!/^\d{4,6}$/.test(code) || !name) continue;
          pairs.push({ code, name, semester: currentSemester });
        }
      }

      for (const p of pairs) {
        const key = `${p.code}|${p.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ code: p.code, name: p.name, year: currentYear, semester: p.semester });
      }
    }
  }

  return out.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.semester !== b.semester) return a.semester - b.semester;
    return a.code.localeCompare(b.code, "pt-PT");
  });
}

export async function fetchDegreePlan(categoryTitle: string): Promise<Array<Pick<Course, "id" | "code" | "name" | "year" | "semester" | "isActive" | "isCompleted">>> {
  const data = await api({
    action: "parse",
    page: categoryTitle,
    prop: "text",
  });

  const html = data?.parse?.text?.["*"] ?? "";
  const parsed = parseCoursesFromHtml(String(html));

  return parsed.map((c) => ({
    id: uuid(),
    code: c.code,
    name: c.name,
    year: c.year,
    semester: c.semester,
    isActive: false,
    isCompleted: false,
  }));
}
