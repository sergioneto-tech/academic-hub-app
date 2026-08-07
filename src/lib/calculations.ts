import type {
  AppState,
  Assessment,
  AssessmentMode,
  AssessmentType,
  Course,
  EvaluationModel,
  Rules,
} from "./types";
import { clamp, formatPtNumber, roundHalfUpInt } from "./utils";

const EPSILON = 0.001;

export function getRules(state: AppState, courseId: string): Rules {
  return (
    state.rules.find((rule) => rule.courseId === courseId) ?? {
      courseId,
      minAptoExame: 3.5,
      minExame: 5.5,
      minimumFinalGrade: 10,
      asyncMinimumPercent: 50,
      syncMinimumPercent: 50,
      nMinusOneMinimumPercent: 40,
    }
  );
}

export function getAssessments(state: AppState, courseId: string, type?: AssessmentType): Assessment[] {
  return state.assessments
    .filter((assessment) => assessment.courseId === courseId && (!type || assessment.type === type))
    .sort((a, b) => {
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, "pt-PT");
    });
}

function getCourse(state: AppState, courseId: string): Course | null {
  return state.courses.find((course) => course.id === courseId) ?? null;
}

function safeMaximum(assessment: Assessment): number {
  return Math.max(0, Number(assessment.maxPoints) || 0);
}

function safeGrade(assessment: Assessment): number {
  if (assessment.grade === null || !Number.isFinite(assessment.grade)) return 0;
  return clamp(assessment.grade, 0, safeMaximum(assessment));
}

function hasGrade(assessment: Assessment): boolean {
  return assessment.grade !== null && Number.isFinite(assessment.grade);
}

function requiredAssessments(state: AppState, courseId: string): Assessment[] {
  return getAssessments(state, courseId)
    .filter((assessment) => assessment.type !== "resit")
    .filter((assessment) => assessment.required !== false);
}

function totalMaximum(assessments: Assessment[]): number {
  return assessments.reduce((total, assessment) => total + safeMaximum(assessment), 0);
}

function totalGrade(assessments: Assessment[]): number {
  return assessments.reduce((total, assessment) => total + safeGrade(assessment), 0);
}

function percentage(grade: number, maximum: number): number {
  return maximum > 0 ? (grade / maximum) * 100 : 0;
}

function approximately(value: number, expected: number): boolean {
  return Math.abs(value - expected) < EPSILON;
}

function modelLabel(model: EvaluationModel): string {
  const labels: Record<EvaluationModel, string> = {
    type1: "Modelo 1",
    type2: "Modelo 2",
    type3: "Modelo 3",
    type4: "Modelo 4",
    "exam-only": "Avaliação final",
    custom: "Modelo personalizado",
  };
  return labels[model];
}

export type RegulationOutcomeKind = "in-progress" | "incomplete" | "passed" | "resit" | "failed";

export type RegulationRequirement = {
  key: string;
  label: string;
  met: boolean;
  detail: string;
};

export type RegulationOutcome = {
  regime: "regulation-2026";
  model: EvaluationModel;
  modelLabel: string;
  source: "assessment" | "resit";
  kind: RegulationOutcomeKind;
  raw: number | null;
  rounded: number | null;
  issues: string[];
  requirements: RegulationRequirement[];
};

function requirement(
  key: string,
  label: string,
  met: boolean,
  detail: string,
): RegulationRequirement {
  return { key, label, met, detail };
}

function evaluateResit(item: Assessment, model: EvaluationModel): RegulationOutcome {
  const maximum = safeMaximum(item);
  const raw = safeGrade(item);
  const rounded = roundHalfUpInt(raw);
  const validScale = approximately(maximum, 20);
  const issues = validScale
    ? []
    : [`O recurso está configurado para ${formatPtNumber(maximum)} pontos, em vez de 20.`];

  return {
    regime: "regulation-2026",
    model,
    modelLabel: modelLabel(model),
    source: "resit",
    kind: issues.length > 0 ? "incomplete" : rounded >= 10 ? "passed" : "failed",
    raw,
    rounded,
    issues,
    requirements: [
      requirement("resit-scale", "Escala do recurso", validScale, `${formatPtNumber(maximum)} / 20 pontos`),
      requirement("resit-final", "Classificação final", rounded >= 10, `${rounded} valores`),
    ],
  };
}

