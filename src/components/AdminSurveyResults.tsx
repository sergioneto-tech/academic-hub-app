import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCw, Star, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { APP_SURVEY_CHANGED_EVENT, loadSurveySummary, type AppSurveySummary } from "@/lib/appSurvey";
import { isFeedbackBetaManager } from "@/lib/feedbackBeta";

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export default function AdminSurveyResults() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<AppSurveySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const manager = isFeedbackBetaManager();
  const onFeedback = location.pathname === "/feedback";

  const refresh = async () => {
    if (!manager) return;
    setLoading(true);
    setError("");
    try {
      setSummary(await loadSurveySummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os resultados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!manager || !onFeedback) return;
    void refresh();
    const handler = () => void refresh();
    window.addEventListener(APP_SURVEY_CHANGED_EVENT, handler);
    window.addEventListener("academic-hub-auth-changed", handler);
    return () => {
      window.removeEventListener(APP_SURVEY_CHANGED_EVENT, handler);
      window.removeEventListener("academic-hub-auth-changed", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager, onFeedback]);

  const ratings = useMemo(() => ([5, 4, 3, 2, 1] as const).map((rating) => ({
    rating,
    count: summary?.ratings[rating] ?? 0,
    percent: pct(summary?.ratings[rating] ?? 0, summary?.total ?? 0),
  })), [summary]);

  if (!manager || !onFeedback) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-full border border-primary/30 bg-background/95 px-4 py-2.5 text-sm font-semibold shadow-lg backdrop-blur md:bottom-6 md:right-6"
      >
        <BarChart3 className="h-4 w-4 text-primary" />
        Resultados do inquérito
        {summary && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{summary.total}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[135] grid place-items-center overflow-y-auto bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="survey-results-title">
          <section className="premium-surface my-auto w-full max-w-4xl overflow-hidden shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b p-5 sm:p-6">
              <div>
                <div className="flex items-center gap-2 text-primary"><BarChart3 className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wide">Administração</span></div>
                <h2 id="survey-results-title" className="mt-1 text-xl font-semibold sm:text-2xl">Resultados do inquérito da app</h2>
                <p className="mt-1 text-sm text-muted-foreground">Visão agregada das respostas dos alunos. Não são apresentados nomes nem emails.</p>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Fechar resultados"><X className="h-5 w-5" /></Button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">Atualização direta a partir do Supabase.</div>
                <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void refresh()}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar</Button>
              </div>

              {error && <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Respostas" value={String(summary?.total ?? 0)} />
                <Metric label="Gostam da app" value={`${pct(summary?.likesYes ?? 0, summary?.total ?? 0)}%`} />
                <Metric label="Recomendariam" value={`${pct(summary?.recommendsYes ?? 0, summary?.total ?? 0)}%`} />
                <Metric label="Avaliação média" value={summary?.averageRating === null || summary?.averageRating === undefined ? "—" : `${summary.averageRating.toFixed(2)} / 5`} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <BinaryChart title="Estás a gostar da app?" yes={summary?.likesYes ?? 0} no={summary?.likesNo ?? 0} total={summary?.total ?? 0} />
                <BinaryChart title="Recomendarias a app a outro colega?" yes={summary?.recommendsYes ?? 0} no={summary?.recommendsNo ?? 0} total={summary?.total ?? 0} />
              </div>

              <div className="rounded-xl border p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3"><div><div className="font-semibold">Distribuição das avaliações</div><div className="text-xs text-muted-foreground">1 a 5 estrelas</div></div><div className="flex items-center gap-1 text-amber-500"><Star className="h-4 w-4 fill-current" /><strong>{summary?.averageRating?.toFixed(2) ?? "—"}</strong></div></div>
                <div className="mt-4 space-y-3">
                  {ratings.map((item) => (
                    <div key={item.rating} className="grid grid-cols-[72px_minmax(0,1fr)_72px] items-center gap-3 text-sm">
                      <div className="flex items-center gap-1 font-medium">{item.rating} <Star className="h-3.5 w-3.5 fill-current text-amber-500" /></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${item.percent}%` }} /></div>
                      <div className="text-right text-xs text-muted-foreground">{item.count} · {item.percent}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>;
}

function BinaryChart({ title, yes, no, total }: { title: string; yes: number; no: number; total: number }) {
  const yesPct = pct(yes, total);
  const noPct = pct(no, total);
  return (
    <div className="rounded-xl border p-4 sm:p-5">
      <div className="font-semibold">{title}</div>
      <div className="mt-4 space-y-3">
        <Bar label="Sim" count={yes} percent={yesPct} />
        <Bar label="Não" count={no} percent={noPct} />
      </div>
    </div>
  );
}

function Bar({ label, count, percent }: { label: string; count: number; percent: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-medium">{label}</span><span className="text-muted-foreground">{count} · {percent}%</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}
