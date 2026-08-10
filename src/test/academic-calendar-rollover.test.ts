import { describe, expect, it } from "vitest";
import { getAcademicYearForDate } from "@/lib/uabAcademicCalendar";

describe("academic year rollover", () => {
  it("mantém o ano letivo anterior durante julho", () => {
    expect(getAcademicYearForDate(new Date(2027, 6, 31))).toBe("2026/2027");
  });

  it("muda automaticamente para o novo ano letivo em agosto", () => {
    expect(getAcademicYearForDate(new Date(2027, 7, 1))).toBe("2027/2028");
  });

  it("mantém o mesmo ano letivo no primeiro semestre civil seguinte", () => {
    expect(getAcademicYearForDate(new Date(2028, 0, 15))).toBe("2027/2028");
  });
});