function commonConfiguration(
  assessments: Assessment[],
  minimumFinalGrade: number,
): {
  raw: number;
  rounded: number;
  missing: Assessment[];
  scaleValid: boolean;
  issues: string[];
  requirements: RegulationRequirement[];
} {
  const maximum = totalMaximum(assessments);
  const raw = totalGrade(assessments);
  const rounded = roundHalfUpInt(raw);
  const missing = assessments.filter((assessment) => !hasGrade(assessment));
  const scaleValid = approximately(maximum, 20);
  const issues: string[] = [];

  if (assessments.length === 0) issues.push("Ainda não existem elementos de avaliação obrigatórios configurados.");
  if (missing.length > 0) issues.push(`Faltam as notas de: ${missing.map((item) => item.name).join(", ")}.`);
  if (!scaleValid) issues.push(`A avaliação configurada soma ${formatPtNumber(maximum)} pontos, em vez de 20.`);

  return {
    raw,
    rounded,
    missing,
    scaleValid,
    issues,
    requirements: [
      requirement(
        "required-grades",
        "Elementos obrigatórios classificados",
        assessments.length > 0 && missing.length === 0,
        missing.length === 0 ? "Todos classificados" : `${missing.length} por classificar`,
      ),
      requirement("total-scale", "Escala total", scaleValid, `${formatPtNumber(maximum)} / 20 pontos`),
      requirement("final-grade", "Classificação final", rounded >= minimumFinalGrade, `${rounded} valores`),
    ],
  };
}

function evaluateSplitModel(
  state: AppState,
  courseId: string,
  model: "type1" | "type4",
): RegulationOutcome {
  const rules = getRules(state, courseId);
  const minimumFinalGrade = rules.minimumFinalGrade ?? 10;
  const asyncMinimum = rules.asyncMinimumPercent ?? 50;
  const syncMinimum = rules.syncMinimumPercent ?? 50;
  const assessments = requiredAssessments(state, courseId);
  const common = commonConfiguration(assessments, minimumFinalGrade);
  const asynchronous = assessments.filter((assessment) => assessment.mode === "asynchronous");
  const synchronous = assessments.filter((assessment) => assessment.mode === "synchronous");
  const unspecified = assessments.filter((assessment) => !assessment.mode);
  const asyncMaximum = totalMaximum(asynchronous);
  const syncMaximum = totalMaximum(synchronous);
  const asyncGrade = totalGrade(asynchronous);
  const syncGrade = totalGrade(synchronous);
  const asyncPercent = percentage(asyncGrade, asyncMaximum);
  const syncPercent = percentage(syncGrade, syncMaximum);
  const asyncConfigured = asynchronous.length > 0 && asyncMaximum > 0;
  const syncConfigured = synchronous.length > 0 && syncMaximum > 0;
  const asyncMet = asyncConfigured && asyncPercent + EPSILON >= asyncMinimum;
  const syncMet = syncConfigured && syncPercent + EPSILON >= syncMinimum;
  const issues = [...common.issues];

  if (unspecified.length > 0) {
    issues.push(`Falta indicar se são síncronos ou assíncronos: ${unspecified.map((item) => item.name).join(", ")}.`);
  }
  if (!asyncConfigured) issues.push("Falta configurar pelo menos um elemento assíncrono com cotação.");
  if (!syncConfigured) issues.push("Falta configurar pelo menos um elemento síncrono com cotação.");

  const hasAnyGrade = assessments.some(hasGrade);
  const configurationComplete = issues.length === 0;
  const passed = configurationComplete
    && asyncMet
    && syncMet
    && common.rounded >= minimumFinalGrade;

  return {
    regime: "regulation-2026",
    model,
    modelLabel: modelLabel(model),
    source: "assessment",
    kind: !hasAnyGrade
      ? "in-progress"
      : !configurationComplete
        ? "incomplete"
        : passed
          ? "passed"
          : "resit",
    raw: common.raw,
    rounded: common.rounded,
    issues,
    requirements: [
      ...common.requirements,
      requirement(
        "async-minimum",
        "Componente assíncrona",
        asyncMet,
        asyncConfigured ? `${formatPtNumber(asyncPercent)}% · mínimo ${formatPtNumber(asyncMinimum)}%` : "Não configurada",
      ),
      requirement(
        "sync-minimum",
        "Componente síncrona",
        syncMet,
        syncConfigured ? `${formatPtNumber(syncPercent)}% · mínimo ${formatPtNumber(syncMinimum)}%` : "Não configurada",
      ),
      requirement(
        "assessment-mode",
        "Modalidade dos elementos",
        unspecified.length === 0,
        unspecified.length === 0 ? "Todas definidas" : `${unspecified.length} por definir`,
      ),
    ],
  };
}

