/**
 * Calendário académico UAb 2025/2026 — Cursos de 1.º Ciclo.
 * Fonte: Despacho nº 54/VR/JS/2025
 * https://portal.uab.pt/wp-content/uploads/2025/10/Despacho_54VRJS_2025_CalendarioLetivo_202526_1Ciclo_V3.pdf
 *
 * NOTA: atualizar anualmente com os novos despachos.
 */

export type AcademicEvent = {
  id: string;
  label: string;
  /** Descrição curta para o alerta */
  description: string;
  /** Data início (YYYY-MM-DD) */
  startDate: string;
  /** Data fim (YYYY-MM-DD) — pode ser igual a startDate se for dia único */
  endDate: string;
  /** Semestre a que se refere (0 = geral, 1 = 1º sem, 2 = 2º sem) */
  semester: 0 | 1 | 2;
  /** Categoria do evento */
  category: "enrollment" | "classes" | "exams" | "break" | "deadline" | "info";
  /** Quantos dias antes do início alertar (default: 7) */
  alertDaysBefore?: number;
  /** Ícone emoji */
  icon: string;
};

export const ACADEMIC_YEAR = "2025/2026";

export const ACADEMIC_CALENDAR: AcademicEvent[] = [
  // ── 1ª Fase ──────────────────────────────────
  {
    id: "candidaturas-1fase-provas",
    label: "Candidaturas 1ª fase (com provas)",
    description: "Período de candidaturas com provas de acesso",
    startDate: "2025-03-13",
    endDate: "2025-05-06",
    semester: 0,
    category: "enrollment",
    alertDaysBefore: 14,
    icon: "📋",
  },
  {
    id: "candidaturas-1fase-sem-provas",
    label: "Candidaturas 1ª fase (sem provas)",
    description: "Período de candidaturas sem provas de acesso",
    startDate: "2025-05-13",
    endDate: "2025-06-17",
    semester: 0,
    category: "enrollment",
    alertDaysBefore: 14,
    icon: "📋",
  },

  // ── 2ª Fase ──────────────────────────────────
  {
    id: "candidaturas-2fase-provas",
    label: "Candidaturas 2ª fase (com provas)",
    description: "Período de candidaturas com provas de acesso — 2ª fase",
    startDate: "2025-09-16",
    endDate: "2025-10-07",
    semester: 0,
    category: "enrollment",
    alertDaysBefore: 14,
    icon: "📋",
  },
  {
    id: "candidaturas-2fase-sem-provas",
    label: "Candidaturas 2ª fase (sem provas)",
    description: "Período de candidaturas sem provas — 2ª fase",
    startDate: "2025-10-21",
    endDate: "2025-11-18",
    semester: 0,
    category: "enrollment",
    alertDaysBefore: 14,
    icon: "📋",
  },

  // ── 1º Semestre ──────────────────────────────
  {
    id: "matriculas-1sem",
    label: "Matrículas e inscrições — 1º semestre",
    description: "Período de matrículas do 1º semestre",
    startDate: "2025-08-19",
    endDate: "2025-09-02",
    semester: 1,
    category: "enrollment",
    alertDaysBefore: 14,
    icon: "🎓",
  },
  {
    id: "anulacao-1sem",
    label: "Anulação de inscrições — 1º semestre",
    description: "Prazo limite para anular inscrições do 1º semestre",
    startDate: "2025-11-30",
    endDate: "2025-11-30",
    semester: 1,
    category: "deadline",
    alertDaysBefore: 14,
    icon: "⚠️",
  },
  {
    id: "ambientacao",
    label: "Módulo de Ambientação",
    description: "Módulo de ambientação (1ª vez na UAb)",
    startDate: "2025-09-15",
    endDate: "2025-09-26",
    semester: 1,
    category: "info",
    alertDaysBefore: 7,
    icon: "🧭",
  },
  {
    id: "inicio-1sem",
    label: "Início das atividades letivas — 1º semestre",
    description: "Início do 1º semestre letivo",
    startDate: "2025-10-06",
    endDate: "2026-02-27",
    semester: 1,
    category: "classes",
    alertDaysBefore: 7,
    icon: "📚",
  },
  {
    id: "pausa-natal",
    label: "Pausa letiva de Natal",
    description: "Pausa letiva — férias de Natal",
    startDate: "2025-12-22",
    endDate: "2026-01-04",
    semester: 1,
    category: "break",
    alertDaysBefore: 3,
    icon: "🎄",
  },
  {
    id: "provas-normais-1sem",
    label: "Provas normais — 1º semestre",
    description: "Época normal de exames do 1º semestre (janeiro e fevereiro)",
    startDate: "2026-01-26",
    endDate: "2026-02-19",
    semester: 1,
    category: "exams",
    alertDaysBefore: 14,
    icon: "📝",
  },
  {
    id: "provas-recurso-1sem",
    label: "Provas de recurso — 1º semestre",
    description: "Época de recurso do 1º semestre (julho)",
    startDate: "2026-07-06",
    endDate: "2026-07-24",
    semester: 1,
    category: "exams",
    alertDaysBefore: 14,
    icon: "🔄",
  },

  // ── 2º Semestre ──────────────────────────────
  {
    id: "matriculas-2sem",
    label: "Matrículas e inscrições — 2º semestre",
    description: "Período de matrículas do 2º semestre — NÃO TE ESQUEÇAS!",
    startDate: "2025-11-11",
    endDate: "2025-11-23",
    semester: 2,
    category: "enrollment",
    alertDaysBefore: 14,
    icon: "🎓",
  },
  {
    id: "matriculas-2sem-2fase",
    label: "Matrículas 2º semestre — 2ª fase",
    description: "Período de matrículas do 2º semestre (2ª fase)",
    startDate: "2026-01-06",
    endDate: "2026-01-20",
    semester: 2,
    category: "enrollment",
    alertDaysBefore: 14,
    icon: "🎓",
  },
  {
    id: "anulacao-2sem",
    label: "Anulação de inscrições — 2º semestre",
    description: "Prazo limite para anular inscrições do 2º semestre",
    startDate: "2026-04-30",
    endDate: "2026-04-30",
    semester: 2,
    category: "deadline",
    alertDaysBefore: 14,
    icon: "⚠️",
  },
  {
    id: "credenciacao",
    label: "Pedidos de creditação de competências",
    description: "Prazo para pedidos de creditação de competências",
    startDate: "2026-02-01",
    endDate: "2026-02-15",
    semester: 2,
    category: "deadline",
    alertDaysBefore: 7,
    icon: "📄",
  },
  {
    id: "inicio-2sem",
    label: "Início das atividades letivas — 2º semestre",
    description: "Início do 2º semestre letivo",
    startDate: "2026-03-02",
    endDate: "2026-07-31",
    semester: 2,
    category: "classes",
    alertDaysBefore: 7,
    icon: "📚",
  },
  {
    id: "pausa-pascoa",
    label: "Pausa letiva da Páscoa",
    description: "Pausa letiva — férias da Páscoa",
    startDate: "2026-03-30",
    endDate: "2026-04-05",
    semester: 2,
    category: "break",
    alertDaysBefore: 3,
    icon: "🐣",
  },
  {
    id: "provas-normais-2sem",
    label: "Provas normais — 2º semestre",
    description: "Época normal de exames do 2º semestre (junho e julho)",
    startDate: "2026-06-01",
    endDate: "2026-07-24",
    semester: 2,
    category: "exams",
    alertDaysBefore: 14,
    icon: "📝",
  },
  {
    id: "provas-recurso-2sem",
    label: "Provas de recurso — 2º semestre",
    description: "Época de recurso do 2º semestre (setembro)",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    semester: 2,
    category: "exams",
    alertDaysBefore: 14,
    icon: "🔄",
  },
  {
    id: "epoca-especial",
    label: "Época especial",
    description: "Época especial de exames (novembro e dezembro)",
    startDate: "2026-11-01",
    endDate: "2026-12-31",
    semester: 0,
    category: "exams",
    alertDaysBefore: 14,
    icon: "📝",
  },
];

