import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/lib/AppStore";
import { getAssessmentCalendarEvents } from "@/lib/assessmentCalendar";
import { buildIcsForActiveCourses, downloadIcs, suggestIcsFilename } from "@/lib/ics";
import { formatPtDate } from "@/lib/date";

type EventItem = { id: string; when: string; title: string; subtitle: string; tag: string };

function EventRow({ event, muted = false }: { event: EventItem; muted?: boolean }) {
  return (
    <div
      className={`grid min-w-0 grid-cols-[minmax(0,1fr)_104px] items-center gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_120px] sm:p-4 ${
        muted ? "border-muted-foreground/20 bg-muted/30" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="break-words font-medium leading-snug text-muted-foreground">{event.title}</div>
        <div className="mt-1 break-words text-sm leading-snug text-muted-foreground/80">{event.subtitle}</div>
      </div>

      <div className="min-w-0 text-right">
        <div className="whitespace-nowrap text-[13px] font-semibold leading-tight text-muted-foreground sm:text-sm">
          {formatPtDate(event.when)}
        </div>
        <div className="mt-1 break-words text-xs leading-tight text-muted-foreground/70">{event.tag}</div>
      </div>
    </div>
  );
}

function localTodayYmd(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CalendarPage() {
  const { state } = useAppStore();

  const [exportMode, setExportMode] = useState<"future" | "sem1" | "sem2" | "all">("future");

  function handleExportIcs() {
    const opts = {
      semester: exportMode === "sem1" ? (1 as const) : exportMode === "sem2" ? (2 as const) : undefined,
      includePast: exportMode === "all",
    };
    const ics = buildIcsForActiveCourses(state, opts);
    downloadIcs(suggestIcsFilename(), ics);
  }

  const events: EventItem[] = [];

  for (const assessment of state.assessments) {
    const course = state.courses.find((item) => item.id === assessment.courseId);
    const courseLine = course ? `${course.code} - ${course.name}` : "Cadeira";

    for (const event of getAssessmentCalendarEvents(assessment)) {
      events.push({
        id: event.id,
        when: event.when,
        title: event.title,
        subtitle: courseLine,
        tag: event.tag,
      });
    }
  }

  // Sessões por cadeira (ex.: abertura, antes de atividades ou antes de exame)
  for (const course of state.courses) {
    if (!course.isActive) continue;
    const courseLine = `${course.code} - ${course.name}`;
    const sessions = course.sessions;
    if (!Array.isArray(sessions)) continue;

    for (const session of sessions) {
      const when = String(session.dateTime ?? "");
      if (!when) continue;

      const time = when.includes("T") ? when.slice(11, 16) : "";
      const title = String(session.title ?? "Sessão").trim() || "Sessão";

      events.push({
        id: `${course.id}-session-${session.id || when}`,
        when,
        title: `Sessão — ${title}`,
        subtitle: courseLine,
        tag: time ? `Sessão (${time})` : "Sessão",
      });
    }
  }

  const today = localTodayYmd();
  const future = events.filter((event) => event.when.slice(0, 10) >= today).sort((a, b) => a.when.localeCompare(b.when));
  const past = events.filter((event) => event.when.slice(0, 10) < today).sort((a, b) => b.when.localeCompare(a.when));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-2xl font-semibold">Calendário</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={exportMode} onValueChange={(value) => setExportMode(value as typeof exportMode)}>
            <SelectTrigger className="w-full sm:w-[260px]">
              <SelectValue placeholder="Exportar…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="future">Apenas eventos futuros (todas as cadeiras)</SelectItem>
              <SelectItem value="sem1">1º semestre (apenas eventos futuros)</SelectItem>
              <SelectItem value="sem2">2º semestre (apenas eventos futuros)</SelectItem>
              <SelectItem value="all">Ano completo (inclui eventos passados)</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="secondary" onClick={handleExportIcs}>
            Exportar para o telemóvel (.ics)
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximos Eventos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {future.length === 0 ? (
            <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
              Sem eventos futuros agendados.
            </div>
          ) : (
            future.map((event) => <EventRow key={event.id} event={event} />)
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-muted/20">
        <CardHeader>
          <CardTitle>Eventos Passados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {past.slice(0, 20).map((event) => (
            <EventRow key={event.id} event={event} muted />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
