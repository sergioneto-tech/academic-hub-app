import { describe, expect, it } from "vitest";
import type { Assessment } from "@/lib/types";
import { validateAssessmentSave } from "@/lib/assessmentSaveValidation";

function assessment(patch: Partial<Assessment> = {}): Assessment {
  return {
    id: "a1",
    courseId: "c1",
    type: "activity",
    name: "Atividade Sumativa 1",
    maxPoints: 3,
    grade: null,
    mode: "asynchronous",
    required: true,
    ...patch,
  };
}

describe("validateAssessmentSave", () => {
  it("allows a missing grade publication date without warning", () => {
    const result = validateAssessmentSave([
      assessment({ startDate: "2026-11-06", endDate: "2026-11-16", gradeReleaseDate: undefined }),
    ]);
    expect(result).toEqual({ warnings: [], errors: [] });
  });

  it("allows partial dates to be saved with a warning", () => {
    const result = validateAssessmentSave([assessment({ startDate: "2026-11-06" })]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain("Atividade Sumativa 1: falta a data de fim.");
  });

  it("detects an end date before the start date", () => {
    const result = validateAssessmentSave([
      assessment({ startDate: "2026-12-11", endDate: "2026-11-21" }),
    ]);
    expect(result.errors).toContain("Atividade Sumativa 1: a data de fim é anterior à data de início.");
  });

  it("requires a date and time for timed assessments, but still treats it as a recoverable warning", () => {
    const result = validateAssessmentSave([
      assessment({ type: "exam", name: "Atividade Sumativa 3", maxPoints: 14, mode: "synchronous" }),
    ]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain("Atividade Sumativa 3: falta a data e hora.");
  });
});
