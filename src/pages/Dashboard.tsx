import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/AppStore";
import { courseStatusLabel, globalStats, totalEFolios } from "@/lib/calculations";

export default function Dashboard() {
  const { state } = useAppStore();
  const stats = globalStats(state);

  const activeCourses = state.courses.filter(c => c.isActive && !c.isCompleted);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="bg-gradient-to-r from-blue-700 to-sky-500 p-6 text-white">
          <div className="text-2xl font-semibold">Olá, Estudante! 👋</div>
          <div className="mt-1 text-white/90">{state.degree?.name ?? "Sem licenciatura definida"}</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Ativas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.active}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Concluídas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.completed}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Média</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.avg}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Eventos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.eventsCount}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Melhor nota</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.best ?? "—"}</CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cadeiras Ativas</CardTitle>
            <div className="text-sm text-muted-foreground">Acompanhe o seu progresso</div>
          </div>
          <Link className="text-sm font-medium hover:underline" to="/cadeiras">Ver todas →</Link>
        </CardHeader>

        <CardContent className="space-y-3">
          {activeCourses.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem cadeiras ativas.</div>
          ) : (
            activeCourses.map(c => {
              const st = courseStatusLabel(state, c.id);
              const ef = totalEFolios(state, c.id);
              return (
                <Link key={c.id} to={`/cadeiras/${c.id}`} className="block rounded-lg border p-4 hover:bg-muted/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-sm text-muted-foreground">e-fólios: {ef.toFixed(1)} / 4</div>
                    </div>
                    <Badge
                      variant={st.variant === "success" ? "default" : st.variant === "warning" ? "secondary" : "destructive"}
                    >
                      {st.label}
                    </Badge>
                  </div>
                </Link>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link to="/cadeiras" className="rounded-lg border p-4 hover:bg-muted/40">
          <div className="font-semibold">Gerir Cadeiras</div>
          <div className="text-sm text-muted-foreground">Adicionar ou remover cadeiras</div>
        </Link>
        <Link to="/calendario" className="rounded-lg border p-4 hover:bg-muted/40">
          <div className="font-semibold">Calendário</div>
          <div className="text-sm text-muted-foreground">Ver próximos eventos</div>
        </Link>
      </div>
    </div>
  );
}
