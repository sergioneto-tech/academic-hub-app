import { useEffect, useMemo, useState } from "react";
import { formatPtDate } from "@/lib/date";
import {
  ACADEMIC_CALENDAR,
  ACADEMIC_YEAR,
  UAB_LINKS,
  type AcademicEvent,
  type CalendarAlert,
} from "@/lib/uabAcademicCalendar";

export type RuntimeAcademicCalendar = {
  academicYear: string;
  officialSource: string;
  events: AcademicEvent[];
  source: "local" | "cloud";
};

type ApiCalendar = {
  academic_year: string;
  source_url: string;
  payload: {
    academicYear?: string;
    officialSource?: string;
    events?: AcademicEvent[];
  };
};

const CACHE_PREFIX = "academicHub:uabCalendar:";

function validEvent(value: unknown): value is AcademicEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<AcademicEvent>;
  return typeof event.id === "string"
    && typeof event.label === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(event.startDate ?? "")
    && /^\d{4}-\d{2}-\d{2}$/.test(event.endDate ?? "")
    && (event.semester === 0 || event.semester === 1 || event.semester === 2);
}

function fromApi(row: ApiCalendar | null | undefined): RuntimeAcademicCalendar | null {
  const events = row?.payload?.events;
  if (!row || !Array.isArray(events) || events.length < 5 || !events.every(validEvent)) return null;
  return {
    academicYear: row.payload.academicYear || row.academic_year,
    officialSource: row.payload.officialSource || row.source_url || UAB_LINKS.calendarioLetivo,
    events,
    source: "cloud",
  };
}

function readCache(year: string): RuntimeAcademicCalendar | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${year}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RuntimeAcademicCalendar;
    if (parsed.academicYear !== year || !Array.isArray(parsed.events) || !parsed.events.every(validEvent)) return null;
    return { ...parsed, source: "cloud" };
  } catch {
    return null;
  }
}

function localFallback(): RuntimeAcademicCalendar {
  return {
    academicYear: ACADEMIC_YEAR,
    officialSource: UAB_LINKS.despachoCalendario,
    events: ACADEMIC_CALENDAR,
    source: "local",
  };
}

export function useAcademicCalendarRuntime(): RuntimeAcademicCalendar {
  const [calendar, setCalendar] = useState<RuntimeAcademicCalendar>(() => {
    if (typeof window === "undefined") return localFallback();
    return readCache(ACADEMIC_YEAR) ?? localFallback();
  });

  useEffect(() => {
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
    if (!supabaseUrl) return;
    const controller = new AbortController();
    const url = `${supabaseUrl}/functions/v1/uab-calendar-sync?year=${encodeURIComponent(ACADEMIC_YEAR)}`;

    void fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`calendar ${response.status}`);
        return response.json() as Promise<{ calendar?: ApiCalendar | null }>;
      })
      .then((body) => {
        const next = fromApi(body.calendar);
        if (!next || next.academicYear !== ACADEMIC_YEAR) return;
        setCalendar(next);
        try { localStorage.setItem(`${CACHE_PREFIX}${ACADEMIC_YEAR}`, JSON.stringify(next)); } catch { /* cache opcional */ }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Mantém silenciosamente o calendário válido em cache ou o fallback incluído na app.
      });

    return () => controller.abort();
  }, []);

  return calendar;
}

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
  return Math.round((startOfDay(target).getTime() - startOfDay(new Date()).getTime()) / 86400000);
}

function buildAlert(event: AcademicEvent, isOngoing: boolean, daysLeft: number): CalendarAlert {
  const link = event.category === "exams" ? UAB_LINKS.avaliacao : UAB_LINKS.calendarioLetivo;
  return {
    id: event.id,
    label: event.label,
    description: isOngoing
      ? `A decorrer até ${formatPtDate(event.endDate)}` + (daysLeft <= 3 ? ` (${daysLeft === 0 ? "último dia!" : `faltam ${daysLeft} dias`})` : "")
      : `Começa ${daysLeft === 1 ? "amanhã" : `daqui a ${daysLeft} dias`} (${formatPtDate(event.startDate)})`,
    daysLeft,
    icon: event.icon,
    category: event.category,
    isOngoing,
    link,
  };
}

function sortAlerts(items: CalendarAlert[]) {
  return items.sort((a, b) => {
    if (a.isOngoing && !b.isOngoing) return -1;
    if (!a.isOngoing && b.isOngoing) return 1;
    return a.daysLeft - b.daysLeft;
  });
}

export function getRuntimeAcademicDashboardCards(events: AcademicEvent[], limit = 2): CalendarAlert[] {
  const cards: CalendarAlert[] = [];
  for (const event of events) {
    const daysToStart = daysUntil(event.startDate);
    const daysToEnd = daysUntil(event.endDate);
    if (daysToStart === null || daysToEnd === null || daysToEnd < 0) continue;
    const isOngoing = daysToStart <= 0 && daysToEnd >= 0;
    if (!isOngoing && daysToStart <= 0) continue;
    cards.push(buildAlert(event, isOngoing, isOngoing ? daysToEnd : daysToStart));
  }
  return sortAlerts(cards).slice(0, Math.max(1, limit));
}

export function getRuntimeAcademicAlerts(events: AcademicEvent[]): CalendarAlert[] {
  const alerts: CalendarAlert[] = [];
  for (const event of events) {
    const daysToStart = daysUntil(event.startDate);
    const daysToEnd = daysUntil(event.endDate);
    if (daysToStart === null || daysToEnd === null) continue;
    const alertWindow = event.alertDaysBefore ?? 7;
    const isOngoing = daysToStart <= 0 && daysToEnd >= 0;
    const isUpcoming = daysToStart > 0 && daysToStart <= alertWindow;
    const isDeadlineApproaching = event.category === "deadline" && daysToEnd >= 0 && daysToEnd <= alertWindow;
    if (isOngoing || isUpcoming || isDeadlineApproaching) {
      alerts.push(buildAlert(event, isOngoing, isOngoing ? daysToEnd : daysToStart));
    }
  }
  return sortAlerts(alerts);
}

export function useRuntimeAcademicAlerts() {
  const calendar = useAcademicCalendarRuntime();
  const alerts = useMemo(() => getRuntimeAcademicAlerts(calendar.events), [calendar.events]);
  const cards = useMemo(() => getRuntimeAcademicDashboardCards(calendar.events, 2), [calendar.events]);
  return { calendar, alerts, cards };
}
