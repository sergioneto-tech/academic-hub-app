import type { Assessment, AssessmentType } from "./types";

export type AssessmentCalendarEventKind = "start" | "end" | "grade" | "date";

export type AssessmentCalendarEvent = {
  id: string;
  when: string;
  title: string;
  tag: string;
  kind: AssessmentCalendarEventKind;
  timed: boolean;
};

const TYPE_LABELS: Record<AssessmentType, string> = {
  efolio: "e-fólio",
  exam: "Exame",
  resit: "Recurso",
  special: "Época especial",
  activity: "Atividade",
  project: "Projeto",
  presentation: "Apresentação",
  discussion: "Discussão",
  other: "Outro",
};

function localTime(value: string): string {
  if (!value.includes("T")) return "";
  const time = value.slice(11, 16);
  return /^\d{2}:\d{2}$/.test(time) ? time : "";
}

function withTime(label: string, when: string): string {
  const time = localTime(when);
  return time ? `${label} (${time})` : label;
}

export function assessmentTypeLabel(type: AssessmentType): string {
  return TYPE_LABELS[type];
}

export function getAssessmentCalendarEvents(assessment: Assessment): AssessmentCalendarEvent[] {
  const events: AssessmentCalendarEvent[] = [];
  const name = assessment.name.trim() || assessmentTypeLabel(assessment.type);

  if (assessment.startDate) {
    events.push({
      id: `${assessment.id}-start`,
      when: assessment.startDate,
      title: `${name} - Início`,
      tag: withTime("Início", assessment.startDate),
      kind: "start",
      timed: Boolean(localTime(assessment.startDate)),
    });
  }

  if (assessment.endDate) {
    events.push({
      id: `${assessment.id}-end`,
      when: assessment.endDate,
      title: `${name} - Fim`,
      tag: withTime("Entrega", assessment.endDate),
      kind: "end",
      timed: Boolean(localTime(assessment.endDate)),
    });
  }

  if (assessment.gradeReleaseDate) {
    events.push({
      id: `${assessment.id}-grade`,
      when: assessment.gradeReleaseDate,
      title: `${name} - Nota`,
      tag: withTime("Nota", assessment.gradeReleaseDate),
      kind: "grade",
      timed: Boolean(localTime(assessment.gradeReleaseDate)),
    });
  }

  if (assessment.date) {
    const label = assessmentTypeLabel(assessment.type);
    events.push({
      id: `${assessment.id}-date`,
      when: assessment.date,
      title: `${name} (${label})`,
      tag: withTime(label, assessment.date),
      kind: "date",
      timed: Boolean(localTime(assessment.date)),
    });
  }

  return events;
}

export function primaryAssessmentWhen(assessment: Assessment): string {
  return assessment.date ?? assessment.endDate ?? assessment.startDate ?? assessment.gradeReleaseDate ?? "";
}
