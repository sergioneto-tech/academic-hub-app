import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppState } from "@/hooks/useAppState";
import { Calendar as CalendarIcon, BookOpen } from "lucide-react";
import { format, parseISO, isAfter, isBefore, isToday } from "date-fns";
import { pt } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  title: string;
  date: Date;
  type: "inicio" | "fim" | "exame";
}

export default function CalendarPage() {
  const { state } = useAppState();

  const events: CalendarEvent[] = [];

  state.activeCourses
    .filter((c) => c.ativa && !c.concluida)
    .forEach((course) => {
      const courseAssessments = state.assessments.filter(
        (a) => a.courseId === course.id
      );

      courseAssessments.forEach((assessment) => {
        if (assessment.dataInicio) {
          events.push({
            id: `${assessment.id}-inicio`,
            courseId: course.id,
            courseName: course.nome,
            courseCode: course.codigo,
            title: `${assessment.nome} - Início`,
            date: parseISO(assessment.dataInicio),
            type: "inicio",
          });
        }
        if (assessment.dataFim) {
          events.push({
            id: `${assessment.id}-fim`,
            courseId: course.id,
            courseName: course.nome,
            courseCode: course.codigo,
            title: `${assessment.nome} - Fim`,
            date: parseISO(assessment.dataFim),
            type: "fim",
          });
        }
        if (assessment.dataExame) {
          events.push({
            id: `${assessment.id}-exame`,
            courseId: course.id,
            courseName: course.nome,
            courseCode: course.codigo,
            title: assessment.nome,
            date: parseISO(assessment.dataExame),
            type: "exame",
          });
        }
      });
    });

  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  const now = new Date();
  const upcomingEvents = events.filter(
    (e) => isAfter(e.date, now) || isToday(e.date)
  );
  const pastEvents = events.filter(
    (e) => isBefore(e.date, now) && !isToday(e.date)
  );

  const getTypeColor = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "inicio":
        return "bg-info/10 text-info border-info/20";
      case "fim":
        return "bg-warning/10 text-warning border-warning/20";
      case "exame":
        return "bg-destructive/10 text-destructive border-destructive/20";
    }
  };

  const getTypeLabel = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "inicio":
        return "Início";
      case "fim":
        return "Entrega";
      case "exame":
        return "Exame";
    }
  };

  const renderEvent = (event: CalendarEvent) => (
    <div
      key={event.id}
      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border bg-card"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          {event.type === "exame" ? (
            <CalendarIcon className="h-5 w-5 text-primary" />
          ) : (
            <BookOpen className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{event.title}</p>
          <p className="text-sm text-muted-foreground truncate">
            {event.courseCode} - {event.courseName}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:flex-col sm:items-end">
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full border ${getTypeColor(
            event.type
          )}`}
        >
          {getTypeLabel(event.type)}
        </span>
        <time className="text-sm font-medium">
          {format(event.date, "d MMM yyyy", { locale: pt })}
        </time>
      </div>
    </div>
  );

  return (
    <Layout title="Calendário">
      <div className="space-y-6">
        {/* Upcoming */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Próximos Eventos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Sem eventos futuros agendados.
              </p>
            ) : (
              upcomingEvents.map(renderEvent)
            )}
          </CardContent>
        </Card>

        {/* Past */}
        {pastEvents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground">
                Eventos Passados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 opacity-60">
              {pastEvents.map(renderEvent)}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
