import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { useAppStore } from "@/lib/AppStore";
import { courseStatusLabel, exam, getAssessments, globalStats, resit, totalEFolios, totalEFoliosMax } from "@/lib/calculations";
import { formatPtNumber } from "@/lib/utils";

function parseYmd(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function datePart(v: string): string {
  return v.slice(0, 10);
}

function daysLeftFromToday(ymdOrDateTime: string): number | null {
  if (!ymdOrDateTime) return null;
  const ymd = ymdOrDateTime.includes("T") ? datePart(ymdOrDateTime) : ymdOrDateTime;
  const target = parseYmd(ymd);
  if (!target) return null;
  const today = startOfDay(new Date());
  const diff = startOfDay(target).getTime() - today.getTime();
  return Math.round(diff / 86400000);
}

function toneClassForDaysLeft(daysLeft: number): string {
  if (daysLeft === 0) return "text-rose-700";
  if (daysLeft >= 1 && daysLeft <= 5) return "text-amber-700";
  if (daysLeft > 5) return "text-emerald-700";
  return "text-muted-foreground";
}

function fmtDaysLeft(daysLeft: number): string {
  if (daysLeft === 0) return "hoje";
  if (daysLeft === 1) return "1 dia";
  return `${daysLeft} dias`;
}

export default function Dashboard() {
  const { state } = useAppStore();
  const stats = globalStats(state);
  const today = startOfDay(new Date());

  const activeCourses = state.courses
    .filter((c) => c.isActive && !c.isCompleted)
    .sort((a, b) => a.code.localeCompare(b.code, "pt-PT"));

  return (
    <div className="space-y-6">
      {/* Hero / cabeçalho */}
      <div className="rounded-2xl overflow-hidden border gradient-primary text-white shadow-lg">
        <div className="p-5 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Painel do utilizador</h1>
            <p className="text-sm text-white/80">
              Visão geral rápida das cadeiras, e‑fólios e datas importantes.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link to="/cadeiras">Gerir cadeiras</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto bg-white/10 text-white border-white/30 hover:bg-white/20">
              <Link to="/calendario">Ver calendário</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Cadeiras ativas (sem "campo" extra — já aparecem aqui) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Cadeiras ativas</h2>
          <Button variant="ghost" asChild>
            <Link to="/cadeiras">Ver todas →</Link>
          </Button>
        </div>

        {activeCourses.length === 0 ? (
          <Card className="bg-white/70 backdrop-blur">
            <CardContent className="py-6 text-sm text-muted-foreground">
              Nenhuma cadeira ativa. Vai a “Cadeiras” e ativa as que estás a frequentar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeCourses.map((c) => {
              const st = courseStatusLabel(state, c.id);
              const ef = totalEFolios(state, c.id);
              const efMax = totalEFoliosMax(state, c.id);
              const ex = exam(state, c.id);
              const rc = resit(state, c.id);

              const efolioLines = getAssessments(state, c.id, "efolio")
                .filter((a) => a.startDate && a.endDate)
                .map((a) => {
                  const s = parseYmd(a.startDate!);
                  const e = parseYmd(a.endDate!);
                  if (!s || !e) return null;
                  const ss = startOfDay(s);
                  const ee = startOfDay(e);
                  if (today < ss || today > ee) return null;
                  const daysLeft = Math.round((ee.getTime() - today.getTime()) / 86400000);
                  const cls = toneClassForDaysLeft(daysLeft);
                  const text = daysLeft === 0 ? `Último dia: ${a.name}` : `${a.name} termina em ${fmtDaysLeft(daysLeft)}`;
                  return { key: a.id, cls, text };
                })
                .filter((x): x is { key: string; cls: string; text: string } => Boolean(x));

              const examDays = ex?.date ? daysLeftFromToday(ex.date) : null;
              const examLine = examDays !== null && examDays >= 0
                ? { cls: toneClassForDaysLeft(examDays), text: examDays === 0 ? "Exame hoje" : `Exame em ${fmtDaysLeft(examDays)}` }
                : null;

              const showResit = st.label === "Recurso" && Boolean(rc?.date);
              const resitDays = showResit && rc?.date ? daysLeftFromToday(rc.date) : null;
              const resitLine = resitDays !== null && resitDays >= 0
                ? { cls: toneClassForDaysLeft(resitDays), text: resitDays === 0 ? "Recurso hoje" : `Recurso em ${fmtDaysLeft(resitDays)}` }
                : null;

              return (
                <Link
                  key={c.id}
                  to={`/cadeiras/${c.id}`}
                  className="block rounded-xl border bg-white/70 backdrop-blur p-4 hover:bg-white/90"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold leading-tight truncate">{c.code} — {c.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        E‑fólios: {formatPtNumber(ef)} / {formatPtNumber(efMax)}
                        {ex?.date ? ` • Exame: ${datePart(ex.date)}` : ""}
                      </div>

                      {(examLine || resitLine || efolioLines.length > 0) && (
                        <div className="mt-2 space-y-1">
                          {examLine && (
                            <div className={`text-xs font-medium ${examLine.cls}`}>⏳ {examLine.text}</div>
                          )}
                          {resitLine && (
                            <div className={`text-xs font-medium ${resitLine.cls}`}>⏳ {resitLine.text}</div>
                          )}
                          {efolioLines.map((l) => (
                            <div key={l.key} className={`text-xs font-medium ${l.cls}`}>⏳ {l.text}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      <StatusBadge label={st.label} tone={st.badge} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
