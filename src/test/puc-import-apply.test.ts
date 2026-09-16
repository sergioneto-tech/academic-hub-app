import { describe, expect, it } from "vitest";
import { applyPucImportToState } from "@/lib/pucImportApply";
import type { AppState } from "@/lib/types";

function baseState(): AppState {
  return {
    degree: null,
    courses: [{
      id: "course-1",
      code: "21002",
      name: "Álgebra Linear I",
      year: 1,
      semester: 1,
      isActive: true,
      isCompleted: false,
      evaluationRegime: "regulation-2026",
      evaluationRegimeSource: "official",
      evaluationModel: "custom",
    }],
    assessments: [
      {
        id: "a",
        courseId: "course-1",
        type: "efolio",
        name: "e-fólio A",
        maxPoints: 4,
        grade: null,
        mode: "asynchronous",
        required: true,
        status: "todo",
        order: 1,
      },
      {
        id: "b",
        courseId: "course-1",
        type: "efolio",
        name: "e-fólio B",
        maxPoints: 4,
        grade: null,
        mode: "asynchronous",
        required: true,
        status: "todo",
        order: 2,
      },
      {
        id: "exam",
        courseId: "course-1",
        type: "exam",
        name: "Exame",
        maxPoints: 12,
        grade: null,
        mode: "synchronous",
        required: true,
        status: "todo",
        order: 3,
        date: "2027-01-25T10:00",
        dateSource: "official",
        officialCheckedAt: "2026-09-16T10:00:00.000Z",
      },
      {
        id: "resit",
        courseId: "course-1",
        type: "resit",
        name: "Recurso",
        maxPoints: 20,
        grade: null,
        mode: "synchronous",
        required: false,
        status: "todo",
        order: 4,
        date: "2027-02-16T10:00",
        dateSource: "official",
      },
    ],
    rules: [],
  };
}

const draft = {
  model: "type4" as const,
  events: [{
    name: "Atividade Sumativa 1",
    maxPoints: 6,
    startDate: "2026-11-13",
    endDate: "2026-11-23",
    gradeReleaseDate: "2026-12-18",
  }],
  finalAssessmentName: "Atividade de Avaliação por Exame",
  finalAssessmentMaxPoints: 14,
};

describe("apply PUC import", () => {
  it("replaces pristine placeholders and changes only the exam cotation, preserving official exam and resit dates", () => {
    const result = applyPucImportToState(baseState(), "course-1", draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const current = result.nextState.assessments.filter((item) => item.courseId === "course-1");
    const assessment = current.find((item) => item.name === "Atividade Sumativa 1");
    const exam = current.find((item) => item.type === "exam");
    const resit = current.find((item) => item.type === "resit");

    expect(assessment).toMatchObject({
      maxPoints: 6,
      startDate: "2026-11-13",
      endDate: "2026-11-23",
      gradeReleaseDate: "2026-12-18",
    });
    expect(current.filter((item) => item.type !== "exam" && item.type !== "resit")).toHaveLength(1);
    expect(exam).toMatchObject({
      id: "exam",
      maxPoints: 14,
      date: "2027-01-25T10:00",
      dateSource: "official",
      officialCheckedAt: "2026-09-16T10:00:00.000Z",
    });
    expect(resit).toMatchObject({
      id: "resit",
      date: "2027-02-16T10:00",
      dateSource: "official",
    });
    expect(result.nextState.courses[0]).toMatchObject({ evaluationModel: "type4", evaluationRegime: "regulation-2026" });
  });

  it("requires explicit confirmation before replacing manually configured dates", () => {
    const state = baseState();
    state.assessments[0].startDate = "2026-10-01";
    const result = applyPucImportToState(state, "course-1", draft);
    expect(result).toMatchObject({ ok: false, reason: "replace-confirmation" });

    const confirmed = applyPucImportToState(state, "course-1", draft, { allowReplaceExisting: true });
    expect(confirmed.ok).toBe(true);
  });

  it("blocks automatic replacement when the student already has grades or submitted work", () => {
    const state = baseState();
    state.assessments[0].grade = 3;
    state.assessments[0].status = "graded";
    const result = applyPucImportToState(state, "course-1", draft, { allowReplaceExisting: true });
    expect(result).toMatchObject({ ok: false, reason: "existing-progress" });
  });

  it("rejects incoherent cotations before touching the state", () => {
    const result = applyPucImportToState(baseState(), "course-1", {
      ...draft,
      finalAssessmentMaxPoints: 12,
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    if (!result.ok) expect(result.errors.some((error) => error.includes("18 valores"))).toBe(true);
  });
});