function evaluateActivityModel(
  state: AppState,
  courseId: string,
  model: "type2" | "type3",
): RegulationOutcome {
  const rules = getRules(state, courseId);
  const minimumFinalGrade = rules.minimumFinalGrade ?? 10;
  const activityMinimum = rules.nMinusOneMinimumPercent ?? 40;
  const assessments = requiredAssessments(state, courseId);
  const common = commonConfiguration(assessments, minimumFinalGrade);
  const activitiesMeetingMinimum = assessments.filter((assessment) => (
    percentage(safeGrade(assessment), safeMaximum(assessment)) + EPSILON >= activityMinimum
  )).length;
  const requiredCount = Math.max(0, assessments.length - 1);
  const nMinusOneMet = activitiesMeetingMinimum >= requiredCount;
  const hasAnyGrade = assessments.some(hasGrade);
  const configurationComplete = common.issues.length === 0;
  const passed = configurationComplete
    && nMinusOneMet
    && common.rounded >= minimumFinalGrade;

  return {
    regime: "regulation-2026",
    model,
    modelLabel: modelLabel(model),
    source: "assessment",
    kind: !hasAnyGrade
      ? "in-progress"
      : !configurationComplete
        ? "incomplete"
        : passed
          ? "passed"
          : "resit",
    raw: common.raw,
    rounded: common.rounded,
    issues: common.issues,
    requirements: [
      ...common.requirements,
      requirement(
        "n-minus-one",
        "Regra N−1",
        nMinusOneMet,
        `${activitiesMeetingMinimum} de ${assessments.length} atividades com pelo menos ${formatPtNumber(activityMinimum)}%`,
      ),
    ],
  };
}

function evaluateExamOnly(state: AppState, courseId: string): RegulationOutcome {
  const rules = getRules(state, courseId);
  const minimumFinalGrade = rules.minimumFinalGrade ?? 10;
  const examAssessment = getAssessments(state, courseId, "exam")[0] ?? null;

  if (!examAssessment) {
    return {
      regime: "regulation-2026",
      model: "exam-only",
      modelLabel: modelLabel("exam-only"),
      source: "assessment",
      kind: "in-progress",
      raw: null,
      rounded: null,
      issues: ["Falta configurar a prova de avaliação final."],
      requirements: [
        requirement("exam-configured", "Prova final configurada", false, "Não configurada"),
      ],
    };
  }

  const maximum = safeMaximum(examAssessment);
  const validScale = approximately(maximum, 20);
  const graded = hasGrade(examAssessment);
  const raw = graded ? safeGrade(examAssessment) : null;
  const rounded = raw === null ? null : roundHalfUpInt(raw);
  const issues: string[] = [];

  if (!graded) issues.push(`Falta a nota de: ${examAssessment.name}.`);
  if (!validScale) issues.push(`A prova está configurada para ${formatPtNumber(maximum)} pontos, em vez de 20.`);

  return {
    regime: "regulation-2026",
    model: "exam-only",
    modelLabel: modelLabel("exam-only"),
    source: "assessment",
    kind: !graded
      ? "in-progress"
      : issues.length > 0
        ? "incomplete"
        : rounded !== null && rounded >= minimumFinalGrade
          ? "passed"
          : "resit",
    raw,
    rounded,
    issues,
    requirements: [
      requirement("exam-graded", "Prova final classificada", graded, graded ? "Classificada" : "Por classificar"),
      requirement("exam-scale", "Escala da prova", validScale, `${formatPtNumber(maximum)} / 20 pontos`),
      requirement(
        "exam-final",
        "Classificação final",
        rounded !== null && rounded >= minimumFinalGrade,
        rounded === null ? "Sem classificação" : `${rounded} valores`,
      ),
    ],
  };
}

function evaluateCustomModel(state: AppState, courseId: string): RegulationOutcome {
  const rules = getRules(state, courseId);
  const minimumFinalGrade = rules.minimumFinalGrade ?? 10;
  const assessments = requiredAssessments(state, courseId);
  const common = commonConfiguration(assessments, minimumFinalGrade);
  const hasAnyGrade = assessments.some(hasGrade);
  const configurationComplete = common.issues.length === 0;
  const passed = configurationComplete && common.rounded >= minimumFinalGrade;

  return {
    regime: "regulation-2026",
    model: "custom",
    modelLabel: modelLabel("custom"),
    source: "assessment",
    kind: !hasAnyGrade
      ? "in-progress"
      : !configurationComplete
        ? "incomplete"
        : passed
          ? "passed"
          : "resit",
    raw: common.raw,
    rounded: common.rounded,
    issues: common.issues,
    requirements: common.requirements,
  };
}

