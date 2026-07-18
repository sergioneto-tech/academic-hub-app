import type { AppState, Assessment, AssessmentType, Rules } from "./types";
import { clamp, formatPtNumber, roundHalfUpInt } from "./utils";

export function getRules(state: AppState, courseId: string): Rules {
  return (
    state.rules.find(r => r.courseId === courseId) ?? {
      courseId,
      minAptoExame: 3.5,
      minExame: 5.5,
    }
  );
}

export function getAssessments(state: AppState, courseId: string, type?: AssessmentType): Assessment[] {
  return state.assessments
    .filter(a => a.courseId === courseId && (!type || a.type === type))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
}

function safeGrade(a: Assessment): number {
  if (a.grade === null || !Number.isFinite(a.grade)) return 0;
  return clamp(a.grade, 0, Number(a.maxPoints) || 0);
}

export function totalEFolios(state: AppState, courseId: string): number {
  const efs = getAssessments(state, courseId, "efolio");
  return efs.reduce((acc, a) => acc + safeGrade(a), 0);
}

export function totalEFoliosMax(state: AppState, courseId: string): number {
  const efs = getAssessments(state, courseId, "efolio");
  return efs.reduce((acc, a) => acc + (Number(a.maxPoints) || 0), 0);
}

export function exam(state: AppState, courseId: string): Assessment | null {
  return getAssessments(state, courseId, "exam")[0] ?? null;
}

export function resit(state: AppState, courseId: string): Assessment | null {
  return getAssessments(state, courseId, "resit")[0] ?? null;
}

export function examGrade(state: AppState, courseId: string): number | null {
  const ex = exam(state, courseId);
  return ex ? ex.grade : null;
}

export function resitGrade(state: AppState, courseId: string): number | null {
  const r = resit(state, courseId);
  return r ? r.grade : null;
}

/**
 * Nota final:
 * - Se houver nota de recurso -> recurso (0..20) (normalmente substitui tudo)
 * - Caso contrário: e-fólios + exame (máx 20)
 */
export function finalGradeRaw(state: AppState, courseId: string): number | null {
  const r = resit(state, courseId);
  if (r && r.grade !== null) return safeGrade(r);

  const ex = exam(state, courseId);
  if (!ex || ex.grade === null) return null;

  return totalEFolios(state, courseId) + safeGrade(ex);
}

export function finalGradeRounded(state: AppState, courseId: string): number | null {
  const raw = finalGradeRaw(state, courseId);
  if (raw === null) return null;
  return roundHalfUpInt(raw);
}

export function needsResit(state: AppState, courseId: string): boolean {
  const resourceGrade = resitGrade(state, courseId);
  if (resourceGrade !== null) {
    const final = finalGradeRounded(state, courseId);
    return final !== null && final < 10;
  }

  const rules = getRules(state, courseId);
  const ef = totalEFolios(state, courseId);
  const ex = examGrade(state, courseId);

  if (ef < rules.minAptoExame) return true;
  if (ex === null) return false; // ainda não fez exame
  if (ex < rules.minExame) return true;

  const final = finalGradeRounded(state, courseId);
  return final !== null && final < 10;
}

export type AssessmentOutcomeKind = "incomplete" | "passed" | "resit" | "failed";

export type AssessmentOutcome = {
  source: "exam" | "resit";
  kind: AssessmentOutcomeKind;
  raw: number;
  rounded: number;
  issues: string[];
};

/**
 * Resultado imediato após registar a nota do exame.
 * Só considera o percurso e-fólios + exame, mesmo que já exista uma nota de recurso.
 */
export function getExamOutcome(state: AppState, courseId: string): AssessmentOutcome | null {
  const ex = exam(state, courseId);
  if (!ex || ex.grade === null) return null;

  const efolios = getAssessments(state, courseId, "efolio");
  const missingGrades = efolios
    .filter((item) => item.maxPoints > 0 && item.grade === null)
    .map((item) => item.name);
  const configuredMax = totalEFoliosMax(state, courseId) + (Number(ex.maxPoints) || 0);
  const issues: string[] = [];

  if (missingGrades.length > 0) {
    issues.push(`Faltam as notas de: ${missingGrades.join(", ")}.`);
  }
  if (Math.abs(configuredMax - 20) >= 0.001) {
    issues.push(`A avaliação configurada soma ${formatPtNumber(configuredMax)} pontos, em vez de 20.`);
  }

  const ef = totalEFolios(state, courseId);
  const examValue = safeGrade(ex);
  const raw = ef + examValue;
  const rounded = roundHalfUpInt(raw);

  if (issues.length > 0) {
    return { source: "exam", kind: "incomplete", raw, rounded, issues };
  }

  const rules = getRules(state, courseId);
  const passed = ef >= rules.minAptoExame && examValue >= rules.minExame && rounded >= 10;

  return {
    source: "exam",
    kind: passed ? "passed" : "resit",
    raw,
    rounded,
    issues: [],
  };
}

