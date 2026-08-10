/**
 * Compatibilidade com componentes antigos.
 *
 * As datas de provas deixaram de ser mantidas num mapa estático por ano.
 * Desde 2026/2027 são obtidas do calendário oficial da UAb através de
 * `uab-assessment-sync` e gravadas nos elementos de avaliação ativos.
 */
export type ExamDateEntry = {
  examDate: string | null;
  resitDate: string | null;
  examPeriod?: "M" | "T" | null;
  resitPeriod?: "M" | "T" | null;
};

/**
 * Não fornece datas históricas como fallback, para impedir que um calendário
 * 2025/26 seja confundido com o ano letivo corrente.
 */
export function getExamDates(_code: string, _semester?: number): ExamDateEntry | null {
  return null;
}

/** Página oficial onde a UAb publica as versões atuais dos calendários de provas. */
export const EXAM_CALENDAR_PDF = "https://portal.uab.pt/avaliacao/";
