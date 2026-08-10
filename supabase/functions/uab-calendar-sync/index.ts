import { createClient } from "supabase";
import { getDocument } from "pdfjs";

const PAGE_URL = "https://portal.uab.pt/calendario-letivo/";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

type Category = "enrollment" | "classes" | "exams" | "break" | "deadline" | "info";
type Event = {
  id: string;
  label: string;
  description: string;
  startDate: string;
  endDate: string;
  semester: 0 | 1 | 2;
  category: Category;
  alertDaysBefore: number;
  icon: string;
};

type Range = { startDate: string; endDate: string };

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&ordm;|&#186;/g, "º");
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDay(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function extractLinks(html: string) {
  const links: Array<{ href: string; text: string; year: string }> = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const text = escapeHtml(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    const normalized = normalize(text);
    const yearMatch = normalized.match(/(20\d{2})\s*\/\s*(20\d{2})/);
    if (!yearMatch) continue;
    if (!/cursos de 1\.?\s*o?\s*ciclo/.test(normalized.replace(/º/g, "o"))) continue;
    links.push({ href: new URL(escapeHtml(match[1]), PAGE_URL).href, text, year: `${yearMatch[1]}/${yearMatch[2]}` });
  }
  return links.sort((a, b) => b.year.localeCompare(a.year, "pt-PT"));
}

async function pdfText(data: Uint8Array) {
  const task = getDocument({ data, disableWorker: true, isEvalSupported: false, useWorkerFetch: false });
  const pdf = await task.promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => typeof item?.str === "string" ? item.str : "").join(" ");
    pages.push(text);
  }
  await pdf.destroy();
  return normalize(pages.join(" "));
}

function rangeAfter(text: string, label: RegExp, maxChars = 220): Range | null {
  const match = label.exec(text);
  label.lastIndex = 0;
  if (!match?.index && match?.index !== 0) return null;
  const fragment = text.slice(match.index + match[0].length, match.index + match[0].length + maxChars);
  const months = Object.keys(MONTHS).join("|");
  const re = new RegExp(
    `(\\d{1,2})(?:\\s+de)?(?:\\s+(${months}))?(?:\\s+de)?(?:\\s+(20\\d{2}))?\\s+a\\s+(\\d{1,2})(?:\\s+de)?\\s+(${months})(?:\\s+de)?\\s+(20\\d{2})`,
  );
  const m = fragment.match(re);
  if (!m) return null;
  const endMonth = MONTHS[m[5]];
  const endYear = Number(m[6]);
  const startMonth = m[2] ? MONTHS[m[2]] : endMonth;
  const startYear = m[3] ? Number(m[3]) : endYear;
  return { startDate: ymd(startYear, startMonth, Number(m[1])), endDate: ymd(endYear, endMonth, Number(m[4])) };
}

function allRanges(text: string): Range[] {
  const months = Object.keys(MONTHS).join("|");
  const re = new RegExp(
    `(\\d{1,2})(?:\\s+de)?(?:\\s+(${months}))?(?:\\s+de)?(?:\\s+(20\\d{2}))?\\s+a\\s+(\\d{1,2})(?:\\s+de)?\\s+(${months})(?:\\s+de)?\\s+(20\\d{2})`,
    "g",
  );
  const ranges: Range[] = [];
  for (const m of text.matchAll(re)) {
    const endMonth = MONTHS[m[5]];
    const endYear = Number(m[6]);
    const startMonth = m[2] ? MONTHS[m[2]] : endMonth;
    const startYear = m[3] ? Number(m[3]) : endYear;
    ranges.push({ startDate: ymd(startYear, startMonth, Number(m[1])), endDate: ymd(endYear, endMonth, Number(m[4])) });
  }
  return ranges;
}

function singleDateAfter(text: string, label: RegExp, maxChars = 150): string | null {
  const match = label.exec(text);
  label.lastIndex = 0;
  if (!match?.index && match?.index !== 0) return null;
  const fragment = text.slice(match.index + match[0].length, match.index + match[0].length + maxChars);
  const months = Object.keys(MONTHS).join("|");
  const m = fragment.match(new RegExp(`(?:ate\\s+)?(\\d{1,2})(?:\\s+de)?\\s+(${months})(?:\\s+de)?\\s+(20\\d{2})`));
  return m ? ymd(Number(m[3]), MONTHS[m[2]], Number(m[1])) : null;
}

function monthSpanAfter(text: string, label: RegExp, academicYear: string): Range | null {
  const match = label.exec(text);
  label.lastIndex = 0;
  if (!match?.index && match?.index !== 0) return null;
  const fragment = text.slice(match.index + match[0].length, match.index + match[0].length + 120);
  const months = Object.keys(MONTHS).join("|");
  const m = fragment.match(new RegExp(`(${months})\\s*[-e]+\\s*(${months})(?:\\s+de)?\\s+(20\\d{2})?`));
  if (!m) return null;
  const startYear = Number((m[3] || academicYear.split("/")[1]));
  const endYear = startYear;
  const sm = MONTHS[m[1]], em = MONTHS[m[2]];
  return { startDate: ymd(startYear, sm, 1), endDate: ymd(endYear, em, lastDay(endYear, em)) };
}

