import type { AppState, Assessment } from "./types";
import { courseStatusLabel } from "./calculations";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatUtcTimestamp(d: Date): string {
  // YYYYMMDDTHHMMSSZ
  return (
    String(d.getUTCFullYear()) +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

function ymdToBasic(ymd: string): string {
  // YYYY-MM-DD -> YYYYMMDD
  return ymd.replace(/-/g, "");
}

function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function escapeText(value: string): string {
  // RFC 5545 text escaping
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function normalizeDateTimeLocal(v: string): { ymd: string; hhmm: string } | null {
  // Accept:
  // - YYYY-MM-DD
  // - YYYY-MM-DDTHH:MM
  // - YYYY-MM-DDTHH:MM:SS
  // - ISO with timezone -> we take local date/time part if present
  if (!v) return null;

  const datePart = v.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;

  if (!v.includes("T")) {
    return { ymd: datePart, hhmm: "09:00" }; // fallback
  }

  // Try HH:MM from positions 11..15
  const timePart = v.slice(11, 16);
  if (/^\d{2}:\d{2}$/.test(timePart)) {
    return { ymd: datePart, hhmm: timePart };
  }

  return { ymd: datePart, hhmm: "09:00" };
}

function dtLocalToIcsDateTime(v: string): string | null {
  const p = normalizeDateTimeLocal(v);
  if (!p) return null;
  const basic = ymdToBasic(p.ymd);
  const hh = p.hhmm.slice(0, 2);
  const mm = p.hhmm.slice(3, 5);
  return `${basic}T${hh}${mm}00`;
}

type IcsEvent = {
  uid: string;
  summary: string;
  description?: string;
  allDay: boolean;
  dtStart: string; // either YYYYMMDD or YYYYMMDDTHHMMSS
  dtEnd?: string; // for all-day, YYYYMMDD; for date-time, YYYYMMDDTHHMMSS
  alarms?: { trigger: string; description?: string }[];
};

function buildIcs(events: IcsEvent[], calendarName = "Academic Hub"): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("PRODID:-//Academic Hub//UAb Planner//PT");
  lines.push(`X-WR-CALNAME:${escapeText(calendarName)}`);

  const dtstamp = formatUtcTimestamp(new Date());

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeText(ev.uid)}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`SUMMARY:${escapeText(ev.summary)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);

    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${ev.dtStart}`);
      if (ev.dtEnd) lines.push(`DTEND;VALUE=DATE:${ev.dtEnd}`);
    } else {
      lines.push(`DTSTART:${ev.dtStart}`);
      if (ev.dtEnd) lines.push(`DTEND:${ev.dtEnd}`);
    }

    if (ev.alarms && ev.alarms.length) {
      for (const a of ev.alarms) {
        lines.push("BEGIN:VALARM");
        lines.push("ACTION:DISPLAY");
        lines.push(`TRIGGER:${a.trigger}`);
        lines.push(`DESCRIPTION:${escapeText(a.description ?? ev.summary)}`);
        lines.push("END:VALARM");
      }
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // Line folding (RFC 5545) — split long lines into CRLF + space continuations
  const folded: string[] = [];
  for (const l of lines) {
    if (l.length <= 73) {
      folded.push(l);
      continue;
    }
    let rest = l;
    folded.push(rest.slice(0, 73));
    rest = rest.slice(73);
    while (rest.length) {
      folded.push(" " + rest.slice(0, 72));
      rest = rest.slice(72);
    }
  }

  // Use CRLF per RFC
  return folded.join("\r\n") + "\r\n";
}

function courseLine(state: AppState, courseId: string): string {
  const c = state.courses.find((x) => x.id === courseId);
  if (!c) return "Cadeira";
  return `${c.code} — ${c.name}`;
}

function makeUid(prefix: string): string {
  return `${prefix}@academic-hub.local`;
}

function getActiveCourseIds(state: AppState): Set<string> {
  return new Set(state.courses.filter((c) => c.isActive && !c.isCompleted).map((c) => c.id));
}

function isReallyResit(state: AppState, courseId: string): boolean {
  return courseStatusLabel(state, courseId).label === "Recurso";
}

function buildEventsForActiveCourses(state: AppState): IcsEvent[] {
  const active = getActiveCourseIds(state);
  const events: IcsEvent[] = [];

  for (const a of state.assessments) {
    if (!active.has(a.courseId)) continue;

    const courseDesc = courseLine(state, a.courseId);

    if (a.type === "efolio") {
      if (a.startDate) {
        const dt = ymdToBasic(a.startDate);
        events.push({
          uid: makeUid(`${a.id}-start`),
          summary: `${courseDesc} — ${a.name} (Início)`,
          description: courseDesc,
          allDay: true,
          dtStart: dt,
          dtEnd: ymdToBasic(addDaysToYmd(a.startDate, 1)),
          // All-day event, but remind at 09:00 local (9h after midnight)
          alarms: [{ trigger: "PT9H" }],
        });
      }
      if (a.endDate) {
        const dt = ymdToBasic(a.endDate);
        events.push({
          uid: makeUid(`${a.id}-end`),
          summary: `${courseDesc} — ${a.name} (Fim / Entrega)`,
          description: courseDesc,
          allDay: true,
          dtStart: dt,
          dtEnd: ymdToBasic(addDaysToYmd(a.endDate, 1)),
          // All-day event, but remind at 09:00 local (9h after midnight)
          alarms: [{ trigger: "PT9H" }],
        });
      }
      continue;
    }

    // exam / resit
    if (!a.date) continue;

    if (a.type === "resit" && !isReallyResit(state, a.courseId)) {
      continue; // só exporta recurso quando for mesmo Recurso
    }

    const dtStart = dtLocalToIcsDateTime(a.date);
    if (!dtStart) continue;

    const label = a.type === "exam" ? "Exame" : "Recurso";
    events.push({
      uid: makeUid(`${a.id}-${a.type}`),
      summary: `${courseDesc} — ${label}`,
      description: courseDesc,
      allDay: false,
      dtStart,
      alarms: [{ trigger: "-P1D" }],
    });
  }

  // Ordenar: all-day por data, date-time por data/hora
  events.sort((a, b) => {
    const aa = a.allDay ? a.dtStart : a.dtStart;
    const bb = b.allDay ? b.dtStart : b.dtStart;
    return aa.localeCompare(bb);
  });

  return events;
}

export function buildIcsForActiveCourses(state: AppState): string {
  const events = buildEventsForActiveCourses(state);
  return buildIcs(events, "Academic Hub (UAb)");
}

export function downloadIcs(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function suggestIcsFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `academic-hub-${y}-${m}-${day}.ics`;
}

// Small helper for UI
export function formatAssessmentWhen(a: Assessment): string {
  if (a.type === "efolio") {
    return a.endDate ?? a.startDate ?? "";
  }
  return a.date ?? "";
}
