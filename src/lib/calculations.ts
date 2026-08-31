import type { AppState, Assessment } from "./types";
import {
  examGrade,
  finalGradeRaw as coreFinalGradeRaw,
  finalGradeRounded as coreFinalGradeRounded,
  getAssessments,
  getCourseStatus as getCoreCourseStatus,
  getRegulationOutcome,
  needsResit as coreNeedsResit,
  resitGrade,
} from "./calculations-core";
import type { RegulationOutcome } from "./calculations-core";

export * from "./calculations-core";

type PublicCourseStatus = "success" | "warning" | "danger" | "neutral" | "info";
type StatusResult = { label: string; badge: PublicCourseStatus };

function hasGrade(assessment: Assessment): boolean {
  return assessment.grade !== null && Number.isFinite(assessment.grade);
}

function configuredLegacyEFolios(state: AppState, courseId: string): Assessment[] {
  return getAssessments(state, courseId, "efolio").filter((assessment) => Number(assessment.maxPoints) > 0);
}

function historicalManualFinalGrade(state: AppState, courseId: string): number | null {
  const course = state.courses.find((item) => item.id === courseId);
  if (!course || course.evaluationRegime !== "legacy" || course.legacyEvaluationMode !== "final-grade-only") return null;
  if (
    typeof course.manualFinalGrade !== "number"
    || !Number.isFinite(course.manualFinalGrade)
    || !Number.isInteger(course.manualFinalGrade)
    || course.manualFinalGrade < 0
    || course.manualFinalGrade > 20
  ) return null;
  return course.manualFinalGrade;
}

export function finalGradeRaw(state: AppState, courseId: string): number | null {
  return historicalManualFinalGrade(state, courseId) ?? coreFinalGradeRaw(state, courseId);
}

export function finalGradeRounded(state: AppState, courseId: string): number | null {
  const historical = historicalManualFinalGrade(state, courseId);
  return historical === null ? coreFinalGradeRounded(state, courseId) : historical;
}

export function finalGrade(state: AppState, courseId: string): number | null {
  return finalGradeRounded(state, courseId);
}

function legacyAssessmentStillInProgress(state: AppState, courseId: string): boolean {
  const efolios = configuredLegacyEFolios(state, courseId);
  const examValue = examGrade(state, courseId);

  // Enquanto existirem e-fólios por classificar, ainda não existe informação
  // suficiente para declarar o aluno "Não Apto".
  if (efolios.some((assessment) => !hasGrade(assessment))) return true;

  // Uma cadeira ativa sem qualquer classificação continua simplesmente em curso.
  return !efolios.some(hasGrade) && examValue === null;
}

function regulationStatus(outcome: RegulationOutcome): StatusResult {
  if (outcome.kind === "passed") return { label: "Aprovado", badge: "success" };
  if (outcome.kind === "resit") return { label: "Recurso", badge: "danger" };
  if (outcome.kind === "failed") return { label: "Reprovado", badge: "danger" };
  if (outcome.kind === "incomplete") return { label: "Configuração incompleta", badge: "warning" };
  return { label: "Em curso", badge: "info" };
}

function historicalFinalGradeStatus(state: AppState, courseId: string): StatusResult | null {
  const course = state.courses.find((item) => item.id === courseId);
  if (!course || course.evaluationRegime !== "legacy" || course.legacyEvaluationMode !== "final-grade-only") return null;

  const final = finalGradeRounded(state, courseId);
  if (final === null) return { label: "Por registar", badge: "neutral" };
  if (final >= 10) return { label: "Aprovado", badge: "success" };
  return { label: "Classificação registada", badge: "warning" };
}

/**
 * Estado académico apresentado na interface.
 *
 * A lógica anterior tratava 0 pontos como uma classificação real e podia mostrar
 * "Não Apto" antes de existir qualquer nota. Nesta camada preservamos os cálculos
 * existentes e só avaliamos aptidão quando já há resultados suficientes.
 */
export function getCourseStatus(state: AppState, courseId: string): StatusResult {
  const course = state.courses.find((item) => item.id === courseId);
  if (!course) return { label: "—", badge: "neutral" };
  if (course.isCompleted) return { label: "Concluída", badge: "success" };

  const historicalStatus = historicalFinalGradeStatus(state, courseId);
  if (historicalStatus) return historicalStatus;

  const regulation = getRegulationOutcome(state, courseId);
  if (regulation) return regulationStatus(regulation);

  if (legacyAssessmentStillInProgress(state, courseId)) {
    return { label: "Em curso", badge: "info" };
  }

  return getCoreCourseStatus(state, courseId) as StatusResult;
}

/** Evita também sinalizar recurso prematuramente enquanto faltam classificações. */
export function needsResit(state: AppState, courseId: string): boolean {
  const course = state.courses.find((item) => item.id === courseId);
  if (!course || course.isCompleted) return false;
  if (course.evaluationRegime === "legacy" && course.legacyEvaluationMode === "final-grade-only") return false;

  const regulation = getRegulationOutcome(state, courseId);
  if (regulation) return regulation.kind === "resit" || regulation.kind === "failed";

  if (resitGrade(state, courseId) !== null) return coreNeedsResit(state, courseId);
  if (legacyAssessmentStillInProgress(state, courseId)) return false;
  return coreNeedsResit(state, courseId);
}

export function courseStatusLabel(state: AppState, courseId: string): StatusResult {
  return getCourseStatus(state, courseId);
}

export function globalStats(state: AppState) {
  const active = state.courses.filter((course) => course.isActive && !course.isCompleted).length;
  const completedCourses = state.courses.filter((course) => course.isCompleted);
  const finals = completedCourses
    .map((course) => finalGradeRounded(state, course.id))
    .filter((grade): grade is number => typeof grade === "number" && Number.isFinite(grade));
  const average = finals.length ? finals.reduce((total, grade) => total + grade, 0) / finals.length : 0;
  const best = finals.length ? Math.max(...finals) : null;
  const activeCourseIds = new Set(state.courses.filter((course) => course.isActive).map((course) => course.id));
  const eventsCount = state.assessments.reduce((total, assessment) => {
    if (!activeCourseIds.has(assessment.courseId)) return total;
    if (assessment.type === "efolio" || assessment.type === "activity" || assessment.type === "project") {
      return total + (assessment.startDate ? 1 : 0) + (assessment.endDate ? 1 : 0);
    }
    return total + (assessment.date ? 1 : 0);
  }, 0);

  return {
    active,
    completed: completedCourses.length,
    avg: Number(average.toFixed(1)),
    best,
    eventsCount,
  };
}