function buildEvent(id: string, label: string, description: string, range: Range, semester: 0 | 1 | 2, category: Category, alertDaysBefore: number, icon: string): Event {
  return { id, label, description, ...range, semester, category, alertDaysBefore, icon };
}

function parseCalendar(text: string, academicYear: string, source: string) {
  const secondIndex = text.search(/2\s*o\s*semestre/);
  if (secondIndex < 0) throw new Error("Não foi possível identificar o 2.º semestre no PDF oficial.");
  const firstSem = text.slice(0, secondIndex);
  const secondSem = text.slice(secondIndex);

  const candStart = text.indexOf("i. candidaturas");
  const candEnd = text.indexOf("ii. matriculas");
  const candidateRanges = candStart >= 0 && candEnd > candStart ? allRanges(text.slice(candStart, candEnd)) : [];
  const candidaturasCom = candidateRanges[0];
  const candidaturasSem = candidateRanges[1];
  const resultados = singleDateAfter(text, /publicitacao de resultados/);
  const matriculas1 = rangeAfter(firstSem, /matriculas e inscricoes/);
  const creditacao1 = rangeAfter(firstSem, /pedidos de creditacao de competencias/);
  const ambientacao = rangeAfter(firstSem, /modulo de ambientacao[^:]*:/);
  const atividades1 = rangeAfter(firstSem, /atividades letivas\s*:/);
  const pausa1 = rangeAfter(firstSem, /pausa letiva\s*:/);
  const anulacao1Date = singleDateAfter(firstSem, /anulacao de inscricoes\s*\d*/);
  const avaliacao1 = monthSpanAfter(firstSem, /avaliacao\s*\d*/, academicYear);
  const atividades2 = rangeAfter(secondSem, /atividades letivas\s*:/);
  const pausa2 = rangeAfter(secondSem, /pausa letiva\s*:/);
  const matriculas2 = rangeAfter(secondSem, /matriculas e inscricoes/);
  const creditacao2 = rangeAfter(secondSem, /pedidos de creditacao de competencias/);
  const anulacao2Date = singleDateAfter(secondSem, /anulacao de inscricoes\s*\d*/);
  const avaliacao2 = monthSpanAfter(secondSem, /avaliacao\s*\d*/, academicYear);
  const epoca = monthSpanAfter(secondSem, /epoca especial\s*\d*/, academicYear);

  const missing = Object.entries({ candidaturasCom, candidaturasSem, resultados, matriculas1, creditacao1, ambientacao, atividades1, pausa1, anulacao1Date, avaliacao1, atividades2, pausa2, matriculas2, creditacao2, anulacao2Date, avaliacao2, epoca })
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) throw new Error(`Calendário oficial encontrado, mas faltam campos essenciais: ${missing.join(", ")}.`);

  const events: Event[] = [
    buildEvent("candidaturas-com-provas", "Candidaturas (com provas)", "Período de candidaturas com provas de acesso", candidaturasCom!, 0, "enrollment", 14, "📋"),
    buildEvent("candidaturas-sem-provas", "Candidaturas (sem provas)", "Acesso Direto, Reingresso, Mudança de Curso e UCI 1.º ciclo", candidaturasSem!, 0, "enrollment", 14, "📋"),
    buildEvent("resultados-candidaturas", "Publicitação de resultados", "Publicitação dos resultados das candidaturas com provas", { startDate: resultados!, endDate: resultados! }, 0, "info", 7, "📢"),
    buildEvent("matriculas-1sem", "Matrículas e inscrições — 1º semestre", "Período de matrículas e inscrições do 1º semestre", matriculas1!, 1, "enrollment", 14, "🎓"),
    buildEvent("creditacao-1sem", "Creditação de competências — 1º semestre", "Prazo para pedidos de creditação de competências", creditacao1!, 1, "deadline", 7, "📄"),
    buildEvent("ambientacao", "Módulo de Ambientação", "Módulo de ambientação para estudantes matriculados pela 1.ª vez na UAb", ambientacao!, 1, "info", 7, "🧭"),
    buildEvent("inicio-1sem", "Atividades letivas — 1º semestre", "Período de atividades letivas do 1º semestre", atividades1!, 1, "classes", 7, "📚"),
    buildEvent("anulacao-1sem", "Anulação de inscrições — 1º semestre", "Prazo limite para anular inscrições do 1º semestre", { startDate: anulacao1Date!, endDate: anulacao1Date! }, 1, "deadline", 14, "⚠️"),
    buildEvent("pausa-natal", "Pausa letiva de Natal", "Pausa letiva — Natal", pausa1!, 1, "break", 3, "🎄"),
    buildEvent("avaliacao-1sem", "Avaliação — 1º semestre", "Avaliação do 1º semestre — consultar calendário de provas", avaliacao1!, 1, "exams", 14, "📝"),
    buildEvent("matriculas-2sem", "Matrículas e inscrições — 2º semestre", "Período de matrículas e inscrições do 2º semestre", matriculas2!, 2, "enrollment", 14, "🎓"),
    buildEvent("creditacao-2sem", "Creditação de competências — 2º semestre", "Prazo para pedidos de creditação de competências", creditacao2!, 2, "deadline", 7, "📄"),
    buildEvent("inicio-2sem", "Atividades letivas — 2º semestre", "Período de atividades letivas do 2º semestre", atividades2!, 2, "classes", 7, "📚"),
    buildEvent("pausa-pascoa", "Pausa letiva da Páscoa", "Pausa letiva — Páscoa", pausa2!, 2, "break", 3, "🐣"),
    buildEvent("anulacao-2sem", "Anulação de inscrições — 2º semestre", "Prazo limite para anular inscrições do 2º semestre", { startDate: anulacao2Date!, endDate: anulacao2Date! }, 2, "deadline", 14, "⚠️"),
    buildEvent("avaliacao-2sem", "Avaliação — 2º semestre", "Avaliação do 2º semestre — consultar calendário de provas", avaliacao2!, 2, "exams", 14, "📝"),
    buildEvent("epoca-especial", "Época especial", "Época especial de exames", epoca!, 0, "exams", 14, "📝"),
  ];

  const [startYear, endYear] = academicYear.split("/").map(Number);
  if (events.some((event) => Number(event.startDate.slice(0, 4)) < startYear || Number(event.endDate.slice(0, 4)) > endYear + 1)) {
    throw new Error("As datas extraídas não são coerentes com o ano letivo detetado.");
  }
  return { academicYear, officialSource: source, events };
}

