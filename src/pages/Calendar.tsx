import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/AppStore";

type EventItem = { when: string; title: string; subtitle: string; tag: string };

export default function CalendarPage() {
  const { state } = useAppStore();

  const events: EventItem[] = [];

  for (const a of state.assessments) {
    const course = state.courses.find(c => c.id === a.courseId);
    const courseLine = course ? `${course.code} - ${course.name}` : "Cadeira";

    if (a.type === "efolio") {
      if (a.startDate) events.push({ when: a.startDate, title: `${a.name} - Início`, subtitle: courseLine, tag: "Início" });
      if (a.endDate) events.push({ when: a.endDate, title: `${a.name} - Fim`, subtitle: courseLine, tag: "Entrega" });
    } else {
      if (a.date) events.push({ when: a.date, title: a.type === "exame" ? `${a.name} (Exame)` : "Recurso", subtitle: courseLine, tag: a.type === "exame" ? "Exame" : "Recurso" });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const future = events.filter(e => e.when >= today).sort((a, b) => a.when.localeCompare(b.when));
  const past = events.filter(e => e.when < today).sort((a, b) => b.when.localeCompare(a.when));

  return (
    <div className="space-y-6">
      <div className="text-2xl font-semibold">Calendário</div>

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
            future.map((e, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="font-medium">{e.title}</div>
                  <div className="text-sm text-muted-foreground">{e.subtitle}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{new Date(e.when).toLocaleDateString("pt-PT")}</div>
                  <div className="text-xs text-muted-foreground">{e.tag}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos Passados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {past.slice(0, 20).map((e, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <div className="font-medium">{e.title}</div>
                <div className="text-sm text-muted-foreground">{e.subtitle}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{new Date(e.when).toLocaleDateString("pt-PT")}</div>
                <div className="text-xs text-muted-foreground">{e.tag}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
