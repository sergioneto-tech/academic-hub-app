import type { EvaluationModel } from "./types";
import type { PucParseResult } from "./pucParser";

export type PucImportDraftEvent = {
  key: string;
  name: string;
  maxPoints: number | null;
  startDate: string;
  endDate: string;
  gradeReleaseDate: string;
};

export type PucImportDraftFinalAssessment = {
  name: string;
  maxPoints: number | null;
};

export type PucImportDraft = {
  model: EvaluationModel;
  events: PucImportDraftEvent[];
  finalAssessment: PucImportDraftFinalAssessment | null;
  warnings: string[];
};

function normalizeSearch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-PT")
    .replace(/\u00a0/g, " ");
}

function parsePoints(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getEvaluationSection(text: string): string {
  const normalized = normalizeSearch(text);
  const markers = [
    "calendarizacao",
    "calendario da avaliacao sumativa continua",
    "calendario de avaliacao continua",
  ];

  let index = -1;
  for (const marker of markers) index = Math.max(index, normalized.lastIndexOf(marker));
  return index >= 0 ? text.slice(index, Math.min(text.length, index + 10000)) : text;
}

function getSumativePoints(text: string): number[] {
  const section = getEvaluationSection(text);
  const normalized = normalizeSearch(section);
  const cotationIndex = normalized.indexOf("cotacao");
  if (cotationIndex < 0) return [];

  const afterCotation = section.slice(cotationIndex);
  const normalizedAfter = normalizeSearch(afterCotation);
  const stopCandidates = [
    normalizedAfter.indexOf("disponibilizacao do enunciado"),
    normalizedAfter.indexOf("data e hora limites"),
  ].filter((index) => index > 0);
  const stop = stopCandidates.length > 0 ? Math.min(...stopCandidates) : Math.min(afterCotation.length, 700);
  const row = afterCotation.slice(0, stop);

  return Array.from(row.matchAll(/(\d+(?:[.,]\d+)?)\s*valores?\b/gi))
    .map((match) => parsePoints(match[1]))
    .filter((value): value is number => value !== null);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getEfolioPoints(text: string, label: string): number | null {
  const pattern = new RegExp(
    `e-?f[oó]lio\\s+${escapeRegex(label)}[^\\n]{0,120}?(\\d+(?:[.,]\\d+)?)\\s*valores?\\b`,
    "i",
  );
  return parsePoints(text.match(pattern)?.[1]);
}

function pointsForEvent(text: string, eventKey: string, eventName: string): number | null {
  const sumativeMatch = eventKey.match(/^sumative-(\d+)$/);
  if (sumativeMatch) {
    const points = getSumativePoints(text);
    return points[Number(sumativeMatch[1]) - 1] ?? null;
  }

  const efolioMatch = eventName.match(/^E-f[oó]lio\s+(.+)$/i);
  if (efolioMatch) return getEfolioPoints(text, efolioMatch[1].trim());

  return null;
}

function directFinalAssessment(text: string): PucImportDraftFinalAssessment | null {
  const patterns: Array<{ name: string; regex: RegExp }> = [
    {
      name: "E-fólio Global",
      regex: /e-?f[oó]lio\s+global[^\n]{0,100}?(\d+(?:[.,]\d+)?)\s*valores?\b/i,
    },
    {
      name: "G-fólio",
      regex: /g-?f[oó]lio[^\n]{0,100}?(\d+(?:[.,]\d+)?)\s*valores?\b/i,
    },
    {
      name: "Prova final / exame",
      regex: /(?:prova\s+final|exame\s+final)[^\n]{0,100}?(\d+(?:[.,]\d+)?)\s*valores?\b/i,
    },
  ];

  for (const candidate of patterns) {
    const match = text.match(candidate.regex);
    if (match) return { name: candidate.name, maxPoints: parsePoints(match[1]) };
  }

  return null;
}

function findFinalAssessment(
  result: PucParseResult,
  rawText: string,
  assessmentCount: number,
): PucImportDraftFinalAssessment | null {
  const direct = directFinalAssessment(rawText);
  if (direct) return direct;

  const examEvent = result.events.find((event) => event.kind === "exam");
  if (examEvent) {
    return {
      name: examEvent.name,
      maxPoints: pointsForEvent(rawText, examEvent.key, examEvent.name),
    };
  }

  const rowPoints = getSumativePoints(rawText);
  if (rowPoints.length > assessmentCount) {
    return {
      name: "Prova / exame final",
      maxPoints: rowPoints[assessmentCount] ?? null,
    };
  }

  if (result.evaluationModel === "exam-only") {
    const match = rawText.match(/\bexame\b[^\n]{0,100}?(\d+(?:[.,]\d+)?)\s*valores?\b/i);
    return {
      name: "Exame",
      maxPoints: parsePoints(match?.[1]),
    };
  }

  return null;
}

function hasIgnoredOfficialExamDate(result: PucParseResult): boolean {
  return result.events.some((event) => (
    event.kind === "exam"
    || event.kind === "resit"
    || event.kind === "second-exam-date"
  ) && Boolean(
    event.startDate
    || event.endDate
    || event.startTime
    || event.endTime
    || event.gradeReleaseDate,
  ));
}

export function buildPucImportDraft(result: PucParseResult, rawText: string): PucImportDraft {
  const events = result.events
    .filter((event) => event.kind === "assessment")
    .map((event) => ({
      key: event.key,
      name: event.name,
      maxPoints: pointsForEvent(rawText, event.key, event.name),
      startDate: event.startDate ?? "",
      endDate: event.endDate ?? "",
      gradeReleaseDate: event.gradeReleaseDate ?? "",
    }));

  const finalAssessment = findFinalAssessment(result, rawText, events.length);
  const warnings: string[] = [];

  if (hasIgnoredOfficialExamDate(result)) {
    warnings.push("Foram detetadas datas ou horas de exame/recurso no PUC, mas foram ignoradas. O Academic Hub continua a usar exclusivamente o calendário oficial para essas provas; do PUC entra apenas a cotação confirmada.");
  }

  if (events.some((event) => event.maxPoints === null)) {
    warnings.push("Há atividades cuja cotação não foi identificada com segurança; confirma o valor máximo antes de guardar.");
  }

  if (finalAssessment && finalAssessment.maxPoints === null) {
    warnings.push("A prova final foi identificada, mas a respetiva cotação não foi encontrada com segurança; confirma o valor máximo antes de guardar.");
  }

  const allPoints = [
    ...events.map((event) => event.maxPoints),
    finalAssessment?.maxPoints ?? null,
  ];
  if (finalAssessment && allPoints.every((value): value is number => value !== null)) {
    const total = allPoints.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 20) > 0.001) {
      warnings.push(`As cotações detetadas totalizam ${total} valores em vez de 20; confirma a estrutura do PUC antes de guardar.`);
    }
  }

  return {
    model: result.evaluationModel ?? "custom",
    events,
    finalAssessment,
    warnings,
  };
}
