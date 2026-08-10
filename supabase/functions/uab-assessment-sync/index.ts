import { createClient } from "supabase";
import { getDocument } from "pdfjs";

const EVALUATION_PAGE = "https://portal.uab.pt/avaliacao/";
const REGULATION_PDF = "https://portal.uab.pt/wp-content/uploads/2026/08/Desp-no9792_2026_4-ago_DR_Regulamento-de-avaliacao.pdf";
const ACADEMIC_YEAR = "2026/2027";
const PARSER_VERSION = "2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" } });

type Item = { str: string; x: number; y: number };
type SlotStatus = "scheduled" | "arrange" | "unavailable";
type Slot = { dateTime: string | null; status: SlotStatus };
type ExamEntry = { code: string; name: string; continuousNormal: Slot; continuousResit: Slot; examNormal: Slot; examResit: Slot };

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/º/g, "o").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase(); }
function escapeHtml(value: string) { return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&ndash;|&#8211;/g, "–").replace(/&ordm;|&#186;/g, "º"); }
async function sha256(bytes: Uint8Array) { const hash = await crypto.subtle.digest("SHA-256", bytes); return Array.from(new Uint8Array(hash)).map((x) => x.toString(16).padStart(2, "0")).join(""); }
async function loadPdf(bytes: Uint8Array): Promise<Item[][]> { const task = getDocument({ data: bytes, disableWorker: true, isEvalSupported: false, useWorkerFetch: false }); const pdf = await task.promise; const pages: Item[][] = []; for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) { const page = await pdf.getPage(pageNumber); const content = await page.getTextContent(); pages.push(content.items.filter((item: any) => typeof item?.str === "string" && item.str.trim()).map((item: any) => ({ str: String(item.str).trim(), x: Number(item.transform?.[4] ?? 0), y: Number(item.transform?.[5] ?? 0) }))); } await pdf.destroy(); return pages; }
function pagesToText(pages: Item[][]) { return pages.map((items) => items.slice().sort((a, b) => Math.abs(b.y - a.y) > 4 ? b.y - a.y : a.x - b.x).map((item) => item.str).join(" ")).join("\n"); }
function extractRegulationCodes(text: string) { const normalized = normalize(text); const annexIndex = normalized.lastIndexOf("anexo"); if (annexIndex < 0) throw new Error("Não foi encontrado o anexo do regulamento."); const annex = normalized.slice(annexIndex); const firstCycle = annex.indexOf("1.o ciclo"); const secondCycle = annex.indexOf("2.o ciclo", firstCycle + 1); if (firstCycle < 0 || secondCycle < 0 || secondCycle <= firstCycle) throw new Error("Não foi possível delimitar o anexo do 1.º ciclo."); const codes = Array.from(new Set(annex.slice(firstCycle, secondCycle).match(/\b\d{5}\b/g) ?? [])).sort(); if (codes.length < 60) throw new Error(`Foram encontrados apenas ${codes.length} códigos no anexo do 1.º ciclo.`); return codes; }

function extractExamLinks(html: string) {
  const links: Array<{ semester: 1 | 2; href: string; text: string }> = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(re)) {
    const href = new URL(escapeHtml(match[1]), EVALUATION_PAGE).href;
    const text = escapeHtml(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    const combined = normalize(`${text} ${href}`);
    if (!combined.includes("calendario") || !combined.includes("prova")) continue;
    if (!(combined.includes("202627") || combined.includes("2026/27") || combined.includes("2026-27"))) continue;
    const before = combined.match(/\b([12])\s*\.?\s*o?\s*semestre\b/);
    const after = combined.match(/\b(?:s|semestre)[-_ ]?([12])\b/);
    const digit = before?.[1] ?? after?.[1] ?? (combined.includes("_s1_") ? "1" : combined.includes("_s2_") ? "2" : null);
    const semester = digit === "2" ? 2 : digit === "1" ? 1 : null;
    if (semester) links.push({ semester, href, text });
  }
  const bySemester = new Map<number, { semester: 1 | 2; href: string; text: string }>();
  for (const link of links) bySemester.set(link.semester, link);
  return Array.from(bySemester.values()).sort((a, b) => a.semester - b.semester);
}

