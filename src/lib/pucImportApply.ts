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
        reusedExisting: number;
        preservedProgress: number;
      };
    }
  | {
      ok: false;
      reason: "invalid" | "replace-confirmation" | "reconciliation-conflict";
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

function normalizeAssessmentName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-PT")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function semanticAssessmentKey(value: string): string {
  const normalized = normalizeAssessmentName(value);
  const efolio = normalized.match(/\be\s*folio\s*([a-z]|\d+)\b/);
  if (efolio) return `efolio:${efolio[1]}`;

  const numbers = normalized.match(/\b\d+\b/g);
  if (numbers?.length) return `ordinal:${numbers[numbers.length - 1]}`;
  return "";
}

function sortByOrder<T extends { order?: number; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, "pt-PT");
  });
}

function typesAreCompatible(existing: Assessment, event: PucImportApplyEvent): boolean {
  const importedType = importedAssessmentType(event.name);
  if (existing.type === importedType) return true;
  if (importedType === "efolio" || existing.type === "efolio") return false;
  return existing.type !== "exam" && existing.type !== "resit" && existing.type !== "special";
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

type ReconciliationResult = {
  imported: Assessment[];
  reusedExisting: number;
  preservedProgress: number;
  conflicts: string[];
};

function reconcileAssessments(
  courseId: string,
  existing: Assessment[],
  events: PucImportApplyEvent[],
): ReconciliationResult {
  const available = sortByOrder(existing);
  const assignments = new Map<number, Assessment>();
  const usedIds = new Set<string>();

  const assign = (eventIndex: number, assessment: Assessment | undefined) => {
    if (!assessment || usedIds.has(assessment.id)) return false;
    assignments.set(eventIndex, assessment);
    usedIds.add(assessment.id);
    return true;
  };

  events.forEach((event, eventIndex) => {
    const normalized = normalizeAssessmentName(event.name);
    const exact = available.find((assessment) => (
      !usedIds.has(assessment.id)
      && normalizeAssessmentName(assessment.name) === normalized
    ));
    assign(eventIndex, exact);
  });

  events.forEach((event, eventIndex) => {
    if (assignments.has(eventIndex)) return;
    const key = semanticAssessmentKey(event.name);
    if (!key) return;
    const semantic = available.find((assessment) => (
      !usedIds.has(assessment.id)
      && typesAreCompatible(assessment, event)
      && semanticAssessmentKey(assessment.name) === key
    ));
    assign(eventIndex, semantic);
  });

  events.forEach((event, eventIndex) => {
    if (assignments.has(eventIndex)) return;
    const orderMatch = available.find((assessment) => (
      !usedIds.has(assessment.id)
      && typesAreCompatible(assessment, event)
      && assessment.order === eventIndex + 1
    ));
    assign(eventIndex, orderMatch);
  });

  let unmatchedEvents = events
    .map((_, index) => index)
    .filter((index) => !assignments.has(index));
  let remainingProgress = available.filter((assessment) => !usedIds.has(assessment.id) && hasStudentProgress(assessment));

  if (remainingProgress.length > 0 && remainingProgress.length <= unmatchedEvents.length) {
    remainingProgress = sortByOrder(remainingProgress);
    remainingProgress.forEach((assessment, index) => {
      assign(unmatchedEvents[index], assessment);
    });
  }

  unmatchedEvents = events
    .map((_, index) => index)
    .filter((index) => !assignments.has(index));

  const remainingUnprogressed = sortByOrder(
    available.filter((assessment) => !usedIds.has(assessment.id) && !hasStudentProgress(assessment)),
  );
  unmatchedEvents.forEach((eventIndex, index) => {
    assign(eventIndex, remainingUnprogressed[index]);
  });

  const conflicts = available
    .filter((assessment) => !usedIds.has(assessment.id) && hasStudentProgress(assessment))
    .map((assessment) => `${assessment.name} já contém ${assessment.grade !== null ? `a classificação ${assessment.grade}` : "progresso registado"} e não existe no PUC revisto de forma que permita associá-lo com segurança.`);

  let reusedExisting = 0;
  let preservedProgress = 0;
  const imported = events.map((event, index): Assessment => {
    const matched = assignments.get(index);
    const importedType = importedAssessmentType(event.name);
    if (matched) {
      reusedExisting += 1;
      if (hasStudentProgress(matched)) preservedProgress += 1;
      const nextType = importedType === "efolio" || matched.type === "efolio"
        ? importedType
        : matched.type;
      return {
        ...matched,
        courseId,
        type: nextType,
        name: event.name.trim(),
        maxPoints: event.maxPoints as number,
        required: true,
        order: index + 1,
        startDate: event.startDate || undefined,
        endDate: event.endDate || undefined,
        gradeReleaseDate: event.gradeReleaseDate || undefined,
      };
    }

    return {
      id: uuid(),
      courseId,
      type: importedType,
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
    };
  });

  for (const assessment of imported) {
    if (assessment.grade !== null && assessment.grade > assessment.maxPoints + 0.001) {
      conflicts.push(`${assessment.name}: a classificação já registada (${assessment.grade}) é superior à nova cotação do PUC (${assessment.maxPoints}). Confirma primeiro a classificação antes de aplicar esta alteração.`);
    }
  }

  return { imported, reusedExisting, preservedProgress, conflicts };
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
  const currentExam = courseAssessments.find((item) => item.type === "exam");
  const finalPoints = effectiveDraft.finalAssessmentMaxPoints;
  const examProgressWillBeReconciled = Boolean(
    currentExam
      && hasStudentProgress(currentExam)
      && typeof finalPoints === "number"
      && Math.abs(currentExam.maxPoints - finalPoints) > 0.001,
  );
  const hasExistingProgress = replaceable.some(hasStudentProgress) || examProgressWillBeReconciled;
  const hasExistingManualStructure = replaceable.some(hasManualStructure);

  if (!options.allowReplaceExisting && (hasExistingProgress || hasExistingManualStructure)) {
    const confirmationErrors: string[] = [];
    if (hasExistingProgress) {
      confirmationErrors.push("Esta cadeira já contém classificações, submissões ou progresso registado. Podes atualizar a estrutura pelo PUC: o Academic Hub preservará as notas e os estados nos elementos que conseguir associar à versão revista.");
    }
    if (hasExistingManualStructure) {
      confirmationErrors.push("Já existem datas ou dados configurados manualmente. Ao confirmares, os campos visíveis nesta revisão passam a refletir o PUC atual.");
    }
    confirmationErrors.push("As datas e horas oficiais de exame, recurso e época especial permanecem inalteradas.");
    return {
      ok: false,
      reason: "replace-confirmation",
      errors: confirmationErrors,
    };
  }

  const reconciliation = reconcileAssessments(courseId, replaceable, effectiveDraft.events);
  if (reconciliation.conflicts.length > 0) {
    return {
      ok: false,
      reason: "reconciliation-conflict",
      errors: [
        "O PUC foi lido corretamente, mas existem dados académicos já registados que não podem ser reposicionados automaticamente sem risco de associar uma classificação ao elemento errado.",
        ...reconciliation.conflicts,
      ],
    };
  }

  const preserved = legacyExamOnly
    ? state.assessments
    : state.assessments.filter(
        (item) => item.courseId !== courseId || item.type === "exam" || item.type === "resit" || item.type === "special",
      );

  let finalAssessmentUpdated = false;
  let preservedProgress = reconciliation.preservedProgress;
  let nextPreserved = preserved;

  if (typeof finalPoints === "number" && finalPoints > 0) {
    const exam = currentExam;
    if (exam) {
      if (exam.grade !== null && exam.grade > finalPoints + 0.001) {
        return {
          ok: false,
          reason: "reconciliation-conflict",
          errors: [
            `${exam.name}: a classificação já registada (${exam.grade}) é superior à nova cotação do PUC (${finalPoints}). Confirma primeiro a classificação antes de aplicar esta alteração.`,
          ],
        };
      }
      if (hasStudentProgress(exam)) preservedProgress += 1;
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
        order: reconciliation.imported.length + 1,
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
    assessments: [...nextPreserved, ...reconciliation.imported],
  };

  return {
    ok: true,
    reason: null,
    errors: [],
    nextState,
    summary: {
      importedEvents: reconciliation.imported.length,
      finalAssessmentUpdated,
      reusedExisting: reconciliation.reusedExisting,
      preservedProgress,
    },
  };
}
