import { describe, expect, it } from "vitest";

import {
  OFFICIAL_FINAL_GRADE_ERROR,
  parseOfficialFinalGrade,
} from "@/lib/grade-validation";

describe("validação da nota final oficial", () => {
  it("aceita apenas valores inteiros entre 0 e 20", () => {
    expect(parseOfficialFinalGrade("0")).toEqual({ value: 0, error: null });
    expect(parseOfficialFinalGrade("14")).toEqual({ value: 14, error: null });
    expect(parseOfficialFinalGrade("20")).toEqual({ value: 20, error: null });
  });

  it("rejeita classificações com casas decimais", () => {
    expect(parseOfficialFinalGrade("14,4")).toEqual({ value: null, error: OFFICIAL_FINAL_GRADE_ERROR });
    expect(parseOfficialFinalGrade("15.8")).toEqual({ value: null, error: OFFICIAL_FINAL_GRADE_ERROR });
    expect(parseOfficialFinalGrade("14,0")).toEqual({ value: null, error: OFFICIAL_FINAL_GRADE_ERROR });
  });

  it("rejeita valores fora do intervalo oficial", () => {
    expect(parseOfficialFinalGrade("-1")).toEqual({ value: null, error: OFFICIAL_FINAL_GRADE_ERROR });
    expect(parseOfficialFinalGrade("21")).toEqual({ value: null, error: OFFICIAL_FINAL_GRADE_ERROR });
  });

  it("permite limpar o campo", () => {
    expect(parseOfficialFinalGrade("")).toEqual({ value: null, error: null });
    expect(parseOfficialFinalGrade("   ")).toEqual({ value: null, error: null });
  });
});