function cluster(values: number[], tolerance = 7) { const sorted = values.filter(Number.isFinite).sort((a, b) => a - b); const groups: number[][] = []; for (const value of sorted) { const current = groups[groups.length - 1]; const mean = current?.reduce((a, b) => a + b, 0) / (current?.length || 1); if (!current || Math.abs(value - mean) > tolerance) groups.push([value]); else current.push(value); } return groups.filter((g) => g.length >= 3).map((g) => g.reduce((a, b) => a + b, 0) / g.length); }
function nearestIndex(value: number, centers: number[]) { let best = -1, distance = Number.POSITIVE_INFINITY; centers.forEach((center, index) => { const next = Math.abs(value - center); if (next < distance) { distance = next; best = index; } }); return best; }
function toIsoDateTime(rawDate: string, hour: string | null) { const match = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return match ? `${match[3]}-${match[2]}-${match[1]}T${String(hour ?? "00").padStart(2, "0")}:00` : null; }
function emptySlot(): Slot { return { dateTime: null, status: "unavailable" }; }

function parseExamSchedule(pages: Item[][], semester: 1 | 2): ExamEntry[] {
  const dateRe = /^\d{2}\/\d{2}\/20\d{2}$/;
  const hourRe = /^(10|13|16)$/;
  const codeRe = /^\d{5}$/;
  const rows: Array<{ codeItem: Item; items: Item[] }> = [];
  for (const pageItems of pages) for (const codeItem of pageItems.filter((item) => codeRe.test(item.str))) rows.push({ codeItem, items: pageItems.filter((item) => Math.abs(item.y - codeItem.y) <= 2.5).sort((a, b) => a.x - b.x) });
  if (rows.length < 50) throw new Error(`O calendário do ${semester}.º semestre só contém ${rows.length} linhas reconhecidas.`);
  const dateCenters = cluster(rows.flatMap((row) => row.items.filter((item) => dateRe.test(item.str)).map((item) => item.x)), 5);
  const hourCenters = cluster(rows.flatMap((row) => row.items.filter((item) => hourRe.test(item.str)).map((item) => item.x)), 4);
  if (dateCenters.length !== 4 || hourCenters.length !== 4) throw new Error(`Estrutura inesperada no calendário: ${dateCenters.length} colunas de data e ${hourCenters.length} de hora.`);
  const entries: ExamEntry[] = [];
  for (const { codeItem, items } of rows) {
    const slots = Array.from({ length: 4 }, () => ({ date: null as string | null, hour: null as string | null, status: "unavailable" as SlotStatus }));
    const name = items.filter((item) => item.x > codeItem.x + 8 && item.x < dateCenters[0] - 5).map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
    for (const item of items) {
      if (dateRe.test(item.str)) { const index = nearestIndex(item.x, dateCenters); if (index >= 0) { slots[index].date = item.str; slots[index].status = "scheduled"; } }
      else if (hourRe.test(item.str)) { const index = nearestIndex(item.x, hourCenters); if (index >= 0) slots[index].hour = item.str; }
      else if (item.str === "*") { const index = nearestIndex(item.x, dateCenters); if (index >= 0) slots[index].status = "arrange"; }
    }
    const packed = slots.map((slot) => ({ dateTime: slot.date ? toIsoDateTime(slot.date, slot.hour) : null, status: slot.date ? "scheduled" as const : slot.status }));
    entries.push({ code: codeItem.str, name, continuousNormal: packed[0] ?? emptySlot(), continuousResit: packed[1] ?? emptySlot(), examNormal: packed[2] ?? emptySlot(), examResit: packed[3] ?? emptySlot() });
  }
  const unique = Array.from(new Map(entries.map((entry) => [entry.code, entry])).values()).sort((a, b) => a.code.localeCompare(b.code));
  if (!unique.some((entry) => entry.code === "21002")) throw new Error("Código de controlo 21002 ausente do calendário.");
  return unique;
}
async function fetchBytes(url: string) { const response = await fetch(url, { headers: { "user-agent": "AcademicHub/1.0 (+https://portal.uab.pt/)" } }); if (!response.ok) throw new Error(`${url} respondeu ${response.status}.`); return new Uint8Array(await response.arrayBuffer()); }

