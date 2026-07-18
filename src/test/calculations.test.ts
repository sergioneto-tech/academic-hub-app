import { describe, expect, it } from "vitest";

import {
  finalGradeRaw,
  finalGradeRounded,
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
