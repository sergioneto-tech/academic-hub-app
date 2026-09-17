import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, Clock3, History, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "@/lib/AppStore";
import { getAssessmentCalendarEvents } from "@/lib/assessmentCalendar";
import { buildIcsForActiveCourses, downloadIcs, suggestIcsFilename } from "@/lib/ics";
import { formatPtDate } from "@/lib/date";

type EventItem = { id: string; when: string; title: string; subtitle: string; tag: string; courseId: string; courseCode: string; courseName: string };

const COURSE_TONES = [
  { bar: "bg-blue-500", soft: "bg-blue-500/10", border: "border-blue-500/30", badge: "bg-blue-500/15 text-blue-700 dark:text-blue-200" },
  { bar: "bg-emerald-500", soft: "bg-emerald-500/10", border: "border-emerald-500/30", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200" },
  { bar: "bg-amber-500", soft: "bg-amber-500/10", border: "border-amber-500/30", badge: "bg-amber-500/15 text-amber-800 dark:text-amber-200" },
  { bar: "bg-violet-500", soft: "bg-violet-500/10", border: "border-violet-500/30", badge: "bg-violet-500/15 text-violet-700 dark:text-violet-200" },
  { bar: "bg-rose-500", soft: "bg-rose-500/10", border: "border-rose-500/30", badge: "bg-rose-500/15 text-rose-700 dark:text-rose-200" },
  { bar: "bg-cyan-500", soft: "bg-cyan-500/10", border: "border-cyan-500/30", badge: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200" },
];

function localTodayYmd() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function shortDate(when: string) {
  const [year, month, day] = when.slice(0, 10).split("-");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${day}/${months[Number(month) - 1] || month}/${year}`;
}

function EventTile({ event, tone, muted = false }: { event: EventItem; tone: (typeof COURSE_TONES)[number]; muted?: boolean }) {
  const time = event.when.includes("T") ? event.when.slice(11, 16) : "";
  return (
    <div className={`min-w-[180px] flex-1 rounded-xl border p-3.5 ${muted ? "border-border bg-muted/30" : `${tone.border} bg-background/70 dark:bg-background/35`}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`rounded-md px-2 py-1 text-xs font-bold ${muted ? "bg-muted text-muted-foreground" : tone.badge}`}>{shortDate(event.when)}</span>
        {time && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" />{time}</span>}
      </div>
      <div className="mt-3 line-clamp-2 font-semibold leading-snug text-foreground">{event.title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{event.tag}</div>
    </div>
  );
}

export default function CalendarPage() {
  const { state } = useAppStore();
  const [exportMode, setExportMode] = useState<"future" | "sem1" | "sem2" | "all">("future");
  const [semester, setSemester] = useState<"all" | "1" | "2">("all");
  const [showHistory, setShowHistory] = useState(false);

  const events = useMemo(() => {
    const result: EventItem[] = [];
    for (const assessment of state.assessments) {
      const course = state.courses.find((item) => item.id === assessment.courseId);
      if (!course || !course.isActive) continue;
      for (const event of getAssessmentCalendarEvents(assessment)) {
        result.push({ id: event.id, when: event.when, title: event.title, subtitle: `${course.code} - ${course.name}`, tag: event.tag, courseId: course.id, courseCode: course.code, courseName: course.name });
      }
    }
    for (const course of state.courses) {
      if (!course.isActive || !Array.isArray(course.sessions)) continue;
      for (const session of course.sessions) {
        const when = String(session.dateTime ?? "");
        if (!when) continue;
        const time = when.includes("T") ? when.slice(11, 16) : "";
        const title = String(session.title ?? "Sessão").trim() || "Sessão";
        result.push({ id: `${course.id}-session-${session.id || when}`, when, title: `Sessão — ${title}`, subtitle: `${course.code} - ${course.name}`, tag: time ? `Sessão (${time})` : "Sessão", courseId: course.id, courseCode: course.code, courseName: course.name });
      }
    }
    return result;
  }, [state.assessments, state.courses]);

  const today = localTodayYmd();
  const activeCourses = state.courses.filter((course) => course.isActive && (semester === "all" || String(course.semester) === semester));
  const future = events.filter((event) => event.when.slice(0, 10) >= today).sort((a, b) => a.when.localeCompare(b.when));
  const past = events.filter((event) => event.when.slice(0, 10) < today).sort((a, b) => b.when.localeCompare(a.when));

  function handleExportIcs() {
    const opts = { semester: exportMode === "sem1" ? (1 as const) : exportMode === "sem2" ? (2 as const) : undefined, includePast: exportMode === "all" };
    downloadIcs(suggestIcsFilename(), buildIcsForActiveCourses(state, opts));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-2xl font-semibold"><CalendarDays className="h-6 w-6 text-primary" />Calendário</div>
          <div className="mt-1 text-sm text-muted-foreground">Datas organizadas por cadeira para uma leitura mais rápida.</div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={semester} onValueChange={(value) => setSemester(value as typeof semester)}>
            <SelectTrigger className="w-full sm:w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Cadeiras ativas</SelectItem><SelectItem value="1">1.º semestre</SelectItem><SelectItem value="2">2.º semestre</SelectItem></SelectContent>
          </Select>
          <Select value={exportMode} onValueChange={(value) => setExportMode(value as typeof exportMode)}>
            <SelectTrigger className="w-full sm:w-[235px]"><SelectValue placeholder="Exportar…" /></SelectTrigger>
            <SelectContent><SelectItem value="future">Eventos futuros</SelectItem><SelectItem value="sem1">1.º semestre — futuros</SelectItem><SelectItem value="sem2">2.º semestre — futuros</SelectItem><SelectItem value="all">Ano completo</SelectItem></SelectContent>
          </Select>
          <Button variant="secondary" onClick={handleExportIcs}><Smartphone className="mr-2 h-4 w-4" />Exportar (.ics)</Button>
          <Button variant={showHistory ? "default" : "outline"} onClick={() => setShowHistory((value) => !value)}><History className="mr-2 h-4 w-4" />{showHistory ? "Ocultar histórico" : "Histórico"}</Button>
        </div>
      </div>

      <div className="space-y-3">
        {activeCourses.map((course, index) => {
          const tone = COURSE_TONES[index % COURSE_TONES.length];
          const courseEvents = future.filter((event) => event.courseId === course.id);
          return (
            <Card key={course.id} className={`relative overflow-hidden border ${tone.border} shadow-sm`}>
              <span className={`absolute inset-y-0 left-0 w-1.5 ${tone.bar}`} />
              <CardContent className={`p-0 ${tone.soft}`}>
                <div className="grid gap-3 p-4 pl-5 lg:grid-cols-[250px_minmax(0,1fr)_auto] lg:items-stretch">
                  <div className="flex min-w-0 flex-col justify-center">
                    <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{course.code}</div>
                    <div className="mt-1 break-words text-lg font-semibold leading-tight text-foreground">{course.name}</div>
                    <div className="mt-2 text-xs text-muted-foreground">{courseEvents.length} {courseEvents.length === 1 ? "próximo evento" : "próximos eventos"}</div>
                  </div>
                  <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
                    {courseEvents.length ? courseEvents.map((event) => <EventTile key={event.id} event={event} tone={tone} />) : <div className="flex min-h-[105px] flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-background/45 px-4 text-sm text-muted-foreground">Sem eventos futuros registados.</div>}
                  </div>
                  <div className="hidden items-center lg:flex"><ChevronRight className="h-5 w-5 text-muted-foreground" /></div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {activeCourses.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Não existem cadeiras ativas para este filtro.</div>}
      </div>

      {showHistory && (
        <Card className="border-border bg-muted/15">
          <CardContent className="p-4 sm:p-5">
            <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setShowHistory(false)}>
              <div><div className="font-semibold">Histórico de eventos</div><div className="mt-1 text-xs text-muted-foreground">Datas anteriores a {formatPtDate(today)}.</div></div>
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {past.length ? past.slice(0, 30).map((event, index) => <EventTile key={event.id} event={event} tone={COURSE_TONES[index % COURSE_TONES.length]} muted />) : <div className="text-sm text-muted-foreground">Sem eventos passados.</div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
