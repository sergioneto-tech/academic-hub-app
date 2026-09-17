import type { AppState, Assessment, AssessmentType, EvaluationModel } from "./types";

export type PucImportApplyEvent = {
  name: string;
  maxPoints: number | null;
  startDate: string;
  endDate: string;
  gradeReleaseDate: string;
};

export type PucImportApplyDraft = {
  model: EvaluationModel;
  events: PucImportApplyEvent[];
  finalAssessmentName?: string;
  finalAssessmentMaxPoints: number | null;
};

export type PucImportApplyResult =
  | {
      ok: true;
      reason: null;
      errors: string[];
      nextState: AppState;
      summary: {
        importedEvents: number;
        finalAssessmentUpdated: boolean;
      };
    }
  | {
      ok: false;
      reason: "invalid" | "replace-confirmation" | "existing-progress";
      errors: string[];
    };

function uuid(): string {
  const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function importedAssessmentType(name: string): AssessmentType {
  return /^e-?f[oó]lio\b/i.test(name.trim()) ? "efolio" : "activity";
}

function hasStudentProgress(assessment: Assessment): boolean {
  return assessment.grade !== null
    || assessment.status === "submitted"
    || assessment.status === "graded"
    || assessment.status === "not-completed";
}

function hasManualStructure(assessment: Assessment): boolean {
  return Boolean(
    assessment.startDate
      || assessment.endDate
      || assessment.gradeReleaseDate
      || assessment.description,
  );
}

function validateDraft(
  draft: PucImportApplyDraft,
  options: { allowCustomModel?: boolean; requireCompleteTotal?: boolean } = {},
): string[] {
  const errors: string[] = [];

  if (draft.model === "custom" && !options.allowCustomModel) {
    errors.push("Confirma a tipologia/modalidade antes de guardar.");
  }

  draft.events.forEach((event, index) => {
    const label = event.name.trim() || `Elemento ${index + 1}`;
    if (!event.name.trim()) errors.push(`O elemento ${index + 1} não tem designação.`);
    if (!(typeof event.maxPoints === "number" && Number.isFinite(event.maxPoints) && event.maxPoints > 0 && event.maxPoints <= 20)) {
      errors.push(`${label}: confirma uma cotação válida entre 0 e 20 valores.`);
    }

    for (const [field, value] of [
      ["início", event.startDate],
      ["fim/entrega", event.endDate],
      ["publicação da nota", event.gradeReleaseDate],
    ] as const) {
      if (value && !isIsoDate(value)) errors.push(`${label}: a data de ${field} não é válida.`);
    }

    if (event.startDate && event.endDate && event.endDate < event.startDate) {
      errors.push(`${label}: a data de fim é anterior à data de início.`);
    }
    if (event.endDate && event.gradeReleaseDate && event.gradeReleaseDate < event.endDate) {
      errors.push(`${label}: a publicação da nota está definida antes do fim da atividade.`);
    }
  });

  const requiresFinal = draft.model === "type1" || draft.model === "type4" || draft.model === "exam-only";
  if (requiresFinal && !(typeof draft.finalAssessmentMaxPoints === "number" && draft.finalAssessmentMaxPoints > 0 && draft.finalAssessmentMaxPoints <= 20)) {
    errors.push("Confirma a cotação da prova final/exame antes de guardar.");
  }

  const points = [
    ...draft.events.map((event) => event.maxPoints),
    ...(draft.finalAssessmentMaxPoints !== null ? [draft.finalAssessmentMaxPoints] : []),
  ];
  if (
    options.requireCompleteTotal !== false
    && points.length > 0
    && points.every((value): value is number => typeof value === "number" && Number.isFinite(value))
  ) {
    const total = points.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 20) > 0.001) {
      errors.push(`As cotações confirmadas totalizam ${total} valores. A estrutura a guardar deve totalizar 20 valores.`);
    }
  }

  return Array.from(new Set(errors));
}

