import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/lib/AppStore";
import { finalGrade, globalStats } from "@/lib/calculations";

export default function HistoryPage() {
  const { state } = useAppStore();
  const stats = globalStats(state);

  const completed = state.courses.filter(c => c.isCompleted);

  return (
    <div className="space-y-6">
      <div className="text-2xl font-semibold">Histórico</div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Cadeiras Concluídas</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.completed}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Média Global</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.avg}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Melhor Nota</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{stats.best ?? "—"}</CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cadeiras Concluídas</CardTitle>
          <div className="text-sm text-muted-foreground">Histórico das suas cadeiras finalizadas</div>
        </CardHeader>

        <CardContent className="space-y-3">
          {completed.length === 0 ? (
            <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
              Ainda não tem cadeiras concluídas.
            </div>
          ) : (
            completed
              .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
              .map(c => {
                const fin = finalGrade(state, c.id);
                return (
                  <div key={c.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-sm text-muted-foreground">{c.code} • {c.year}º ano • {c.semester}º semestre</div>
                      </div>
                      <div className="text-xl font-semibold">{fin ?? "—"}</div>
                    </div>
                    {c.completedAt && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Concluída em {new Date(c.completedAt).toLocaleDateString("pt-PT")}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