/** Resultado imediato após registar a nota de recurso. */
export function getResitOutcome(state: AppState, courseId: string): AssessmentOutcome | null {
  const item = resit(state, courseId);
  if (!item || item.grade === null) return null;

  const configuredMax = Number(item.maxPoints) || 0;
  const issues = Math.abs(configuredMax - 20) >= 0.001
    ? [`O recurso está configurado para ${formatPtNumber(configuredMax)} pontos, em vez de 20.`]
    : [];
  const raw = safeGrade(item);
  const rounded = roundHalfUpInt(raw);

  if (issues.length > 0) {
    return { source: "resit", kind: "incomplete", raw, rounded, issues };
  }

  return {
    source: "resit",
    kind: rounded >= 10 ? "passed" : "failed",
    raw,
    rounded,
    issues: [],
  };
}

export type CourseStatus = "success" | "warning" | "danger" | "neutral";

export function getCourseStatus(state: AppState, courseId: string): { label: string; badge: CourseStatus } {
  const course = state.courses.find(c => c.id === courseId);
  if (!course) return { label: "—", badge: "neutral" };

  if (course.isCompleted) return { label: "Concluída", badge: "success" };

  const resourceGrade = resitGrade(state, courseId);
  if (resourceGrade !== null) {
    const final = finalGradeRounded(state, courseId);
    return final !== null && final >= 10
      ? { label: "Aprovado", badge: "success" }
      : { label: "Recurso", badge: "danger" };
  }

  const rules = getRules(state, courseId);
  const ef = totalEFolios(state, courseId);
  const ex = examGrade(state, courseId);

  if (ef < rules.minAptoExame) return { label: "Não Apto", badge: "danger" };
  if (ex === null) return { label: "Apto a Exame", badge: "warning" };
  if (ex < rules.minExame) return { label: "Recurso", badge: "danger" };

  const fin = finalGradeRounded(state, courseId);
  if (fin !== null && fin >= 10) return { label: "Aprovado", badge: "success" };
  return { label: "Recurso", badge: "danger" };
}

export function courseStatusLabel(state: AppState, courseId: string): { label: string; badge: CourseStatus } {
  return getCourseStatus(state, courseId);
}

export function calculateMedia(notas: number[]): number {
  if (notas.length === 0) return 0;
  return notas.reduce((a, b) => a + b, 0) / notas.length;
}

export function globalStats(state: AppState) {
  const active = state.courses.filter(c => c.isActive && !c.isCompleted).length;
  const completedCourses = state.courses.filter(c => c.isCompleted);

  const finals = completedCourses
    .map(c => finalGradeRounded(state, c.id))
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  const avg = finals.length ? finals.reduce((a, b) => a + b, 0) / finals.length : 0;
  const best = finals.length ? Math.max(...finals) : null;

  // eventos = datas de e-fólios (início+fim) + exame + recurso, só em cadeiras ativas
  const activeCourseIds = new Set(state.courses.filter(c => c.isActive).map(c => c.id));
  const eventsCount = state.assessments.reduce((acc, a) => {
    if (!activeCourseIds.has(a.courseId)) return acc;

    if (a.type === "efolio") {
      return acc + (a.startDate ? 1 : 0) + (a.endDate ? 1 : 0);
    }
    return acc + (a.date ? 1 : 0);
  }, 0);

  return {
    active,
    completed: completedCourses.length,
    avg: Number(avg.toFixed(1)),
    best,
    eventsCount,
  };
}

/** Calculate total ECTS for completed courses using plan data */
export function totalEctsCompleted(state: AppState, planCourses: { code: string; ects?: number }[]): number {
  const completedCodes = new Set(
    state.courses.filter(c => c.isCompleted).map(c => c.code)
  );
  return planCourses
    .filter(pc => completedCodes.has(pc.code))
    .reduce((acc, pc) => acc + (pc.ects ?? 6), 0);
}

/** Calculate total ECTS for the full degree */
export function totalEctsDegree(planCourses: { ects?: number }[]): number {
  return planCourses.reduce((acc, pc) => acc + (pc.ects ?? 6), 0);
}

// Compat: código antigo importava `finalGrade`
export function finalGrade(state: AppState, courseId: string): number | null {
  return finalGradeRounded(state, courseId);
}
