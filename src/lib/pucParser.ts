import type { EvaluationModel } from "./types";

export type PucConfidence = "high" | "medium" | "low";

export type PucDetectedEventKind =
  | "assessment"
  | "exam"
  | "resit"
  | "second-exam-date";

export type PucDetectedEvent = {
  key: string;
  name: string;
  kind: PucDetectedEventKind;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  gradeReleaseDate?: string;
  rawStartDate?: string;
  rawEndDate?: string;
  confidence: PucConfidence;
  notes: string[];
};

export type PucParseResult = {
  courseName: string | null;
  courseCode: string | null;
  academicYear: string | null;
  edition: string | null;
  evaluationModel: EvaluationModel | null;
  events: PucDetectedEvent[];
  warnings: string[];
  /** Segurança funcional: a importação nunca deve gravar sem confirmação do aluno. */
  requiresUserConfirmation: true;
};

type AcademicYearParts = {
  startYear: number;
  endYear: number;
};

type DateCandidate = {
  raw: string;
  date?: string;
  time?: string;
};

const MONTHS: Record<string, number> = {
  janeiro: 1,
  jan: 1,
  fevereiro: 2,
  fev: 2,
  marco: 3,
  março: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  maio: 5,
  mai: 5,
  junho: 6,
  jun: 6,
  julho: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  setembro: 9,
  set: 9,
  outubro: 10,
  out: 10,
  novembro: 11,
  nov: 11,
  dezembro: 12,
  dez: 12,
};

const MONTH_PATTERN =
  "janeiro|jan|fevereiro|fev|março|marco|mar|abril|abr|maio|mai|junho|jun|julho|jul|agosto|ago|setembro|set|outubro|out|novembro|nov|dezembro|dez";

function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2010-\u2015\u2212\u00ad]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/￾/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function normalizeSearch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-PT");
}

function parseAcademicYear(value: string | null): AcademicYearParts | null {
  if (!value) return null;
  const match = value.match(/(20\d{2})\s*[\/-]\s*(\d{2,4})/);
  if (!match) return null;

  const startYear = Number(match[1]);
  const rawEnd = Number(match[2]);
  const endYear = rawEnd < 100 ? Math.floor(startYear / 100) * 100 + rawEnd : rawEnd;

  if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear < startYear) {
    return null;
  }

  return { startYear, endYear };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function resolveYearForMonth(month: number, academicYear: AcademicYearParts | null): number | null {
  if (!academicYear) return null;
  return month >= 9 ? academicYear.startYear : academicYear.endYear;
}

function toIsoDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseDateExpression(rawValue: string, academicYear: AcademicYearParts | null): DateCandidate {
  const raw = rawValue.trim();
  const normalized = normalizeSearch(raw);

  const numeric = normalized.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year: number | null = numeric[3] ? Number(numeric[3]) : resolveYearForMonth(month, academicYear);
    if (year !== null && year < 100) year += 2000;

    const timeMatch = normalized.match(/(?:as|a)\s*(\d{1,2})(?:(?::|\.|h)(\d{2}))?\s*(?:h|horas?)?/);
    const time = timeMatch ? `${pad2(Number(timeMatch[1]))}:${pad2(Number(timeMatch[2] ?? 0))}` : undefined;

    return {
      raw,
      date: year ? toIsoDate(year, month, day) : undefined,
      time,
    };
  }

  const named = normalized.match(
    new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MONTH_PATTERN})(?:\\s+de\\s+(20\\d{2}))?\\b`, "i"),
  );
  if (named) {
    const day = Number(named[1]);
    const month = MONTHS[named[2]];
    const explicitYear = named[3] ? Number(named[3]) : null;
    const year = explicitYear ?? resolveYearForMonth(month, academicYear);
    return {
      raw,
      date: year ? toIsoDate(year, month, day) : undefined,
    };
  }

  return { raw };
}

function collectDateCandidates(text: string, academicYear: AcademicYearParts | null): DateCandidate[] {
  const dateRegex = new RegExp(
    `\\b(?:\\d{1,2}[\\/-]\\d{1,2}(?:[\\/-]\\d{2,4})?|\\d{1,2}\\s+de\\s+(?:${MONTH_PATTERN})(?:\\s+de\\s+20\\d{2})?)(?:\\s*(?:às|as|a)\\s*\\d{1,2}(?:(?::|\\.|h)\\d{2})?\\s*(?:h|horas?)?)?`,
    "giu",
  );

  return Array.from(text.matchAll(dateRegex)).map((match) => parseDateExpression(match[0], academicYear));
}

function extractCourseCode(text: string): string | null {
  const patterns = [
    /Código da Unidade Curricular\s*\(UC\)\s*:\s*(\d{5})/i,
    /UNIDADE CURRICULAR\s+(\d{5})\b/i,
    /\b(\d{5})\s*-\s*[^\n]+/i,
    /[^\n]+\s*-\s*(\d{5})\b/i,
    /^\s*(\d{5})\s*$/m,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function cleanupCourseName(value: string): string {
  return value
    .replace(/\s+20\d{2}\s+\d{2}\s*$/, "")
    .replace(/^\d{5}\s*-\s*/, "")
    .replace(/\s*-\s*\d{5}\s*$/, "")
    .replace(/\s*-\s*Espaço Central\s*$/i, "")
    .trim();
}

function extractCourseName(text: string, courseCode: string | null): string | null {
  if (courseCode) {
    const codeFirst = text.match(new RegExp(`^\\s*${courseCode}\\s*-\\s*([^\\n]+)$`, "mi"));
    if (codeFirst) return cleanupCourseName(codeFirst[1]);

    const nameFirst = text.match(new RegExp(`^\\s*([^\\n]+?)\\s*-\\s*${courseCode}\\s*$`, "mi"));
    if (nameFirst) return cleanupCourseName(nameFirst[1]);
  }

  const labelled = text.match(/Unidade\s+curricular\s*:\s*([^\n]+)/i);
  if (labelled) {
    const candidate = cleanupCourseName(labelled[1]);
    if (candidate && !/^\d{5}$/.test(candidate)) return candidate;
  }

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const codeLineIndex = lines.findIndex((line) => /^\d{5}$/.test(line));
  if (codeLineIndex > 0) {
    const previous = lines[codeLineIndex - 1];
    if (previous.length > 2 && previous.length < 120) return cleanupCourseName(previous);
  }

  return null;
}

function extractAcademicYear(text: string): string | null {
  const match = text.match(/Ano\s+(?:letivo|lectivo)\s*:\s*(20\d{2})\s*[\/-]\s*(\d{2,4})/i);
  if (!match) return null;

  const startYear = Number(match[1]);
  const rawEnd = Number(match[2]);
  const endYear = rawEnd < 100 ? Math.floor(startYear / 100) * 100 + rawEnd : rawEnd;
  return `${startYear}/${endYear}`;
}

function extractEdition(text: string): string | null {
  const match = text.match(/Unidade\s+curricular\s*:\s*[^\n]*?\b20\d{2}\s+(\d{2})\s*$/im);
  return match?.[1] ?? null;
}

function extractEvaluationModel(text: string): EvaluationModel | null {
  const normalized = normalizeSearch(text);
  const match = normalized.match(/tipologia\s*([1-4])\b/);
  return match ? (`type${match[1]}` as EvaluationModel) : null;
}

function getEvaluationCalendarSection(text: string): string {
  const normalized = normalizeSearch(text);
  const markers = [
    "calendarizacao",
    "calendario da avaliacao sumativa continua",
    "calendario de avaliacao continua",
  ];

  let index = -1;
  for (const marker of markers) {
    index = Math.max(index, normalized.lastIndexOf(marker));
  }

  if (index < 0) return text;
  return text.slice(index, Math.min(text.length, index + 9000));
}

function pushUniqueEvent(events: PucDetectedEvent[], event: PucDetectedEvent): void {
  const duplicate = events.some(
    (candidate) =>
      candidate.name === event.name &&
      candidate.startDate === event.startDate &&
      candidate.endDate === event.endDate &&
      candidate.rawStartDate === event.rawStartDate,
  );
  if (!duplicate) events.push(event);
}

function parseSumativeRows(
  section: string,
  academicYear: AcademicYearParts | null,
): PucDetectedEvent[] {
  const events: PucDetectedEvent[] = [];
  const headerEnd = normalizeSearch(section).indexOf("cotacao");
  if (headerEnd < 0) return events;

  const header = section.slice(0, headerEnd);
  const names = Array.from(header.matchAll(/Atividade Sumativa\s+(\d+)/gi)).map(
    (match) => `Atividade Sumativa ${match[1]}`,
  );
  const uniqueNames = Array.from(new Set(names));

  if (/Atividade de Avaliação por Exame/i.test(header)) {
    uniqueNames.push("Atividade de Avaliação por Exame");
  }

  if (uniqueNames.length === 0) return events;

  const normalized = normalizeSearch(section);
  const availabilityIndex = normalized.indexOf("disponibilizacao do enunciado");
  const deadlineIndex = normalized.indexOf("data e hora limites de entrega");
  const feedbackIndex = normalized.indexOf("disponibilizacao da classificacao");

  const availabilityText =
    availabilityIndex >= 0 && deadlineIndex > availabilityIndex
      ? section.slice(availabilityIndex, deadlineIndex)
      : "";
  const deadlineText =
    deadlineIndex >= 0 && feedbackIndex > deadlineIndex
      ? section.slice(deadlineIndex, feedbackIndex)
      : "";
  const feedbackText = feedbackIndex >= 0 ? section.slice(feedbackIndex, feedbackIndex + 1000) : "";

  const availabilityDates = collectDateCandidates(availabilityText, academicYear);
  const deadlineDates = collectDateCandidates(deadlineText, academicYear);
  const feedbackDates = collectDateCandidates(feedbackText, academicYear);

  uniqueNames.forEach((name, index) => {
    const available = availabilityDates[index];
    const deadline = deadlineDates[index];
    const feedback = feedbackDates[index];
    if (!available && !deadline && !feedback) return;

    events.push({
      key: `sumative-${index + 1}`,
      name,
      kind: name.includes("Exame") ? "exam" : "assessment",
      startDate: available?.date,
      startTime: available?.time,
      endDate: deadline?.date,
      endTime: deadline?.time,
      gradeReleaseDate: feedback?.date,
      rawStartDate: available?.raw,
      rawEndDate: deadline?.raw,
      confidence: available?.date || deadline?.date ? "high" : "medium",
      notes: [],
    });
  });

  return events;
}

function findLabelIndex(text: string, label: "A" | "B"): number {
  const regex = new RegExp(`e-?f[oó]lio\\s+${label}\\b`, "i");
  return text.search(regex);
}

function inferMonthNearEfolio(text: string, label: "A" | "B"): number | null {
  const normalized = normalizeSearch(text);
  const planMarker = normalized.indexOf("7. plano de trabalho");
  const workPlan = planMarker >= 0 ? normalized.slice(planMarker) : normalized;
  const labelPattern = `e-?folio\\s+${label.toLocaleLowerCase("pt-PT")}`;
  const after = workPlan.match(
    new RegExp(`${labelPattern}[\\s\\S]{0,180}?(?:dia\\s+)?\\d{1,2}\\s+de\\s+(${MONTH_PATTERN})`, "i"),
  );
  if (after?.[1]) return MONTHS[after[1]] ?? null;

  const before = workPlan.match(
    new RegExp(`\\d{1,2}\\s+de\\s+(${MONTH_PATTERN})[\\s\\S]{0,180}?${labelPattern}`, "i"),
  );
  return before?.[1] ? MONTHS[before[1]] ?? null : null;
}

function parseBareDay(day: number, month: number, academicYear: AcademicYearParts | null): string | undefined {
  const year = resolveYearForMonth(month, academicYear);
  return year ? toIsoDate(year, month, day) : undefined;
}

function findEfolioBlockEnd(section: string, start: number, label: "A" | "B"): number {
  if (label === "A") {
    const nextLabel = findLabelIndex(section.slice(start + 1), "B");
    if (nextLabel >= 0) return start + 1 + nextLabel;
  }

  const tail = section.slice(start + 1);
  const normalizedTail = normalizeSearch(tail);
  const stopMarkers = [
    "e-folio global",
    "6.3. exame",
    "7. plano de trabalho",
    "cartao de aprendizagem",
  ];
  const offsets = stopMarkers
    .map((marker) => normalizedTail.indexOf(marker))
    .filter((offset) => offset >= 0);

  if (offsets.length > 0) {
    return start + 1 + Math.min(...offsets);
  }

  return Math.min(section.length, start + 1400);
}

function parseEfolioBlock(
  text: string,
  section: string,
  label: "A" | "B",
  academicYear: AcademicYearParts | null,
): PucDetectedEvent | null {
  const start = findLabelIndex(section, label);
  if (start < 0) return null;

  const end = findEfolioBlockEnd(section, start, label);
  const block = section.slice(start, end);
  const candidates = collectDateCandidates(block, academicYear);

  if (candidates.length >= 2) {
    return {
      key: `efolio-${label.toLocaleLowerCase("pt-PT")}`,
      name: `E-fólio ${label}`,
      kind: "assessment",
      startDate: candidates[0].date,
      startTime: candidates[0].time,
      endDate: candidates[1].date,
      endTime: candidates[1].time,
      gradeReleaseDate: candidates[2]?.date,
      rawStartDate: candidates[0].raw,
      rawEndDate: candidates[1].raw,
      confidence: candidates[0].date && candidates[1].date ? "high" : "medium",
      notes: [],
    };
  }

  const specificationDay = block.match(/Data da especificação[\s\S]{0,320}?(?:Data\s*:\s*)?(\d{1,2})\b/i)?.[1];
  const deliveryDay = block.match(/Envio[^\n\d]{0,120}(?:do\s+E-fólio\s+[AB][^\n\d]{0,80})?(?:Data\s*:\s*)?(\d{1,2})\b/i)?.[1];
  const inferredMonth = inferMonthNearEfolio(text, label);

  if (specificationDay && deliveryDay && inferredMonth) {
    const startDate = parseBareDay(Number(specificationDay), inferredMonth, academicYear);
    const endDate = parseBareDay(Number(deliveryDay), inferredMonth, academicYear);
    return {
      key: `efolio-${label.toLocaleLowerCase("pt-PT")}`,
      name: `E-fólio ${label}`,
      kind: "assessment",
      startDate,
      endDate,
      rawStartDate: specificationDay,
      rawEndDate: deliveryDay,
      confidence: startDate && endDate ? "medium" : "low",
      notes: ["Mês associado por contexto do plano de trabalho; requer confirmação do aluno."],
    };
  }

  return null;
}

function parseExplicitExamDates(
  text: string,
  academicYear: AcademicYearParts | null,
): PucDetectedEvent[] {
  const events: PucDetectedEvent[] = [];

  const normalMatch = text.match(/Época\s+Normal\s*:\s*([^\n]+)/i);
  if (normalMatch) {
    const candidate = collectDateCandidates(normalMatch[1], academicYear)[0];
    if (candidate) {
      events.push({
        key: "exam-normal",
        name: "Prova final — Época Normal",
        kind: "exam",
        startDate: candidate.date,
        startTime: candidate.time,
        rawStartDate: candidate.raw,
        confidence: candidate.date ? "high" : "medium",
        notes: [],
      });
    }
  }

  const resitMatch = text.match(/Época\s+(?:de\s+)?Recurso\s*:\s*([^\n]+)/i);
  if (resitMatch) {
    const candidate = collectDateCandidates(resitMatch[1], academicYear)[0];
    if (candidate) {
      events.push({
        key: "exam-resit",
        name: "Prova final — Época de Recurso",
        kind: "resit",
        startDate: candidate.date,
        startTime: candidate.time,
        rawStartDate: candidate.raw,
        confidence: candidate.date ? "high" : "medium",
        notes: [],
      });
    }
  }

  return events;
}

function parseGlobalExamCalendar(
  section: string,
  academicYear: AcademicYearParts | null,
): PucDetectedEvent[] {
  const normalized = normalizeSearch(section);
  const globalIndex = Math.max(normalized.indexOf("e-folio global"), normalized.indexOf("e-fólio global"));
  if (globalIndex < 0) return [];

  const block = section.slice(globalIndex, globalIndex + 1200);
  const candidates = collectDateCandidates(block, academicYear).filter((candidate) => candidate.date);
  if (candidates.length === 0) return [];

  const events: PucDetectedEvent[] = [
    {
      key: "global-exam",
      name: "E-fólio Global / Exame",
      kind: "exam",
      startDate: candidates[0].date,
      startTime: candidates[0].time,
      rawStartDate: candidates[0].raw,
      confidence: "high",
      notes: [],
    },
  ];

  if (candidates[1]?.date && candidates[1].date !== candidates[0].date) {
    events.push({
      key: "global-exam-second-date",
      name: "Segunda data de prova encontrada no PUC",
      kind: "second-exam-date",
      startDate: candidates[1].date,
      startTime: candidates[1].time,
      rawStartDate: candidates[1].raw,
      confidence: "medium",
      notes: ["A modalidade desta segunda data deve ser confirmada antes de guardar."],
    });
  }

  return events;
}

function parseApproximatePlanEfolios(
  text: string,
  academicYear: AcademicYearParts | null,
): PucDetectedEvent[] {
  const events: PucDetectedEvent[] = [];
  const normalized = normalizeSearch(text);

  for (const label of ["A", "B"] as const) {
    const regex = new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+e-?folio\\s+${label.toLocaleLowerCase("pt-PT")}\\b`, "i");
    const match = normalized.match(regex);
    if (!match) continue;

    const day = Number(match[1]);
    const month = MONTHS[match[2]];
    const date = parseBareDay(day, month, academicYear);
    events.push({
      key: `efolio-${label.toLocaleLowerCase("pt-PT")}-approx`,
      name: `E-fólio ${label}`,
      kind: "assessment",
      startDate: date,
      rawStartDate: `${match[1]} ${match[2]}`,
      confidence: date ? "medium" : "low",
      notes: [
        date
          ? "Data identificada no plano de trabalho; confirmar se corresponde ao início ou ao prazo final."
          : "Data identificada sem ano letivo explícito; não foi normalizada automaticamente.",
      ],
    });
  }

  return events;
}

