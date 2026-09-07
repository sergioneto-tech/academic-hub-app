import { useEffect, useState } from "react";
import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_SURVEY_CHANGED_EVENT, getCurrentSurveyState, submitCurrentSurvey } from "@/lib/appSurvey";

export default function AppSatisfactionSurvey() {
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(true);
  const [likesApp, setLikesApp] = useState<boolean | null>(null);
  const [recommendsApp, setRecommendsApp] = useState<boolean | null>(null);
  const [rating, setRating] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setChecking(true);
      try {
        const state = await getCurrentSurveyState();
        if (!cancelled) setVisible(Boolean(state.authenticated && !state.answered));
      } catch (err) {
        console.warn("[AppSurvey][check]", err);
        if (!cancelled) setVisible(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    const onAuth = () => void check();
    const onOnline = () => void check();
    void check();
    window.addEventListener("academic-hub-auth-changed", onAuth);
    window.addEventListener("online", onOnline);
    window.addEventListener(APP_SURVEY_CHANGED_EVENT, onAuth);
    return () => {
      cancelled = true;
      window.removeEventListener("academic-hub-auth-changed", onAuth);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(APP_SURVEY_CHANGED_EVENT, onAuth);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [visible]);

  if (checking || !visible) return null;

  const complete = likesApp !== null && recommendsApp !== null && rating >= 1;

  const save = async () => {
    if (!complete || likesApp === null || recommendsApp === null) return;
    setSaving(true);
    setError("");
    try {
      await submitCurrentSurvey({ likesApp, recommendsApp, rating });
      setVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível guardar a resposta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] grid place-items-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="app-survey-title">
      <section className="premium-surface my-auto w-full max-w-xl overflow-hidden border-primary/30 shadow-2xl">
        <div className="border-b bg-primary/[0.04] p-5 sm:p-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Star className="h-3.5 w-3.5" /> Inquérito rápido
          </div>
          <h2 id="app-survey-title" className="text-xl font-semibold sm:text-2xl">Ajuda-nos a melhorar o Academic Hub</h2>
          <p className="mt-2 text-sm text-muted-foreground">São apenas 3 perguntas. A tua resposta é importante para orientar as próximas melhorias.</p>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <Question title="1. Estás a gostar do Academic Hub?" value={likesApp} onChange={setLikesApp} />
          <Question title="2. Recomendarias o Academic Hub a outro colega?" value={recommendsApp} onChange={setRecommendsApp} />

          <div className="rounded-xl border bg-card p-4">
            <div className="text-sm font-semibold">3. Qual é a tua avaliação global da app?</div>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Avaliação global da aplicação">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} ${value === 1 ? "estrela" : "estrelas"}`}
                  onClick={() => setRating(value)}
                  className={`grid h-11 w-11 place-items-center rounded-xl border transition ${rating >= value ? "border-amber-400 bg-amber-400/15 text-amber-500" : "text-muted-foreground hover:border-amber-400/50 hover:text-amber-500"}`}
                >
                  <Star className={`h-5 w-5 ${rating >= value ? "fill-current" : ""}`} />
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{rating ? `${rating} de 5 estrelas` : "Seleciona entre 1 e 5 estrelas."}</div>
          </div>

          {error && <div className="rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          <div className="rounded-xl border bg-muted/25 p-3 text-xs text-muted-foreground">
            O inquérito não pede nome nem comentário livre. A resposta fica associada tecnicamente à tua conta apenas para impedir respostas duplicadas.
          </div>

          <Button type="button" className="w-full" disabled={!complete || saving} onClick={() => void save()}>
            <Check className="mr-2 h-4 w-4" />
            {saving ? "A guardar…" : "Enviar resposta e continuar"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Question({ title, value, onChange }: { title: string; value: boolean | null; onChange: (value: boolean) => void }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Choice label="Sim" selected={value === true} onClick={() => onChange(true)} />
        <Choice label="Não" selected={value === false} onClick={() => onChange(false)} />
      </div>
    </div>
  );
}

function Choice({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${selected ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20" : "hover:bg-muted/45"}`}>
      {label}
    </button>
  );
}
