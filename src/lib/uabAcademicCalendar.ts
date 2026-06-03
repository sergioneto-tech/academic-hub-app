/**
 * Calendário académico UAb — Cursos de 1.º Ciclo.
 * Fonte atual: Despacho n.º 62/VR/JS/2026 — Calendário Letivo 2026/2027.
 * https://portal.uab.pt/wp-content/uploads/2026/03/Calendario-Letivo-202627_1-ciclo_V2.pdf
 *
 * Mantém os dados do calendário separados do estado do utilizador: atualizar estes
 * prazos não altera cadeiras, notas, histórico, backups ou dados sincronizados.
 */

import { formatPtDate } from "@/lib/date";

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

type AcademicCalendarYear = {
  academicYear: string;
  /** Data a partir da qual este calendário já deve ser considerado para alertas. */
  activeFrom: string;
  /** Data limite operacional do calendário académico. */
  activeUntil: string;
  officialSource: string;
  events: AcademicEvent[];
};

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

const CALENDAR_2026_2027: AcademicCalendarYear = {
  academicYear: "2026/2027",
  // Começa nas primeiras candidaturas publicadas para este ano letivo.
  activeFrom: "2026-03-10",
  activeUntil: "2027-12-31",
  officialSource: "https://portal.uab.pt/wp-content/uploads/2026/03/Calendario-Letivo-202627_1-ciclo_V2.pdf",
  events: [
    // ── Candidaturas ────────────────────────────
    {
      id: "candidaturas-com-provas",
      label: "Candidaturas (com provas)",
      description: "Período de candidaturas com provas de acesso",
      startDate: "2026-03-10",
      endDate: "2026-04-28",
      semester: 0,
      category: "enrollment",
      alertDaysBefore: 14,
      icon: "📋",
    },
    {
      id: "candidaturas-sem-provas",
      label: "Candidaturas (sem provas)",
      description: "Acesso Direto, Reingresso, Mudança de Curso e UCI 1.º ciclo",
      startDate: "2026-05-12",
      endDate: "2026-06-16",
      semester: 0,
      category: "enrollment",
      alertDaysBefore: 14,
      icon: "📋",
    },
    {
      id: "resultados-candidaturas",
      label: "Publicitação de resultados",
      description: "Publicitação dos resultados das candidaturas com provas",
      startDate: "2026-07-22",
      endDate: "2026-07-22",
      semester: 0,
      category: "info",
      alertDaysBefore: 7,
      icon: "📢",
    },

    // ── 1º Semestre ─────────────────────────────
    {
      id: "matriculas-1sem",
      label: "Matrículas e inscrições — 1º semestre",
      description: "Período de matrículas e inscrições do 1º semestre",
      startDate: "2026-08-18",
      endDate: "2026-09-01",
      semester: 1,
      category: "enrollment",
      alertDaysBefore: 14,
      icon: "🎓",
    },
    {
      id: "creditacao-1sem",
      label: "Creditação de competências — 1º semestre",
      description: "Prazo para pedidos de creditação de competências",
      startDate: "2026-09-01",
      endDate: "2026-09-15",
      semester: 1,
      category: "deadline",
      alertDaysBefore: 7,
      icon: "📄",
    },
    {
      id: "ambientacao",
      label: "Módulo de Ambientação",
      description: "Módulo de ambientação para estudantes matriculados pela 1.ª vez na UAb",
      startDate: "2026-09-08",
      endDate: "2026-09-18",
      semester: 1,
      category: "info",
      alertDaysBefore: 7,
      icon: "🧭",
    },
    {
      id: "inicio-1sem",
      label: "Atividades letivas — 1º semestre",
      description: "Período de atividades letivas do 1º semestre",
      startDate: "2026-09-14",
      endDate: "2027-02-26",
      semester: 1,
      category: "classes",
      alertDaysBefore: 7,
      icon: "📚",
    },
    {
      id: "anulacao-1sem",
      label: "Anulação de inscrições — 1º semestre",
      description: "Prazo limite para anular inscrições do 1º semestre",
      startDate: "2026-10-30",
      endDate: "2026-10-30",
      semester: 1,
      category: "deadline",
      alertDaysBefore: 14,
      icon: "⚠️",
    },
    {
      id: "pausa-natal",
      label: "Pausa letiva de Natal",
      description: "Pausa letiva — Natal",
      startDate: "2026-12-21",
      endDate: "2027-01-03",
      semester: 1,
      category: "break",
      alertDaysBefore: 3,
      icon: "🎄",
    },
    {
      id: "avaliacao-1sem",
      label: "Avaliação — 1º semestre",
      description: "Avaliação do 1º semestre — janeiro/fevereiro (consultar calendário de provas)",
      startDate: "2027-01-01",
      endDate: "2027-02-28",
      semester: 1,
      category: "exams",
      alertDaysBefore: 14,
      icon: "📝",
    },

    // ── 2º Semestre ─────────────────────────────
    {
      id: "matriculas-2sem",
      label: "Matrículas e inscrições — 2º semestre",
      description: "Período de matrículas e inscrições do 2º semestre",
      startDate: "2026-11-17",
      endDate: "2026-12-01",
      semester: 2,
      category: "enrollment",
      alertDaysBefore: 14,
      icon: "🎓",
    },
    {
      id: "creditacao-2sem",
      label: "Creditação de competências — 2º semestre",
      description: "Prazo para pedidos de creditação de competências",
      startDate: "2027-02-01",
      endDate: "2027-02-15",
      semester: 2,
      category: "deadline",
      alertDaysBefore: 7,
      icon: "📄",
    },
    {
      id: "inicio-2sem",
      label: "Atividades letivas — 2º semestre",
      description: "Período de atividades letivas do 2º semestre",
      startDate: "2027-03-01",
      endDate: "2027-07-31",
      semester: 2,
      category: "classes",
      alertDaysBefore: 7,
      icon: "📚",
    },
    {
      id: "pausa-pascoa",
      label: "Pausa letiva da Páscoa",
      description: "Pausa letiva — Páscoa",
      startDate: "2027-03-22",
      endDate: "2027-03-28",
      semester: 2,
      category: "break",
      alertDaysBefore: 3,
      icon: "🐣",
    },
    {
      id: "anulacao-2sem",
      label: "Anulação de inscrições — 2º semestre",
      description: "Prazo limite para anular inscrições do 2º semestre",
      startDate: "2027-03-30",
      endDate: "2027-03-30",
      semester: 2,
      category: "deadline",
      alertDaysBefore: 14,
      icon: "⚠️",
    },
    {
      id: "avaliacao-2sem",
      label: "Avaliação — 2º semestre",
      description: "Avaliação do 2º semestre — junho/julho (consultar calendário de provas)",
      startDate: "2027-06-01",
      endDate: "2027-07-31",
      semester: 2,
      category: "exams",
      alertDaysBefore: 14,
      icon: "📝",
    },
    {
      id: "epoca-especial",
      label: "Época especial",
      description: "Época especial de exames — novembro/dezembro",
      startDate: "2027-11-01",
      endDate: "2027-12-31",
      semester: 0,
      category: "exams",
      alertDaysBefore: 14,
      icon: "📝",
    },
  ],
};

