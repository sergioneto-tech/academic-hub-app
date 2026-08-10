import type {
  AppState,
  Assessment,
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
    .filter((assessment) => assessment.type !== "resit" && assessment.type !== "special")
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

function between(value: number, minimum: number, maximum: number): boolean {
  return value + EPSILON >= minimum && value - EPSILON <= maximum;
}

function modelLabel(model: EvaluationModel): string {
  const labels: Record<EvaluationModel, string> = {
    type1: "Tipologia 1",
    type2: "Tipologia 2",
    type3: "Tipologia 3",
    type4: "Tipologia 4",
    "exam-only": "Avaliação por exame",
    custom: "Tipologia por definir no PUC",
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

export type RegulationResitPlan = {
  kind: "repeat-synchronous" | "final-20";
  maxPoints: number;
  label: string;
  description: string;
};

function requirement(key: string, label: string, met: boolean, detail: string): RegulationRequirement {
  return { key, label, met, detail };
}

function commonConfiguration(assessments: Assessment[], minimumFinalGrade: number) {
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

function splitSnapshot(state: AppState, courseId: string, model: "type1" | "type4") {
  const rules = getRules(state, courseId);
  const assessments = requiredAssessments(state, courseId);
  const asynchronous = assessments.filter((assessment) => assessment.mode === "asynchronous");
  const synchronous = assessments.filter((assessment) => assessment.mode === "synchronous");
  const unspecified = assessments.filter((assessment) => !assessment.mode);
  const asyncMaximum = totalMaximum(asynchronous);
  const syncMaximum = totalMaximum(synchronous);
  const asyncGrade = totalGrade(asynchronous);
  const syncGrade = totalGrade(synchronous);
  const asyncPercent = percentage(asyncGrade, asyncMaximum);
  const syncPercent = percentage(syncGrade, syncMaximum);
  const asyncMinimum = rules.asyncMinimumPercent ?? 50;
  const syncMinimum = rules.syncMinimumPercent ?? 50;
  const expectedAsyncCount = model === "type4" ? { min: 1, max: 1 } : { min: 2, max: 3 };
  const asyncCountValid = asynchronous.length >= expectedAsyncCount.min && asynchronous.length <= expectedAsyncCount.max;
  const syncCountValid = synchronous.length === 1;
  const asyncWeightValid = between(asyncMaximum, 6, 8);
  const syncWeightValid = between(syncMaximum, 12, 14);
  const asyncMet = asyncMaximum > 0 && asyncPercent + EPSILON >= asyncMinimum;
  const syncMet = syncMaximum > 0 && syncPercent + EPSILON >= syncMinimum;

  return {
    rules,
    assessments,
    asynchronous,
    synchronous,
    unspecified,
    asyncMaximum,
    syncMaximum,
    asyncGrade,
    syncGrade,
    asyncPercent,
    syncPercent,
    asyncMinimum,
    syncMinimum,
    asyncCountValid,
    syncCountValid,
    asyncWeightValid,
    syncWeightValid,
    asyncMet,
    syncMet,
  };
}

function evaluateSplitModel(state: AppState, courseId: string, model: "type1" | "type4"): RegulationOutcome {
  const snapshot = splitSnapshot(state, courseId, model);
  const minimumFinalGrade = snapshot.rules.minimumFinalGrade ?? 10;
  const common = commonConfiguration(snapshot.assessments, minimumFinalGrade);
  const issues = [...common.issues];

  if (snapshot.unspecified.length > 0) {
    issues.push(`Falta indicar se são síncronos ou assíncronos: ${snapshot.unspecified.map((item) => item.name).join(", ")}.`);
  }
  if (!snapshot.asyncCountValid) {
    issues.push(model === "type4"
      ? "A Tipologia 4 exige exatamente 1 elemento assíncrono."
      : "A Tipologia 1 exige 2 ou 3 elementos assíncronos.");
  }
  if (!snapshot.syncCountValid) issues.push("Esta tipologia exige exatamente 1 elemento síncrono.");
  if (!snapshot.asyncWeightValid) issues.push("A componente assíncrona deve valer, no total, entre 6 e 8 valores.");
  if (!snapshot.syncWeightValid) issues.push("A componente síncrona deve valer entre 12 e 14 valores.");

  const hasAnyGrade = snapshot.assessments.some(hasGrade);
  const configurationComplete = issues.length === 0;
  const passed = configurationComplete
    && snapshot.asyncMet
    && snapshot.syncMet
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
        "async-count",
        "Elementos assíncronos",
        snapshot.asyncCountValid,
        model === "type4" ? `${snapshot.asynchronous.length} · exigido 1` : `${snapshot.asynchronous.length} · exigidos 2 a 3`,
      ),
      requirement(
        "async-weight",
        "Cotação assíncrona",
        snapshot.asyncWeightValid,
        `${formatPtNumber(snapshot.asyncMaximum)} / 20 · exigidos 6 a 8`,
      ),
      requirement(
        "sync-count",
        "Elemento síncrono",
        snapshot.syncCountValid,
        `${snapshot.synchronous.length} · exigido 1`,
      ),
      requirement(
        "sync-weight",
        "Cotação síncrona",
        snapshot.syncWeightValid,
        `${formatPtNumber(snapshot.syncMaximum)} / 20 · exigidos 12 a 14`,
      ),
      requirement(
        "async-minimum",
        "Mínimo na componente assíncrona",
        snapshot.asyncMet,
        `${formatPtNumber(snapshot.asyncPercent)}% · mínimo ${formatPtNumber(snapshot.asyncMinimum)}%`,
      ),
      requirement(
        "sync-minimum",
        "Mínimo na componente síncrona",
        snapshot.syncMet,
        `${formatPtNumber(snapshot.syncPercent)}% · mínimo ${formatPtNumber(snapshot.syncMinimum)}%`,
      ),
      requirement(
        "assessment-mode",
        "Modalidade dos elementos",
        snapshot.unspecified.length === 0,
        snapshot.unspecified.length === 0 ? "Todas definidas" : `${snapshot.unspecified.length} por definir`,
      ),
    ],
  };
}

function evaluateActivityModel(state: AppState, courseId: string, model: "type2" | "type3"): RegulationOutcome {
  const rules = getRules(state, courseId);
  const minimumFinalGrade = rules.minimumFinalGrade ?? 10;
  const activityMinimum = rules.nMinusOneMinimumPercent ?? 40;
  const assessments = requiredAssessments(state, courseId);
  const common = commonConfiguration(assessments, minimumFinalGrade);
  const asynchronous = assessments.filter((assessment) => assessment.mode === "asynchronous");
  const synchronous = assessments.filter((assessment) => assessment.mode === "synchronous");
  const unspecified = assessments.filter((assessment) => !assessment.mode);
  const standardCount = model === "type2" ? asynchronous.length : assessments.length;
  const countValid = standardCount >= 2 && standardCount <= 4;
  const modeValid = model === "type3"
    ? synchronous.length === 0 && unspecified.length === 0
    : unspecified.length === 0;
  const activitiesMeetingMinimum = assessments.filter((assessment) => (
    percentage(safeGrade(assessment), safeMaximum(assessment)) + EPSILON >= activityMinimum
  )).length;
  const requiredCount = Math.max(0, assessments.length - 1);
  const nMinusOneMet = activitiesMeetingMinimum >= requiredCount;
  const synchronousWithExplicitMinimum = model === "type2"
    ? synchronous.filter((assessment) => typeof assessment.minimumPercent === "number" && Number.isFinite(assessment.minimumPercent))
    : [];
  const exceptionalSyncMinimumMet = synchronousWithExplicitMinimum.every((assessment) => (
    percentage(safeGrade(assessment), safeMaximum(assessment)) + EPSILON >= (assessment.minimumPercent as number)
  ));
  const issues = [...common.issues];

  if (!countValid) {
    issues.push(model === "type2"
      ? "A Tipologia 2 exige entre 2 e 4 atividades assíncronas; uma atividade síncrona excecional só deve ser acrescentada quando o PUC o indicar."
      : "A Tipologia 3 exige entre 2 e 4 atividades assíncronas.");
  }
  if (!modeValid) {
    issues.push(model === "type3"
      ? "Na Tipologia 3, os elementos de avaliação são assíncronos."
      : "Falta indicar a modalidade de um ou mais elementos da Tipologia 2.");
  }

  const hasAnyGrade = assessments.some(hasGrade);
  const configurationComplete = issues.length === 0;
  const passed = configurationComplete
    && nMinusOneMet
    && exceptionalSyncMinimumMet
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
        "activity-count",
        model === "type2" ? "Atividades assíncronas" : "Número de atividades",
        countValid,
        `${standardCount} · exigidas 2 a 4`,
      ),
      requirement(
        "activity-mode",
        "Modalidade",
        modeValid,
        model === "type2"
          ? (synchronous.length > 0 ? `${synchronous.length} atividade(s) síncrona(s) excecional(is) indicada(s) no PUC` : "Atividades assíncronas")
          : (modeValid ? "Atividades assíncronas" : "Existem elementos não assíncronos"),
      ),
      requirement(
        "n-minus-one",
        "Regra N−1",
        nMinusOneMet,
        `${activitiesMeetingMinimum} de ${assessments.length} atividades com pelo menos ${formatPtNumber(activityMinimum)}%`,
      ),
      ...(model === "type2" && synchronousWithExplicitMinimum.length > 0 ? [requirement(
        "type2-sync-minimum",
        "Mínimo específico indicado no PUC",
        exceptionalSyncMinimumMet,
        synchronousWithExplicitMinimum.map((assessment) => {
          const minimum = assessment.minimumPercent as number;
          const current = percentage(safeGrade(assessment), safeMaximum(assessment));
          return `${assessment.name}: ${formatPtNumber(current)}% · mínimo ${formatPtNumber(minimum)}%`;
        }).join(" · "),
      )] : []),
      requirement(
        "activity-relationship",
        model === "type2" ? "Articulação das atividades" : "Autonomia das atividades",
        true,
        model === "type2" ? "As atividades devem estar articuladas conforme o PUC." : "As atividades são autónomas conforme o PUC.",
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
      issues: ["Falta configurar a prova de avaliação por exame."],
      requirements: [requirement("exam-configured", "Exame configurado", false, "Não configurado")],
    };
  }

  const maximum = safeMaximum(examAssessment);
  const validScale = approximately(maximum, 20);
  const graded = hasGrade(examAssessment);
  const raw = graded ? safeGrade(examAssessment) : null;
  const rounded = raw === null ? null : roundHalfUpInt(raw);
  const issues: string[] = [];

  if (!graded) issues.push(`Falta a nota de: ${examAssessment.name}.`);
  if (!validScale) issues.push(`O exame está configurado para ${formatPtNumber(maximum)} pontos, em vez de 20.`);

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
      requirement("exam-graded", "Exame classificado", graded, graded ? "Classificado" : "Por classificar"),
      requirement("exam-scale", "Escala do exame", validScale, `${formatPtNumber(maximum)} / 20 pontos`),
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
  const assessments = requiredAssessments(state, courseId);
  const hasAnyGrade = assessments.some(hasGrade);
  return {
    regime: "regulation-2026",
    model: "custom",
    modelLabel: modelLabel("custom"),
    source: "assessment",
    kind: hasAnyGrade ? "incomplete" : "in-progress",
    raw: null,
    rounded: null,
    issues: ["Seleciona a Tipologia 1, 2, 3 ou 4 (ou avaliação por exame) exatamente como estiver indicada no PUC."],
    requirements: [requirement("official-model", "Tipologia indicada no PUC", false, "Por selecionar")],
  };
}

