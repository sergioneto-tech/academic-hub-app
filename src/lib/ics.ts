import { getAssessmentCalendarEvents, primaryAssessmentWhen } from "./assessmentCalendar";
import { courseStatusLabel } from "./calculations";
import type { AppState, Assessment } from "./types";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatUtcTimestamp(d: Date): string {
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
  return ymd.replace(/-/g, "");
}

function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function normalizeDateTimeLocal(v: string): { ymd: string; hhmm: string } | null {
  if (!v) return null;

  const datePart = v.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;

  if (!v.includes("T")) {
    return { ymd: datePart, hhmm: "09:00" };
  }

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
  dtStart: string;
  dtEnd?: string;
  alarms?: { trigger: string; description?: string }[];
};

export type IcsExportOptions = {
  /** Exportar apenas cadeiras do semestre indicado (1 ou 2). Se omitido, exporta todas as cadeiras ativas. */
  semester?: 1 | 2;
  /** Se true, inclui eventos já passados. Por defeito (false) exporta apenas eventos futuros. */
  includePast?: boolean;
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

    if (ev.alarms?.length) {
      for (const alarm of ev.alarms) {
        lines.push("BEGIN:VALARM");
        lines.push("ACTION:DISPLAY");
        lines.push(`TRIGGER:${alarm.trigger}`);
        lines.push(`DESCRIPTION:${escapeText(alarm.description ?? ev.summary)}`);
        lines.push("END:VALARM");
      }
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const folded: string[] = [];
  for (const line of lines) {
    if (line.length <= 73) {
      folded.push(line);
      continue;
    }

    let rest = line;
    folded.push(rest.slice(0, 73));
    rest = rest.slice(73);
    while (rest.length) {
      folded.push(" " + rest.slice(0, 72));
      rest = rest.slice(72);
    }
  }

  return folded.join("\r\n") + "\r\n";
}

function courseLine(state: AppState, courseId: string): string {
  const course = state.courses.find((item) => item.id === courseId);
  if (!course) return "Cadeira";
  return `${course.code} — ${course.name}`;
}

function makeUid(prefix: string): string {
  return `${prefix}@academic-hub.local`;
}

function getActiveCourseIds(state: AppState, semester?: 1 | 2): Set<string> {
  return new Set(
    state.courses
      .filter((course) => course.isActive && !course.isCompleted)
      .filter((course) => (semester ? course.semester === semester : true))
      .map((course) => course.id),
  );
}

function isReallyResit(state: AppState, courseId: string): boolean {
  return courseStatusLabel(state, courseId).label === "Recurso";
}

function buildEventsForActiveCourses(state: AppState, opts?: { semester?: 1 | 2 }): IcsEvent[] {
  const active = getActiveCourseIds(state, opts?.semester);
  const events: IcsEvent[] = [];

  for (const assessment of state.assessments) {
    if (!active.has(assessment.courseId)) continue;
    if (assessment.type === "resit" && !isReallyResit(state, assessment.courseId)) continue;

    const courseDesc = courseLine(state, assessment.courseId);

    for (const event of getAssessmentCalendarEvents(assessment)) {
      const normalized = normalizeDateTimeLocal(event.when);
      if (!normalized) continue;

      if (event.kind === "date" && event.timed) {
        const dtStart = dtLocalToIcsDateTime(event.when);
        if (!dtStart) continue;

        events.push({
          uid: makeUid(event.id),
          summary: `${courseDesc} — ${event.title}`,
          description: courseDesc,
          allDay: false,
          dtStart,
          alarms: [{ trigger: "-P1D" }],
        });
        continue;
      }

      const ymd = normalized.ymd;
      events.push({
        uid: makeUid(event.id),
        summary: `${courseDesc} — ${event.title}`,
        description: courseDesc,
        allDay: true,
        dtStart: ymdToBasic(ymd),
        dtEnd: ymdToBasic(addDaysToYmd(ymd, 1)),
        alarms: [{ trigger: event.kind === "date" ? "-P1D" : "PT9H" }],
      });
    }
  }

  // Sessões (ex.: abertura, antes de atividades ou antes de exame)
  for (const course of state.courses) {
    if (!active.has(course.id)) continue;
    const sessions = course.sessions;
    if (!Array.isArray(sessions) || sessions.length === 0) continue;

    const courseDesc = courseLine(state, course.id);

    for (const session of sessions) {
      const dtStart = dtLocalToIcsDateTime(String(session.dateTime ?? ""));
      if (!dtStart) continue;

      const title = String(session.title ?? "Sessão").trim() || "Sessão";

      events.push({
        uid: makeUid(`${course.id}-session-${session.id || dtStart}`),
        summary: `${courseDesc} — Sessão: ${title}`,
        description: courseDesc,
        allDay: false,
        dtStart,
        alarms: [{ trigger: "-P1D" }],
      });
    }
  }

  events.sort((a, b) => a.dtStart.localeCompare(b.dtStart));
  return events;
}

function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function eventStartYmd(ev: IcsEvent): string {
  const s = ev.dtStart.slice(0, 8);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function filterFutureEvents(events: IcsEvent[], includePast?: boolean): IcsEvent[] {
  if (includePast) return events;
  const today = localTodayYmd();
  return events.filter((event) => eventStartYmd(event) >= today);
}

export function buildIcsForActiveCourses(state: AppState, opts?: IcsExportOptions): string {
  const events = filterFutureEvents(
    buildEventsForActiveCourses(state, { semester: opts?.semester }),
    opts?.includePast,
  );
  return buildIcs(events, "Academic Hub (UAb)");
}

export function downloadIcs(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function suggestIcsFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `academic-hub-${y}-${m}-${day}.ics`;
}

export function formatAssessmentWhen(assessment: Assessment): string {
  return primaryAssessmentWhen(assessment);
}
