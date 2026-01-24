import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useAppStore } from "@/lib/AppStore";
import { courseStatusLabel, exam, globalStats, totalEFolios, totalEFoliosMax } from "@/lib/calculations";
import { formatPtNumber } from "@/lib/utils";

export default function Dashboard() {
  const { state } = useAppStore();
  const stats = globalStats(state);

  const activeCourses = state.courses
    .filter((c) => c.isActive && !c.isCompleted)
    .sort((a, b) => a.code.localeCompare(b.code, "pt-PT"));

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-500 p-5 md:p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold leading-tight">
              Painel do utilizador
            </h1>
            <p className="text-sm text-white/80">
              {state.degree?.name ? state.degree.name : "Defina o curso (grau) em Definições."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white"
            >
              <Link to="/cadeiras">Gerir cadeiras</Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-4">
          <div className="rounded-xl border border-white/20 bg-white/10 p-3">
            <div className="text-xs text-white/80">Ativas</div>
            <div className="text-2xl font-semibold">{stats.active}</div>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 p-3">
            <div className="text-xs text-white/80">Concluídas</div>
            <div className="text-2xl font-semibold">{stats.completed}</div>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 p-3">
            <div className="text-xs text-white/80">Média</div>
            <div className="text-2xl font-semibold">{stats.completed ? stats.avg : "—"}</div>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 p-3">
            <div className="text-xs text-white/80">Eventos</div>
            <div className="text-2xl font-semibold">{stats.eventsCount}</div>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base md:text-lg font-semibold">Cadeiras ativas</h2>
            <p className="text-sm text-muted-foreground">
              Mostradas diretamente (mobile friendly) — sem “campo/visor” extra.
            </p>
          </div>
          <Button variant="ghost" asChild>
            <Link to="/cadeiras">Ver todas →</Link>
          </Button>
        </div>

        {activeCourses.length === 0 ? (
          <Card className="bg-white/70 backdrop-blur">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Nenhuma cadeira ativa. Vai a “Cadeiras” e ativa as que estás a frequentar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeCourses.map((c) => {
              const st = courseStatusLabel(state, c.id);
              const ef = totalEFolios(state, c.id);
              const efMax = totalEFoliosMax(state, c.id);
              const ex = exam(state, c.id);

              return (
                <Card
                  key={c.id}
                  className="bg-white/70 backdrop-blur hover:shadow-sm transition-shadow"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold truncate">
                          {c.code}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground truncate">{c.name}</p>
                      </div>
                      <div className="shrink-0">
                        <StatusBadge label={st.label} tone={st.badge} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      E-fólios: <span className="text-foreground font-medium">{formatPtNumber(ef)}</span> / {formatPtNumber(efMax)}
                      {ex?.date ? (
                        <>
                          <span className="mx-2">•</span>
                          Exame: <span className="text-foreground font-medium">{ex.date}</span>
                        </>
                      ) : null}
                    </div>

                    <Button asChild size="sm" className="w-full">
                      <Link to={`/cadeiras/${c.id}`}>Abrir</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