export function getRegulationResitPlan(state: AppState, courseId: string): RegulationResitPlan | null {
  const course = getCourse(state, courseId);
  if (!course || course.evaluationRegime !== "regulation-2026") return null;
  const model = course.evaluationModel ?? "custom";

  if (model === "type1" || model === "type4") {
    const snapshot = splitSnapshot(state, courseId, model);
    if (snapshot.asyncMet && !snapshot.syncMet && snapshot.syncMaximum > 0) {
      return {
        kind: "repeat-synchronous",
        maxPoints: snapshot.syncMaximum,
        label: "Recurso — componente síncrona",
        description: `A componente assíncrona está cumprida. O recurso repete a componente síncrona com a mesma cotação (${formatPtNumber(snapshot.syncMaximum)} valores).`,
      };
    }
    return {
      kind: "final-20",
      maxPoints: 20,
      label: "Recurso — prova síncrona final",
      description: "Como a componente assíncrona não ficou cumprida, o recurso é uma prova síncrona final de 20 valores.",
    };
  }

  if (model === "type2") {
    return {
      kind: "final-20",
      maxPoints: 20,
      label: "Recurso — discussão online",
      description: "Na Tipologia 2, o recurso é uma discussão online cotada para 20 valores; em Língua Estrangeira pode integrar as competências linguísticas previstas no PUC.",
    };
  }
  if (model === "type3") {
    return {
      kind: "final-20",
      maxPoints: 20,
      label: "Recurso — atividade síncrona / discussão online",
      description: "Na Tipologia 3, o recurso é uma atividade síncrona ou discussão online cotada para 20 valores, conforme o PUC.",
    };
  }
  if (model === "exam-only") {
    return {
      kind: "final-20",
      maxPoints: 20,
      label: "Recurso — exame",
      description: "O recurso da avaliação por exame é classificado na escala de 20 valores.",
    };
  }
  return null;
}

