import { describe, expect, it } from "vitest";

import { defaultState } from "@/lib/storage";
import { getLocalMigrationSummary, hasMeaningfulLocalMigrationData } from "@/lib/legacyMigration";

describe("legacy migration detection", () => {
  it("does not migrate a fresh empty state", () => {
    expect(hasMeaningfulLocalMigrationData(defaultState())).toBe(false);
  });

  it("detects academic data that should be migrated", () => {
    const state = defaultState();
    state.courses = [
      {
        id: "course-1",
        code: "21090",
        name: "Teste",
        year: 1,
        semester: 1,
        isActive: true,
        isCompleted: false,
        evaluationRegime: "legacy",
        evaluationModel: "custom",
      },
    ];

    expect(hasMeaningfulLocalMigrationData(state)).toBe(true);
    expect(getLocalMigrationSummary(state).courses).toBe(1);
  });

  it("counts completed courses and study blocks for the migration summary", () => {
    const state = defaultState();
    state.courses = [
      {
        id: "course-1",
        code: "1",
        name: "Concluída",
        year: 1,
        semester: 1,
        isActive: false,
        isCompleted: true,
        evaluationRegime: "legacy",
        evaluationModel: "custom",
      },
    ];
    state.studyBlocks = [
      {
        id: "study-1",
        courseId: "course-1",
        title: "Revisão",
        activity: "revision",
        startDate: "2026-08-09",
        endDate: "2026-08-09",
        status: "done",
      },
    ];

    const summary = getLocalMigrationSummary(state);
    expect(summary.completedCourses).toBe(1);
    expect(summary.studyBlocks).toBe(1);
  });
});