/**
 * Calcula apenas cadeiras explicitamente configuradas com o regime de 2026.
 * As cadeiras antigas continuam a usar integralmente o motor legado.
 */
export function getRegulationOutcome(state: AppState, courseId: string): RegulationOutcome | null {
  const course = getCourse(state, courseId);
  if (!course || course.evaluationRegime !== "regulation-2026") return null;

  const model = course.evaluationModel ?? "custom";
  const resource = resit(state, courseId);
  if (resource && hasGrade(resource)) return evaluateResit(resource, model);

  if (model === "type1" || model === "type4") return evaluateSplitModel(state, courseId, model);
  if (model === "type2" || model === "type3") return evaluateActivityModel(state, courseId, model);
  if (model === "exam-only") return evaluateExamOnly(state, courseId);
  return evaluateCustomModel(state, courseId);
}

export function totalEFolios(state: AppState, courseId: string): number {
  return getAssessments(state, courseId, "efolio").reduce((total, assessment) => total + safeGrade(assessment), 0);
}

export function totalEFoliosMax(state: AppState, courseId: string): number {
  return getAssessments(state, courseId, "efolio").reduce((total, assessment) => total + safeMaximum(assessment), 0);
}

export function exam(state: AppState, courseId: string): Assessment | null {
  return getAssessments(state, courseId, "exam")[0] ?? null;
}

export function resit(state: AppState, courseId: string): Assessment | null {
  return getAssessments(state, courseId, "resit")[0] ?? null;
}

export function examGrade(state: AppState, courseId: string): number | null {
  return exam(state, courseId)?.grade ?? null;
}

export function resitGrade(state: AppState, courseId: string): number | null {
  return resit(state, courseId)?.grade ?? null;
}

function legacyFinalGradeRaw(state: AppState, courseId: string): number | null {
  const resource = resit(state, courseId);
  if (resource && resource.grade !== null) return safeGrade(resource);

  const examAssessment = exam(state, courseId);
  if (!examAssessment || examAssessment.grade === null) return null;
  return totalEFolios(state, courseId) + safeGrade(examAssessment);
}

/** Nota final bruta, encaminhada para o motor aplicável à cadeira. */
export function finalGradeRaw(state: AppState, courseId: string): number | null {
  const regulation = getRegulationOutcome(state, courseId);
  return regulation ? regulation.raw : legacyFinalGradeRaw(state, courseId);
}

export function finalGradeRounded(state: AppState, courseId: string): number | null {
  const regulation = getRegulationOutcome(state, courseId);
  if (regulation) return regulation.rounded;
  const raw = legacyFinalGradeRaw(state, courseId);
  return raw === null ? null : roundHalfUpInt(raw);
}

