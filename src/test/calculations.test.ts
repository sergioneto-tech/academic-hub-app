import { describe, expect, it } from "vitest";

import {
  finalGradeRaw,
  finalGradeRounded,
  getCourseStatus,
  getExamOutcome,
  getResitOutcome,
  needsResit,
  totalEFolios,
  totalEFoliosMax,
} from "@/lib/calculations";
import type { AppState } from "@/lib/types";

function stateWithThreeEFolios(): AppState {
  return {
    degree: null,
    courses: [
      {
        id: "course-1",
        code: "21000",
        name: "Cadeira de teste",
        year: 1,
        semester: 1,
        isActive: true,
        isCompleted: false,
      },
    ],
    assessments: [
      { id: "ef-a", courseId: "course-1", type: "efolio", name: "e-fólio A", maxPoints: 2, grade: 1.5 },
      { id: "ef-b", courseId: "course-1", type: "efolio", name: "e-fólio B", maxPoints: 3, grade: 2.5 },
      { id: "ef-c", courseId: "course-1", type: "efolio", name: "e-fólio C", maxPoints: 3, grade: 2.75 },
      { id: "exam", courseId: "course-1", type: "exam", name: "g-fólio", maxPoints: 12, grade: 9 },
      { id: "resit", courseId: "course-1", type: "resit", name: "recurso", maxPoints: 20, grade: null },
    ],
    rules: [],
    studyBlocks: [],
    sync: { enabled: false },
  };
}

describe("cálculos com número variável de e-fólios", () => {
  it("soma todos os e-fólios e os respetivos valores máximos", () => {
    const state = stateWithThreeEFolios();

    expect(totalEFolios(state, "course-1")).toBe(6.75);
    expect(totalEFoliosMax(state, "course-1")).toBe(8);
  });

  it("inclui todos os e-fólios no cálculo da nota final", () => {
    const state = stateWithThreeEFolios();

    expect(finalGradeRaw(state, "course-1")).toBe(15.75);
    expect(finalGradeRounded(state, "course-1")).toBe(16);
  });
});


describe("cartão de resultado da avaliação", () => {
  it("indica aprovação após o exame quando todos os critérios são cumpridos", () => {
    const state = stateWithThreeEFolios();

    expect(getExamOutcome(state, "course-1")).toMatchObject({
      kind: "passed",
      raw: 15.75,
      rounded: 16,
    });
    expect(needsResit(state, "course-1")).toBe(false);
  });

  it("encaminha para recurso quando a nota final fica abaixo de 10", () => {
    const state = stateWithThreeEFolios();
    state.assessments = state.assessments.map((item) =>
      item.id === "exam" ? { ...item, grade: 2.5 } : item,
    );

    expect(getExamOutcome(state, "course-1")).toMatchObject({
      kind: "resit",
      rounded: 9,
    });
    expect(needsResit(state, "course-1")).toBe(true);
  });

  it("avisa quando faltam notas ou a escala não soma 20 pontos", () => {
    const state = stateWithThreeEFolios();
    state.assessments = state.assessments.map((item) => {
      if (item.id === "ef-c") return { ...item, grade: null };
      if (item.id === "exam") return { ...item, maxPoints: 10 };
      return item;
    });

    const outcome = getExamOutcome(state, "course-1");
    expect(outcome?.kind).toBe("incomplete");
    expect(outcome?.issues).toHaveLength(2);
  });

  it("mostra o resultado do recurso e permite concluir quando aprovado", () => {
    const state = stateWithThreeEFolios();
    state.assessments = state.assessments.map((item) =>
      item.id === "resit" ? { ...item, grade: 13.4 } : item,
    );

    expect(getResitOutcome(state, "course-1")).toMatchObject({
      kind: "passed",
      rounded: 13,
    });
    expect(needsResit(state, "course-1")).toBe(false);
    expect(getCourseStatus(state, "course-1")).toEqual({ label: "Aprovado", badge: "success" });
  });
});