const ACADEMIC_CALENDAR_YEARS: AcademicCalendarYear[] = [CALENDAR_2026_2027];

function getCurrentAcademicCalendarYear(referenceDate = new Date()): AcademicCalendarYear {
  const today = startOfDay(referenceDate).getTime();
  const active = ACADEMIC_CALENDAR_YEARS
    .filter((calendar) => {
      const from = parseYmd(calendar.activeFrom)?.getTime() ?? Number.NEGATIVE_INFINITY;
      return from <= today;
    })
    .sort((a, b) => a.academicYear.localeCompare(b.academicYear, "pt-PT"));

  // Escolhe automaticamente o calendário mais recente já publicado/ativo.
  return active[active.length - 1] ?? ACADEMIC_CALENDAR_YEARS[ACADEMIC_CALENDAR_YEARS.length - 1];
}

const CURRENT_CALENDAR = getCurrentAcademicCalendarYear();

export const ACADEMIC_YEAR = CURRENT_CALENDAR.academicYear;
export const ACADEMIC_CALENDAR: AcademicEvent[] = CURRENT_CALENDAR.events;

/** Links úteis do portal UAb */
export const UAB_LINKS = {
  calendarioLetivo: "https://portal.uab.pt/calendario-letivo/",
  avaliacao: "https://portal.uab.pt/avaliacao/",
  calendarioProvas: "https://portal.uab.pt/avaliacao/",
  candidaturas: "https://portal.uab.pt/candidaturas/",
  despachoCalendario: CURRENT_CALENDAR.officialSource,
};

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
          ? `A decorrer até ${formatPtDate(event.endDate)}` + (daysToEnd <= 3 ? ` (${daysToEnd === 0 ? "último dia!" : `faltam ${daysToEnd} dias`})` : "")
          : `Começa ${daysToStart === 1 ? "amanhã" : `daqui a ${daysToStart} dias`} (${formatPtDate(event.startDate)})`,
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
