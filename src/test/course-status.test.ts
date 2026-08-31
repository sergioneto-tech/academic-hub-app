import { describe, expect, it } from "vitest";

import { finalGradeRounded, getCourseStatus, globalStats, needsResit } from "@/lib/calculations";
import type { AppState } from "@/lib/types";

function legacyState(): AppState {
  return {
    degree: null,
    courses: [
      {
        id: "legacy-active",
        code: "21181",
        name: "Cadeira ativa",
        year: 1,
        semester: 1,
        isActive: true,
        isCompleted: false,
      },
    ],
    assessments: [
      { id: "ef-a", courseId: "legacy-active", type: "efolio", name: "e-fólio A", maxPoints: 4, grade: null },
      { id: "ef-b", courseId: "legacy-active", type: "efolio", name: "e-fólio B", maxPoints: 4, grade: null },
      { id: "exam", courseId: "legacy-active", type: "exam", name: "Exame", maxPoints: 12, grade: null },
    ],
    rules: [],
    studyBlocks: [],
    sync: { enabled: false },
  };
}

function historicalFinalState(): AppState {
  return {
    degree: null,
    courses: [
      {
        id: "historical-final",
        code: "21000",
        name: "Cadeira concluída no passado",
        year: 1,
        semester: 1,
        isActive: true,
        isCompleted: false,
        evaluationRegime: "legacy",
        evaluationRegimeSource: "manual",
        legacyEvaluationMode: "final-grade-only",
        manualFinalGrade: 15.6,
      },
    ],
    assessments: [],
    rules: [],
    studyBlocks: [],
    sync: { enabled: false },
  };
}

describe("estado visual de cadeiras ativas", () => {
  it("mantém Em curso antes de existirem classificações", () => {
    const state = legacyState();

    expect(getCourseStatus(state, "legacy-active")).toEqual({ label: "Em curso", badge: "info" });
    expect(needsResit(state, "legacy-active")).toBe(false);
  });

  it("mantém Em curso enquanto ainda falta classificar um e-fólio", () => {
    const state = legacyState();
    state.assessments = state.assessments.map((item) =>
      item.id === "ef-a" ? { ...item, grade: 2 } : item,
    );

    expect(getCourseStatus(state, "legacy-active")).toEqual({ label: "Em curso", badge: "info" });
    expect(needsResit(state, "legacy-active")).toBe(false);
  });

  it("só apresenta Não Apto depois de existirem todas as notas necessárias", () => {
    const state = legacyState();
    state.assessments = state.assessments.map((item) => {
      if (item.id === "ef-a") return { ...item, grade: 1 };
      if (item.id === "ef-b") return { ...item, grade: 2 };
      return item;
    });

    expect(getCourseStatus(state, "legacy-active")).toEqual({ label: "Não Apto", badge: "danger" });
    expect(needsResit(state, "legacy-active")).toBe(true);
  });

  it("apresenta Apto a Exame quando a avaliação contínua já permite acesso", () => {
    const state = legacyState();
    state.assessments = state.assessments.map((item) => {
      if (item.id === "ef-a") return { ...item, grade: 2 };
      if (item.id === "ef-b") return { ...item, grade: 2 };
      return item;
    });

    expect(getCourseStatus(state, "legacy-active")).toEqual({ label: "Apto a Exame", badge: "warning" });
    expect(needsResit(state, "legacy-active")).toBe(false);
  });
});

describe("registo histórico apenas com nota final", () => {
  it("usa a nota manual sem exigir e-fólios, exame ou recurso", () => {
    const state = historicalFinalState();

    expect(finalGradeRounded(state, "historical-final")).toBe(16);
    expect(getCourseStatus(state, "historical-final")).toEqual({ label: "Aprovado", badge: "success" });
    expect(needsResit(state, "historical-final")).toBe(false);
  });

  it("inclui a nota histórica nas estatísticas depois de concluir a cadeira", () => {
    const state = historicalFinalState();
    state.courses = state.courses.map((course) => ({ ...course, isActive: false, isCompleted: true }));

    expect(globalStats(state)).toMatchObject({ completed: 1, avg: 16, best: 16 });
  });

  it("indica claramente quando ainda falta registar a nota final", () => {
    const state = historicalFinalState();
    state.courses = state.courses.map((course) => ({ ...course, manualFinalGrade: undefined }));

    expect(getCourseStatus(state, "historical-final")).toEqual({ label: "Por registar", badge: "neutral" });
    expect(finalGradeRounded(state, "historical-final")).toBeNull();
  });
});
