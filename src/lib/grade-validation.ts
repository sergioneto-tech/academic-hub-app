export const OFFICIAL_FINAL_GRADE_ERROR =
  "A nota final deve ser um valor inteiro entre 0 e 20. Não são permitidas casas decimais.";

export function parseOfficialFinalGrade(input: string): { value: number | null; error: string | null } {
  const raw = String(input ?? "").trim();

  if (!raw) {
    return { value: null, error: null };
  }

  if (!/^\d+$/.test(raw)) {
    return { value: null, error: OFFICIAL_FINAL_GRADE_ERROR };
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 20) {
    return { value: null, error: OFFICIAL_FINAL_GRADE_ERROR };
  }

  return { value, error: null };
}