export default { async fetch(req: Request) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "GET" && req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!, serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, db = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
  if (req.method === "GET") {
    const year = new URL(req.url).searchParams.get("year") || ACADEMIC_YEAR;
    const [{ data: regulation, error: regulationError }, { data: schedules, error: scheduleError }] = await Promise.all([
      db.from("uab_evaluation_regulations").select("academic_year,source_url,uc_codes,checked_at,updated_at").eq("academic_year", year).eq("is_valid", true).maybeSingle(),
      db.from("uab_exam_schedules").select("academic_year,semester,source_url,payload,checked_at,updated_at").eq("academic_year", year).eq("is_valid", true).order("semester", { ascending: true }),
    ]);
    if (regulationError || scheduleError) return jsonResponse({ error: regulationError?.message || scheduleError?.message }, 500);
    return jsonResponse({ regulation: regulation ?? null, schedules: schedules ?? [] });
  }
  const { data: cfg } = await db.from("push_server_config").select("key,value").in("key", ["cron_secret"]), config = Object.fromEntries((cfg ?? []).map((row: any) => [row.key, row.value]));
  if (req.headers.get("x-cron-secret") !== config.cron_secret) return jsonResponse({ error: "Unauthorized" }, 401);
  const result: Record<string, unknown> = { academicYear: ACADEMIC_YEAR };
  try {
    const bytes = await fetchBytes(REGULATION_PDF), digest = await sha256(bytes), pages = await loadPdf(bytes), codes = extractRegulationCodes(pagesToText(pages)), sourceHash = `parser${PARSER_VERSION}:${digest}`;
    const { data: existing } = await db.from("uab_evaluation_regulations").select("source_hash").eq("academic_year", ACADEMIC_YEAR).maybeSingle();
    if (existing?.source_hash === sourceHash) await db.from("uab_evaluation_regulations").update({ checked_at: new Date().toISOString(), last_error: null }).eq("academic_year", ACADEMIC_YEAR);
    else await db.from("uab_evaluation_regulations").upsert({ academic_year: ACADEMIC_YEAR, source_url: REGULATION_PDF, source_hash: sourceHash, uc_codes: codes, is_valid: true, checked_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null });
    result.regulationCodes = codes.length;
  } catch (error) { result.regulationError = error instanceof Error ? error.message : String(error); }
  try {
    const pageResponse = await fetch(EVALUATION_PAGE, { headers: { "user-agent": "AcademicHub/1.0 (+https://portal.uab.pt/)" } }); if (!pageResponse.ok) throw new Error(`A página de avaliação respondeu ${pageResponse.status}.`);
    const links = extractExamLinks(await pageResponse.text()); result.examLinks = links.map((link) => ({ semester: link.semester, href: link.href }));
    for (const link of links) {
      try {
        const bytes = await fetchBytes(link.href), digest = await sha256(bytes), sourceHash = `parser${PARSER_VERSION}:${digest}`;
        const { data: existing } = await db.from("uab_exam_schedules").select("source_hash").eq("academic_year", ACADEMIC_YEAR).eq("semester", link.semester).maybeSingle();
        if (existing?.source_hash === sourceHash) { await db.from("uab_exam_schedules").update({ checked_at: new Date().toISOString(), last_error: null }).eq("academic_year", ACADEMIC_YEAR).eq("semester", link.semester); continue; }
        const entries = parseExamSchedule(await loadPdf(bytes), link.semester);
        await db.from("uab_exam_schedules").upsert({ academic_year: ACADEMIC_YEAR, semester: link.semester, source_url: link.href, source_hash: sourceHash, payload: { academicYear: ACADEMIC_YEAR, semester: link.semester, officialSource: link.href, entries }, is_valid: true, checked_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_error: null });
        result[`semester${link.semester}`] = entries.length;
      } catch (error) { const message = error instanceof Error ? error.message : String(error); result[`semester${link.semester}Error`] = message; await db.from("uab_exam_schedules").update({ checked_at: new Date().toISOString(), last_error: message }).eq("academic_year", ACADEMIC_YEAR).eq("semester", link.semester); }
    }
  } catch (error) { result.examPageError = error instanceof Error ? error.message : String(error); }
  return jsonResponse(result);
} };