async function sha256(data: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function refresh(db: any) {
  const page = await fetch(PAGE_URL, { headers: { "User-Agent": "AcademicHub/1.0 calendar-sync" } });
  if (!page.ok) throw new Error(`A página de calendário UAb respondeu ${page.status}.`);
  const html = await page.text();
  const latest = extractLinks(html)[0];
  if (!latest) throw new Error("Não foi encontrado um calendário de 1.º ciclo na página oficial da UAb.");

  const pdfResponse = await fetch(latest.href, { headers: { "User-Agent": "AcademicHub/1.0 calendar-sync" } });
  if (!pdfResponse.ok) throw new Error(`O PDF oficial respondeu ${pdfResponse.status}.`);
  const bytes = new Uint8Array(await pdfResponse.arrayBuffer());
  const sourceHash = await sha256(bytes);

  const { data: existing } = await db.from("uab_academic_calendars").select("source_hash").eq("academic_year", latest.year).maybeSingle();
  if (existing?.source_hash === sourceHash) {
    await db.from("uab_academic_calendars").update({ checked_at: new Date().toISOString(), last_error: null }).eq("academic_year", latest.year);
    return { changed: false, academicYear: latest.year, source: latest.href };
  }

  const text = await pdfText(bytes);
  const payload = parseCalendar(text, latest.year, latest.href);
  const { error } = await db.from("uab_academic_calendars").upsert({
    academic_year: latest.year,
    source_url: latest.href,
    source_hash: sourceHash,
    payload,
    is_valid: true,
    checked_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_error: null,
  }, { onConflict: "academic_year" });
  if (error) throw error;
  return { changed: true, academicYear: latest.year, source: latest.href, events: payload.events.length };
}

export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    if (req.method === "GET") {
      const url = new URL(req.url);
      const year = url.searchParams.get("year");
      let query = db.from("uab_academic_calendars").select("academic_year,source_url,payload,checked_at,updated_at").eq("is_valid", true);
      query = year ? query.eq("academic_year", year) : query.order("academic_year", { ascending: false }).limit(1);
      const { data, error } = year ? await query.maybeSingle() : await query.maybeSingle();
      if (error) return jsonResponse({ error: "Não foi possível consultar o calendário académico." }, 500);
      return jsonResponse({ calendar: data ?? null });
    }

    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
    const { data: cfg } = await db.from("push_server_config").select("key,value").in("key", ["cron_secret"]);
    const config = Object.fromEntries((cfg ?? []).map((row: any) => [row.key, row.value]));
    if (!config.cron_secret || req.headers.get("x-cron-secret") !== config.cron_secret) return jsonResponse({ error: "Unauthorized" }, 401);

    try {
      return jsonResponse(await refresh(db));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha inesperada na atualização do calendário UAb.";
      console.error("uab-calendar-sync", message);
      return jsonResponse({ error: message }, 502);
    }
  },
};
