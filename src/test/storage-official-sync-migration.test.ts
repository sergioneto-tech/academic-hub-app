import { describe, expect, it } from "vitest";

import { migrate } from "@/lib/storage";

describe("migração do estado da sincronização oficial", () => {
  it("preserva os metadados oficiais da cadeira e das datas", () => {
    const checkedAt = "2026-08-24T10:00:00.000Z";
    const state = migrate({
      degree: null,
      courses: [
        {
          id: "algebra",
          code: "21002",
          name: "Álgebra Linear I",
          year: 1,
          semester: 1,
          isActive: true,
          isCompleted: false,
          evaluationRegime: "regulation-2026",
          evaluationRegimeSource: "official",
          evaluationModel: "type2",
          legacyEvaluationMode: "custom",
          manualFinalGrade: 14,
        },
      ],
      assessments: [
        {
          id: "algebra-exam",
          courseId: "algebra",
          type: "exam",
          name: "g-fólio",
          maxPoints: 12,
          grade: null,
          date: "2027-01-13T13:00",
          dateSource: "official",
          officialCheckedAt: checkedAt,
        },
      ],
      rules: [],
      studyBlocks: [],
      sync: {
        enabled: true,
        localModifiedAt: checkedAt,
        lastSyncDeviceId: "device-1",
        lastSyncDeviceLabel: "telemóvel · Android",
        conflictPending: false,
      },
    });

    const course = state.courses[0];
    const assessment = state.assessments[0];

    expect(course.evaluationRegimeSource).toBe("official");
    expect(course.legacyEvaluationMode).toBe("custom");
    expect(course.manualFinalGrade).toBe(14);
    expect(assessment.dateSource).toBe("official");
    expect(assessment.officialCheckedAt).toBe(checkedAt);
    expect(state.sync?.localModifiedAt).toBe(checkedAt);
    expect(state.sync?.lastSyncDeviceId).toBe("device-1");
    expect(state.sync?.lastSyncDeviceLabel).toBe("telemóvel · Android");
    expect(state.sync?.conflictPending).toBe(false);
  });

  it("interpreta corretamente booleanos antigos guardados como texto", () => {
    const state = migrate({
      degree: null,
      courses: [
        {
          id: "algebra",
          code: "21002",
          name: "Álgebra Linear I",
          year: 1,
          semester: 1,
          isActive: "false",
          isCompleted: "0",
        },
      ],
      assessments: [],
      rules: [],
      studyBlocks: [],
      sync: { enabled: "false" },
    });

    expect(state.courses[0].isActive).toBe(false);
    expect(state.courses[0].isCompleted).toBe(false);
    expect(state.sync?.enabled).toBe(false);
  });
});