export function applyPucImportToState(
  state: AppState,
  courseId: string,
  draft: PucImportApplyDraft,
  options: { allowReplaceExisting?: boolean } = {},
): PucImportApplyResult {
  const course = state.courses.find((item) => item.id === courseId);
  if (!course) {
    return { ok: false, reason: "invalid", errors: ["A cadeira selecionada já não existe."] };
  }

  const isLegacy = (course.evaluationRegime ?? "legacy") === "legacy";
  const legacyMode = course.legacyEvaluationMode ?? "efolios-exam";

  if (isLegacy && legacyMode === "final-grade-only") {
    return {
      ok: false,
      reason: "invalid",
      errors: ["Esta cadeira está configurada como já concluída, apenas com nota final. O PUC não altera esse registo histórico."],
    };
  }

  const legacyExamOnly = isLegacy && legacyMode === "exam-only";
  const effectiveDraft: PucImportApplyDraft = legacyExamOnly
    ? { ...draft, model: "exam-only", events: [] }
    : draft;

  const errors = validateDraft(effectiveDraft, {
    allowCustomModel: isLegacy,
    requireCompleteTotal: !isLegacy || legacyExamOnly || effectiveDraft.finalAssessmentMaxPoints !== null,
  });
  if (errors.length > 0) return { ok: false, reason: "invalid", errors };

  const courseAssessments = state.assessments.filter((item) => item.courseId === courseId);
  const replaceable = legacyExamOnly
    ? []
    : courseAssessments.filter(
        (item) => item.type !== "exam" && item.type !== "resit" && item.type !== "special",
      );

  if (replaceable.some(hasStudentProgress)) {
    return {
      ok: false,
      reason: "existing-progress",
      errors: [
        "Esta cadeira já contém classificações ou elementos submetidos. Por segurança, a importação automática não vai substituir essa estrutura. Revê a cadeira manualmente.",
      ],
    };
  }

  if (!options.allowReplaceExisting && replaceable.some(hasManualStructure)) {
    return {
      ok: false,
      reason: "replace-confirmation",
      errors: [
        "Já existem datas configuradas manualmente nesta cadeira. Confirma explicitamente a substituição antes de guardar os dados revistos do PUC.",
      ],
    };
  }

  const preserved = legacyExamOnly
    ? state.assessments
    : state.assessments.filter(
        (item) => item.courseId !== courseId || item.type === "exam" || item.type === "resit" || item.type === "special",
      );

  const imported: Assessment[] = effectiveDraft.events.map((event, index) => ({
    id: uuid(),
    courseId,
    type: importedAssessmentType(event.name),
    name: event.name.trim(),
    maxPoints: event.maxPoints as number,
    grade: null,
    mode: "asynchronous",
    required: true,
    status: "todo",
    order: index + 1,
    startDate: event.startDate || undefined,
    endDate: event.endDate || undefined,
    gradeReleaseDate: event.gradeReleaseDate || undefined,
  }));

  let finalAssessmentUpdated = false;
  const finalPoints = effectiveDraft.finalAssessmentMaxPoints;
  let nextPreserved = preserved;

  if (typeof finalPoints === "number" && finalPoints > 0) {
    const exam = courseAssessments.find((item) => item.type === "exam");
    if (exam) {
      nextPreserved = preserved.map((item) => item.id === exam.id ? {
        ...item,
        maxPoints: finalPoints,
        required: true,
      } : item);
      finalAssessmentUpdated = true;
    } else {
      const newExam: Assessment = {
        id: uuid(),
        courseId,
        type: "exam",
        name: effectiveDraft.finalAssessmentName?.trim() || "Prova / exame final",
        maxPoints: finalPoints,
        grade: null,
        mode: "synchronous",
        required: true,
        status: "todo",
        order: imported.length + 1,
      };
      nextPreserved = [...preserved, newExam];
      finalAssessmentUpdated = true;
    }
  }

  const nextState: AppState = {
    ...state,
    courses: state.courses.map((item) => item.id === courseId
      ? isLegacy
        ? item
        : {
            ...item,
            evaluationRegime: "regulation-2026",
            evaluationModel: effectiveDraft.model,
          }
      : item),
    assessments: [...nextPreserved, ...imported],
  };

  return {
    ok: true,
    reason: null,
    errors: [],
    nextState,
    summary: {
      importedEvents: imported.length,
      finalAssessmentUpdated,
    },
  };
}