/** Links úteis do portal UAb */
export const UAB_LINKS = {
  calendarioLetivo: "https://portal.uab.pt/calendario-letivo/",
  avaliacao: "https://portal.uab.pt/avaliacao/",
  calendarioProvas: "https://portal.uab.pt/avaliacao/",
  candidaturas: "https://portal.uab.pt/candidaturas/",
  despachoCalendario: "https://portal.uab.pt/wp-content/uploads/2025/10/Despacho_54VRJS_2025_CalendarioLetivo_202526_1Ciclo_V3.pdf",
};

// ── Helpers ────────────────────────────────────

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(ymd)) return null;
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysUntil(ymd: string): number | null {
  const target = parseYmd(ymd);
  if (!target) return null;
  const today = startOfDay(new Date());
  return Math.round((startOfDay(target).getTime() - today.getTime()) / 86400000);
}

export type CalendarAlert = {
  id: string;
  label: string;
  description: string;
  daysLeft: number;
  icon: string;
  category: AcademicEvent["category"];
  /** Whether the event is currently ongoing */
  isOngoing: boolean;
  /** Link to portal */
  link?: string;
};

/** Build alerts for upcoming academic events */
export function getAcademicAlerts(): CalendarAlert[] {
  const alerts: CalendarAlert[] = [];

  for (const event of ACADEMIC_CALENDAR) {
    const daysToStart = daysUntil(event.startDate);
    const daysToEnd = daysUntil(event.endDate);
    if (daysToStart === null || daysToEnd === null) continue;

    const alertWindow = event.alertDaysBefore ?? 7;
    const isOngoing = daysToStart <= 0 && daysToEnd >= 0;
    const isUpcoming = daysToStart > 0 && daysToStart <= alertWindow;

    // Alert for deadline events when approaching end date
    const isDeadlineApproaching =
      event.category === "deadline" && daysToEnd >= 0 && daysToEnd <= alertWindow;

    if (isOngoing || isUpcoming || isDeadlineApproaching) {
      let link: string | undefined;
      if (event.category === "enrollment") link = UAB_LINKS.calendarioLetivo;
      else if (event.category === "exams") link = UAB_LINKS.avaliacao;
      else link = UAB_LINKS.calendarioLetivo;

      alerts.push({
        id: event.id,
        label: event.label,
        description: isOngoing
          ? `A decorrer até ${formatDate(event.endDate)}` + (daysToEnd <= 3 ? ` (${daysToEnd === 0 ? "último dia!" : `faltam ${daysToEnd} dias`})` : "")
          : `Começa ${daysToStart === 1 ? "amanhã" : `daqui a ${daysToStart} dias`} (${formatDate(event.startDate)})`,
        daysLeft: isOngoing ? daysToEnd : daysToStart,
        icon: event.icon,
        category: event.category,
        isOngoing,
        link,
      });
    }
  }

  return alerts.sort((a, b) => {
    // Ongoing first, then by days left
    if (a.isOngoing && !b.isOngoing) return -1;
    if (!a.isOngoing && b.isOngoing) return 1;
    return a.daysLeft - b.daysLeft;
  });
}

function formatDate(ymd: string): string {
  const d = parseYmd(ymd);
  if (!d) return ymd;
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}