function evaluateResit(state: AppState, courseId: string, item: Assessment, model: EvaluationModel): RegulationOutcome {
  const plan = getRegulationResitPlan(state, courseId);
  const maximum = safeMaximum(item);
  const grade = safeGrade(item);

  if (!plan) {
    return {
      regime: "regulation-2026",
      model,
      modelLabel: modelLabel(model),
      source: "resit",
      kind: "incomplete",
      raw: null,
      rounded: null,
      issues: ["Não é possível determinar o recurso sem a tipologia indicada no PUC."],
      requirements: [requirement("resit-plan", "Regra de recurso", false, "Tipologia por definir")],
    };
  }

  const validScale = approximately(maximum, plan.maxPoints);
  const issues = validScale
    ? []
    : [`O recurso está configurado para ${formatPtNumber(maximum)} pontos, mas nesta situação deve valer ${formatPtNumber(plan.maxPoints)}.`];

  if (plan.kind === "repeat-synchronous") {
    const snapshot = splitSnapshot(state, courseId, model as "type1" | "type4");
    const resourcePercent = percentage(grade, maximum);
    const resourceMinimumMet = resourcePercent + EPSILON >= snapshot.syncMinimum;
    const raw = snapshot.asyncGrade + grade;
    const rounded = roundHalfUpInt(raw);
    const passed = issues.length === 0 && resourceMinimumMet && rounded >= (snapshot.rules.minimumFinalGrade ?? 10);
    return {
      regime: "regulation-2026",
      model,
      modelLabel: modelLabel(model),
      source: "resit",
      kind: issues.length > 0 ? "incomplete" : passed ? "passed" : "failed",
      raw,
      rounded,
      issues,
      requirements: [
        requirement("resit-scale", "Cotação do recurso", validScale, `${formatPtNumber(maximum)} / ${formatPtNumber(plan.maxPoints)} valores`),
        requirement("resit-sync-minimum", "Mínimo na componente síncrona", resourceMinimumMet, `${formatPtNumber(resourcePercent)}% · mínimo ${formatPtNumber(snapshot.syncMinimum)}%`),
        requirement("resit-final", "Classificação final", rounded >= 10, `${rounded} valores`),
      ],
    };
  }

  const raw = grade;
  const rounded = roundHalfUpInt(raw);
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

/** Calcula apenas cadeiras explicitamente configuradas com o regime de 2026. */
export function getRegulationOutcome(state: AppState, courseId: string): RegulationOutcome | null {
  const course = getCourse(state, courseId);
  if (!course || course.evaluationRegime !== "regulation-2026") return null;

  const model = course.evaluationModel ?? "custom";
  const resource = resit(state, courseId);
  if (resource && hasGrade(resource)) return evaluateResit(state, courseId, resource, model);

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
  const missingGrades = efolios.filter((item) => item.maxPoints > 0 && item.grade === null).map((item) => item.name);
  const configuredMax = totalEFoliosMax(state, courseId) + safeMaximum(examAssessment);
  const issues: string[] = [];

  if (missingGrades.length > 0) issues.push(`Faltam as notas de: ${missingGrades.join(", ")}.`);
  if (!approximately(configuredMax, 20)) issues.push(`A avaliação configurada soma ${formatPtNumber(configuredMax)} pontos, em vez de 20.`);

  const efolioTotal = totalEFolios(state, courseId);
  const examValue = safeGrade(examAssessment);
  const raw = efolioTotal + examValue;
  const rounded = roundHalfUpInt(raw);

  if (issues.length > 0) return { source: "exam", kind: "incomplete", raw, rounded, issues };

  const rules = getRules(state, courseId);
  const passed = efolioTotal >= rules.minAptoExame && examValue >= rules.minExame && rounded >= 10;
  return { source: "exam", kind: passed ? "passed" : "resit", raw, rounded, issues: [] };
}

export function getResitOutcome(state: AppState, courseId: string): AssessmentOutcome | null {
  const item = resit(state, courseId);
  if (!item || item.grade === null) return null;
  const course = getCourse(state, courseId);

  if (course?.evaluationRegime === "regulation-2026") {
    const outcome = getRegulationOutcome(state, courseId);
    if (!outcome || outcome.source !== "resit" || outcome.raw === null || outcome.rounded === null) return null;
    return {
      source: "resit",
      kind: outcome.kind === "passed" ? "passed" : outcome.kind === "incomplete" ? "incomplete" : "failed",
      raw: outcome.raw,
      rounded: outcome.rounded,
      issues: outcome.issues,
    };
  }

  const maximum = safeMaximum(item);
  const issues = approximately(maximum, 20) ? [] : [`O recurso está configurado para ${formatPtNumber(maximum)} pontos, em vez de 20.`];
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
    return final !== null && final >= 10 ? { label: "Aprovado", badge: "success" } : { label: "Recurso", badge: "danger" };
  }

  const rules = getRules(state, courseId);
  const efolioTotal = totalEFolios(state, courseId);
  const examValue = examGrade(state, courseId);

  if (efolioTotal < rules.minAptoExame) return { label: "Não Apto", badge: "danger" };
  if (examValue === null) return { label: "Apto a Exame", badge: "warning" };
  if (examValue < rules.minExame) return { label: "Recurso", badge: "danger" };

  const final = finalGradeRounded(state, courseId);
  return final !== null && final >= 10 ? { label: "Aprovado", badge: "success" } : { label: "Recurso", badge: "danger" };
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

export function totalEctsCompleted(state: AppState, planCourses: { code: string; ects?: number }[]): number {
  const completedCodes = new Set(state.courses.filter((course) => course.isCompleted).map((course) => course.code));
  return planCourses
    .filter((planCourse) => completedCodes.has(planCourse.code))
    .reduce((total, planCourse) => total + (planCourse.ects ?? 6), 0);
}

export function totalEctsDegree(planCourses: { ects?: number }[]): number {
  return planCourses.reduce((total, planCourse) => total + (planCourse.ects ?? 6), 0);
}

export function finalGrade(state: AppState, courseId: string): number | null {
  return finalGradeRounded(state, courseId);
}
