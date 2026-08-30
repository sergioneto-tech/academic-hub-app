import { describe, expect, it } from "vitest";

import { getCourseStatus, needsResit } from "@/lib/calculations";
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
