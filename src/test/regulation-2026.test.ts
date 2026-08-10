import { describe, expect, it } from "vitest";

import {
  finalGradeRaw,
  finalGradeRounded,
  getCourseStatus,
  getRegulationOutcome,
  getRegulationResitPlan,
  needsResit,
} from "@/lib/calculations";
import type { AppState, Assessment, EvaluationModel } from "@/lib/types";

function baseState(model: EvaluationModel, assessments: Assessment[]): AppState {
  return {
    degree: null,
    courses: [
      {
        id: "course-2026",
        code: "20260",
        name: "Cadeira 2026",
        year: 1,
        semester: 1,
        isActive: true,
        isCompleted: false,
        evaluationRegime: "regulation-2026",
        evaluationModel: model,
      },
    ],
    assessments,
    rules: [],
    studyBlocks: [],
    sync: { enabled: false },
  };
}

function item(seed: Partial<Assessment> & Pick<Assessment, "id" | "name" | "maxPoints">): Assessment {
  return {
    courseId: "course-2026",
    type: "activity",
    grade: null,
    required: true,
    ...seed,
  };
}

describe("motor de avaliação de 2026", () => {
  it("aprova na Tipologia 1 com 2-3 assíncronas (6-8) e uma síncrona (12-14)", () => {
    const state = baseState("type1", [
      item({ id: "async-a", name: "Atividade A", maxPoints: 4, grade: 3, mode: "asynchronous" }),
      item({ id: "async-b", name: "Atividade B", maxPoints: 4, grade: 2, mode: "asynchronous" }),
      item({ id: "sync-a", name: "Prova síncrona", maxPoints: 12, grade: 7, mode: "synchronous", type: "exam" }),
    ]);

    expect(getRegulationOutcome(state, "course-2026")).toMatchObject({
      kind: "passed",
      raw: 12,
      rounded: 12,
      model: "type1",
      modelLabel: "Tipologia 1",
    });
    expect(getCourseStatus(state, "course-2026")).toEqual({ label: "Aprovado", badge: "success" });
    expect(needsResit(state, "course-2026")).toBe(false);
  });

  it("rejeita uma estrutura 10+10 que não corresponde à Tipologia 1", () => {
    const state = baseState("type1", [
      item({ id: "async-a", name: "Trabalho", maxPoints: 10, grade: 7, mode: "asynchronous" }),
      item({ id: "sync-a", name: "Prova", maxPoints: 10, grade: 6, mode: "synchronous", type: "exam" }),
    ]);

    const outcome = getRegulationOutcome(state, "course-2026");
    expect(outcome?.kind).toBe("incomplete");
    expect(outcome?.requirements.find((entry) => entry.key === "async-weight")?.met).toBe(false);
    expect(outcome?.requirements.find((entry) => entry.key === "sync-weight")?.met).toBe(false);
  });

  it("na Tipologia 4 exige exatamente uma assíncrona e uma síncrona", () => {
    const state = baseState("type4", [
      item({ id: "async-a", name: "Atividade A", maxPoints: 3, grade: 2, mode: "asynchronous" }),
      item({ id: "async-b", name: "Atividade B", maxPoints: 4, grade: 3, mode: "asynchronous" }),
      item({ id: "sync-a", name: "Prova", maxPoints: 13, grade: 8, mode: "synchronous", type: "exam" }),
    ]);

    expect(getRegulationOutcome(state, "course-2026")?.kind).toBe("incomplete");
  });

  it("aplica a regra N−1 e o limite de 2-4 atividades nas Tipologias 2/3", () => {
    const state = baseState("type2", [
      item({ id: "a1", name: "Atividade 1", maxPoints: 5, grade: 3, mode: "asynchronous" }),
      item({ id: "a2", name: "Atividade 2", maxPoints: 5, grade: 1.5, mode: "asynchronous" }),
      item({ id: "a3", name: "Atividade 3", maxPoints: 5, grade: 1.5, mode: "asynchronous" }),
      item({ id: "a4", name: "Atividade 4", maxPoints: 5, grade: 5, mode: "asynchronous" }),
    ]);

    const outcome = getRegulationOutcome(state, "course-2026");
    expect(outcome).toMatchObject({ kind: "resit", raw: 11, rounded: 11 });
    expect(outcome?.requirements.find((entry) => entry.key === "n-minus-one")?.met).toBe(false);

    state.assessments = state.assessments.map((assessment) => assessment.id === "a3" ? { ...assessment, grade: 2 } : assessment);
    expect(getRegulationOutcome(state, "course-2026")?.kind).toBe("passed");
  });

  it("calcula avaliação por exame em escala de 20 valores", () => {
    const state = baseState("exam-only", [
      item({ id: "exam", name: "Exame", maxPoints: 20, grade: 9.5, type: "exam", mode: "synchronous" }),
    ]);

    expect(getRegulationOutcome(state, "course-2026")).toMatchObject({ kind: "passed", raw: 9.5, rounded: 10 });
    expect(finalGradeRaw(state, "course-2026")).toBe(9.5);
    expect(finalGradeRounded(state, "course-2026")).toBe(10);
  });

  it("não trata a configuração provisória como uma quinta tipologia oficial", () => {
    const state = baseState("custom", [
      item({ id: "a1", name: "Projeto", maxPoints: 20, grade: 15, mode: "asynchronous" }),
    ]);

    const outcome = getRegulationOutcome(state, "course-2026");
    expect(outcome?.kind).toBe("incomplete");
    expect(outcome?.rounded).toBeNull();
    expect(outcome?.issues[0]).toContain("Tipologia 1, 2, 3 ou 4");
  });

  it("repete apenas a componente síncrona na Tipologia 1 quando a assíncrona já está cumprida", () => {
    const state = baseState("type1", [
      item({ id: "async-a", name: "Atividade A", maxPoints: 4, grade: 3, mode: "asynchronous" }),
      item({ id: "async-b", name: "Atividade B", maxPoints: 4, grade: 2, mode: "asynchronous" }),
      item({ id: "sync", name: "Prova", maxPoints: 12, grade: 5, mode: "synchronous", type: "exam" }),
    ]);

    expect(getRegulationOutcome(state, "course-2026")?.kind).toBe("resit");
    expect(getRegulationResitPlan(state, "course-2026")).toMatchObject({
      kind: "repeat-synchronous",
      maxPoints: 12,
    });

    state.assessments.push(item({
      id: "resit",
      name: "Recurso — componente síncrona",
      maxPoints: 12,
      grade: 7,
      type: "resit",
      required: false,
      mode: "synchronous",
    }));

    expect(getRegulationOutcome(state, "course-2026")).toMatchObject({
      source: "resit",
      kind: "passed",
      raw: 12,
      rounded: 12,
    });
  });

  it("usa recurso de 20 valores quando a componente assíncrona da Tipologia 4 falha", () => {
    const state = baseState("type4", [
      item({ id: "async", name: "Trabalho", maxPoints: 7, grade: 2, mode: "asynchronous" }),
      item({ id: "sync", name: "Prova", maxPoints: 13, grade: 8, mode: "synchronous", type: "exam" }),
    ]);

    expect(getRegulationResitPlan(state, "course-2026")).toMatchObject({ kind: "final-20", maxPoints: 20 });
    state.assessments.push(item({ id: "resit", name: "Recurso", maxPoints: 20, grade: 14.4, type: "resit", required: false, mode: "synchronous" }));

    expect(getRegulationOutcome(state, "course-2026")).toMatchObject({ source: "resit", kind: "passed", raw: 14.4, rounded: 14 });
  });
});

describe("compatibilidade com o regime anterior", () => {
  it("mantém o cálculo legado quando a cadeira não tem regime de 2026", () => {
    const state: AppState = {
      degree: null,
      courses: [
        { id: "legacy", code: "21000", name: "Cadeira antiga", year: 1, semester: 1, isActive: true, isCompleted: false },
      ],
      assessments: [
        { id: "ef-a", courseId: "legacy", type: "efolio", name: "e-fólio A", maxPoints: 4, grade: 3 },
        { id: "ef-b", courseId: "legacy", type: "efolio", name: "e-fólio B", maxPoints: 4, grade: 3 },
        { id: "exam", courseId: "legacy", type: "exam", name: "g-fólio", maxPoints: 12, grade: 7 },
      ],
      rules: [],
      studyBlocks: [],
      sync: { enabled: false },
    };

    expect(getRegulationOutcome(state, "legacy")).toBeNull();
    expect(finalGradeRaw(state, "legacy")).toBe(13);
    expect(finalGradeRounded(state, "legacy")).toBe(13);
    expect(getCourseStatus(state, "legacy")).toEqual({ label: "Aprovado", badge: "success" });
  });
});
