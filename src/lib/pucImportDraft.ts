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

export type PucImportDraft = {
  model: EvaluationModel;
  events: PucImportDraftEvent[];
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

  const warnings: string[] = [];
  if (events.some((event) => event.maxPoints === null)) {
    warnings.push("Há atividades cuja cotação não foi identificada com segurança; confirma o valor máximo antes de guardar.");
  }

  return {
    model: result.evaluationModel ?? "custom",
    events,
    warnings,
  };
}