export function needsResit(state: AppState, courseId: string): boolean {
  const regulation = getRegulationOutcome(state, courseId);
  if (regulation) return regulation.kind === "resit" || regulation.kind === "failed";

  const resourceGrade = resitGrade(state, courseId);
  if (resourceGrade !== null) {
    const final = finalGradeRounded(state, courseId);
    return final !== null && final < 10;
  }

  const rules = getRules(state, courseId);
  const efolioTotal = totalEFolios(state, courseId);
  const examValue = examGrade(state, courseId);

  if (efolioTotal < rules.minAptoExame) return true;
  if (examValue === null) return false;
  if (examValue < rules.minExame) return true;

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

/** Resultado imediato após registar uma nota de exame ou prova síncrona. */
export function getExamOutcome(state: AppState, courseId: string): AssessmentOutcome | null {
  const course = getCourse(state, courseId);
  const examAssessment = exam(state, courseId);
  if (!examAssessment || examAssessment.grade === null) return null;

  if (course?.evaluationRegime === "regulation-2026") {
    const outcome = getRegulationOutcome(state, courseId);
    if (!outcome || outcome.raw === null || outcome.rounded === null) return null;
    return {
      source: "exam",
      kind: outcome.kind === "passed" ? "passed" : outcome.kind === "incomplete" || outcome.kind === "in-progress" ? "incomplete" : "resit",
      raw: outcome.raw,
      rounded: outcome.rounded,
      issues: outcome.issues,
    };
  }

  const efolios = getAssessments(state, courseId, "efolio");
  const missingGrades = efolios
    .filter((item) => item.maxPoints > 0 && item.grade === null)
    .map((item) => item.name);
  const configuredMax = totalEFoliosMax(state, courseId) + safeMaximum(examAssessment);
  const issues: string[] = [];

  if (missingGrades.length > 0) issues.push(`Faltam as notas de: ${missingGrades.join(", ")}.`);
  if (!approximately(configuredMax, 20)) {
    issues.push(`A avaliação configurada soma ${formatPtNumber(configuredMax)} pontos, em vez de 20.`);
  }

  const efolioTotal = totalEFolios(state, courseId);
  const examValue = safeGrade(examAssessment);
  const raw = efolioTotal + examValue;
  const rounded = roundHalfUpInt(raw);

  if (issues.length > 0) return { source: "exam", kind: "incomplete", raw, rounded, issues };

  const rules = getRules(state, courseId);
  const passed = efolioTotal >= rules.minAptoExame && examValue >= rules.minExame && rounded >= 10;
  return { source: "exam", kind: passed ? "passed" : "resit", raw, rounded, issues: [] };
}

/** Resultado imediato após registar a nota de recurso. */
export function getResitOutcome(state: AppState, courseId: string): AssessmentOutcome | null {
  const item = resit(state, courseId);
  if (!item || item.grade === null) return null;

  const maximum = safeMaximum(item);
  const issues = approximately(maximum, 20)
    ? []
    : [`O recurso está configurado para ${formatPtNumber(maximum)} pontos, em vez de 20.`];
  const raw = safeGrade(item);
  const rounded = roundHalfUpInt(raw);

  if (issues.length > 0) return { source: "resit", kind: "incomplete", raw, rounded, issues };
  return { source: "resit", kind: rounded >= 10 ? "passed" : "failed", raw, rounded, issues: [] };
}

export type CourseStatus = "success" | "warning" | "danger" | "neutral";

function regulationStatus(outcome: RegulationOutcome): { label: string; badge: CourseStatus } {
  if (outcome.kind === "passed") return { label: "Aprovado", badge: "success" };
  if (outcome.kind === "resit") return { label: "Recurso", badge: "danger" };
  if (outcome.kind === "failed") return { label: "Reprovado", badge: "danger" };
  if (outcome.kind === "incomplete") return { label: "Configuração incompleta", badge: "warning" };
  return { label: "Em curso", badge: "neutral" };
}

export function getCourseStatus(state: AppState, courseId: string): { label: string; badge: CourseStatus } {
  const course = getCourse(state, courseId);
  if (!course) return { label: "—", badge: "neutral" };
  if (course.isCompleted) return { label: "Concluída", badge: "success" };

  const regulation = getRegulationOutcome(state, courseId);
  if (regulation) return regulationStatus(regulation);

  const resourceGrade = resitGrade(state, courseId);
  if (resourceGrade !== null) {
    const final = finalGradeRounded(state, courseId);
    return final !== null && final >= 10
      ? { label: "Aprovado", badge: "success" }
      : { label: "Recurso", badge: "danger" };
  }

  const rules = getRules(state, courseId);
  const efolioTotal = totalEFolios(state, courseId);
  const examValue = examGrade(state, courseId);

  if (efolioTotal < rules.minAptoExame) return { label: "Não Apto", badge: "danger" };
  if (examValue === null) return { label: "Apto a Exame", badge: "warning" };
  if (examValue < rules.minExame) return { label: "Recurso", badge: "danger" };

  const final = finalGradeRounded(state, courseId);
  return final !== null && final >= 10
    ? { label: "Aprovado", badge: "success" }
    : { label: "Recurso", badge: "danger" };
}

export function courseStatusLabel(state: AppState, courseId: string): { label: string; badge: CourseStatus } {
  return getCourseStatus(state, courseId);
}

export function calculateMedia(grades: number[]): number {
  if (grades.length === 0) return 0;
  return grades.reduce((total, grade) => total + grade, 0) / grades.length;
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

/** Calcula os ECTS concluídos usando o plano da licenciatura. */
export function totalEctsCompleted(state: AppState, planCourses: { code: string; ects?: number }[]): number {
  const completedCodes = new Set(state.courses.filter((course) => course.isCompleted).map((course) => course.code));
  return planCourses
    .filter((planCourse) => completedCodes.has(planCourse.code))
    .reduce((total, planCourse) => total + (planCourse.ects ?? 6), 0);
}

/** Calcula o total de ECTS da licenciatura. */
export function totalEctsDegree(planCourses: { ects?: number }[]): number {
  return planCourses.reduce((total, planCourse) => total + (planCourse.ects ?? 6), 0);
}

// Compatibilidade: código antigo importava `finalGrade`.
export function finalGrade(state: AppState, courseId: string): number | null {
  return finalGradeRounded(state, courseId);
}