export function parsePucText(input: string): PucParseResult {
  const text = normalizeText(input);
  const courseCode = extractCourseCode(text);
  const courseName = extractCourseName(text, courseCode);
  const academicYear = extractAcademicYear(text);
  const academicYearParts = parseAcademicYear(academicYear);
  const edition = extractEdition(text);
  const evaluationModel = extractEvaluationModel(text);
  const calendarSection = getEvaluationCalendarSection(text);
  const events: PucDetectedEvent[] = [];

  for (const event of parseSumativeRows(calendarSection, academicYearParts)) {
    pushUniqueEvent(events, event);
  }

  for (const label of ["A", "B"] as const) {
    const event = parseEfolioBlock(text, calendarSection, label, academicYearParts);
    if (event) pushUniqueEvent(events, event);
  }

  for (const event of parseExplicitExamDates(text, academicYearParts)) {
    pushUniqueEvent(events, event);
  }

  for (const event of parseGlobalExamCalendar(calendarSection, academicYearParts)) {
    pushUniqueEvent(events, event);
  }

  for (const event of parseApproximatePlanEfolios(text, academicYearParts)) {
    if (!events.some((candidate) => candidate.name === event.name)) {
      pushUniqueEvent(events, event);
    }
  }

  const warnings: string[] = [];
  if (!courseName) warnings.push("Nome da unidade curricular não identificado com segurança.");
  if (!courseCode) warnings.push("Código numérico da unidade curricular não identificado no PUC.");
  if (!academicYear) warnings.push("Ano letivo não identificado; datas sem ano não serão completadas automaticamente.");
  if (!evaluationModel) warnings.push("Tipologia 1–4 não indicada explicitamente no PUC; não será inferida.");

  const normalized = normalizeSearch(text);
  if (normalized.includes("consultar") && normalized.includes("calendario") && normalized.includes("provas")) {
    warnings.push("O PUC remete pelo menos uma prova para o calendário oficial; essa data deve ser confirmada externamente.");
  }

  if (events.length === 0) {
    warnings.push("Nenhuma data de avaliação suficientemente estruturada foi identificada.");
  }

  if (events.some((event) => !event.startDate && !event.endDate)) {
    warnings.push("Existem eventos encontrados sem data ISO segura; permanecem apenas para revisão manual.");
  }

  return {
    courseName,
    courseCode,
    academicYear,
    edition,
    evaluationModel,
    events,
    warnings,
    requiresUserConfirmation: true,
  };
}
