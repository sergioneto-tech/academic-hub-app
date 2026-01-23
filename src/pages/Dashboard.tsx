import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { useAppStore } from "@/lib/AppStore";
import { courseStatusLabel, exam, globalStats, totalEFolios, totalEFoliosMax } from "@/lib/calculations";
import { formatPtNumber } from "@/lib/utils";

export default function Dashboard() {
  const { state } = useAppStore();
  const stats = globalStats(state);

  const activeCourses = state.courses
    .filter((c) => c.isActive && !c.isCompleted)
    .sort((a, b) => a.code.localeCompare(b.code, "pt-PT"))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral rápida das tuas cadeiras.</p>
        </div>

        <Button asChild>
          <Link to="/cadeiras">Gerir cadeiras</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="bg-white/70 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ativas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.active}</CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Concluídas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.completed}</CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Média (concluídas)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.completed ? stats.avg : "—"}</CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Eventos (datas)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{stats.eventsCount}</CardContent>
        </Card>
      </div>

      <Card className="bg-white/70 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Cadeiras ativas</CardTitle>
          <Button variant="ghost" asChild>
            <Link to="/cadeiras">Ver todas →</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma cadeira ativa. Vai a “Cadeiras” e ativa as que estás a frequentar.</p>
          ) : (
            activeCourses.map((c) => {
              const st = courseStatusLabel(state, c.id);
              const ef = totalEFolios(state, c.id);
              const efMax = totalEFoliosMax(state, c.id);
              const ex = exam(state, c.id);

              return (
                <div key={c.id} className="rounded-lg border p-3 md:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.code} — {c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      E‑fólios: {formatPtNumber(ef)} / {formatPtNumber(efMax)}{" "}
                      {ex?.date ? ` • Exame: ${ex.date}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge label={st.label} tone={st.badge} />
                    <Button size="sm" asChild>
                      <Link to={`/cadeiras/${c.id}`}>Abrir</Link>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
