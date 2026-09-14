import type { Assessment } from "@/lib/types";

export type AssessmentSaveCheck = {
  warnings: string[];
  errors: string[];
};

function dateOnly(value?: string): string {
  return String(value ?? "").slice(0, 10);
}

function isTimedAssessment(assessment: Assessment): boolean {
  return assessment.type === "exam" || assessment.type === "presentation" || assessment.type === "discussion";
}

export function validateAssessmentSave(assessments: Assessment[]): AssessmentSaveCheck {
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const assessment of assessments.filter((item) => item.required !== false)) {
    const label = assessment.name.trim() || "Elemento sem designação";

    if (!assessment.name.trim()) warnings.push("Existe um elemento de avaliação sem designação.");
    if (!(Number(assessment.maxPoints) > 0)) warnings.push(`${label}: falta indicar o valor máximo.`);

    if (isTimedAssessment(assessment)) {
      if (!assessment.date) warnings.push(`${label}: falta a data e hora.`);
      continue;
    }

    if (!assessment.startDate) warnings.push(`${label}: falta a data de início.`);
    if (!assessment.endDate) warnings.push(`${label}: falta a data de fim.`);

    const start = dateOnly(assessment.startDate);
    const end = dateOnly(assessment.endDate);
    if (start && end && end < start) {
      errors.push(`${label}: a data de fim é anterior à data de início.`);
    }

    const gradeRelease = dateOnly(assessment.gradeReleaseDate);
    if (end && gradeRelease && gradeRelease < end) {
      errors.push(`${label}: a publicação da nota está definida antes do fim da atividade.`);
    }
  }

  return { warnings: Array.from(new Set(warnings)), errors: Array.from(new Set(errors)) };
}
