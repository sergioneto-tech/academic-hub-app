import type { AppState, Assessment } from "./types";
import {
  examGrade,
  finalGradeRounded,
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
