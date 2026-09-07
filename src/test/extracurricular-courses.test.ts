import { describe, expect, it } from "vitest";

import { globalStats } from "@/lib/calculations";
import { migrate } from "@/lib/storage";
import type { AppState } from "@/lib/types";
import { getCourseEcts } from "@/lib/uabPlan";

const state: AppState = {
  degree: { id: "lei", name: "Licenciatura em Engenharia Informática" },
  courses: [
    { id: "official", code: "21002", name: "Álgebra Linear I", year: 1, semester: 1, isActive: false, isCompleted: true },
    { id: "extra", code: "EXT-01", name: "Matemática Preparatória", year: 1, semester: 1, isActive: false, isCompleted: true, isExtracurricular: true },
  ],
  assessments: [
    { id: "official-final", courseId: "official", type: "resit", name: "recurso", maxPoints: 20, grade: 14 },
    { id: "extra-final", courseId: "extra", type: "resit", name: "recurso", maxPoints: 20, grade: 20 },
  ],
  rules: [],
};

describe("extracurricular courses", () => {
  it("keeps extracurricular grades out of official global statistics", () => {
    const stats = globalStats(state);
    expect(stats.completed).toBe(1);
    expect(stats.avg).toBe(14);
    expect(stats.best).toBe(14);
  });

  it("does not invent ECTS for a course outside the official plan", () => {
    expect(getCourseEcts([], "EXT-01")).toBe(0);
  });

  it("preserves the extracurricular classification when state is migrated or loaded", () => {
    const migrated = migrate(state);
    expect(migrated.courses.find((course) => course.id === "extra")?.isExtracurricular).toBe(true);
    expect(migrated.courses.find((course) => course.id === "official")?.isExtracurricular).toBe(false);
  });
});
