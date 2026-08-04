import { ArrowRight, Clock3, ShieldCheck, Sparkles } from "lucide-react";

const CHANGE_ITEMS = [
  "Novo configurador flexível de avaliação, preparado para futuras regras da UAb",
  "Renovação visual completa nos modos claro e escuro",
  "Novo centro Ajuda & Guia e manutenção dos links úteis",
  "Melhorias nos alertas, perfil e fotografia do aluno",
];

export default function MaintenancePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06162d] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center px-5 py-10 sm:px-8">
        <section className="grid w-full gap-8 overflow-hidden rounded-[2rem] border border-amber-300/25 bg-[#081b35]/95 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:p-12">
          <div className="flex flex-col justify-center">
            <div className="mb-7 flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-300/45 bg-gradient-to-br from-[#0d2b53] to-[#07172d] font-serif text-4xl text-amber-200 shadow-lg shadow-black/25">
              AH
            </div>

            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-sm font-medium text-amber-200">
              <Sparkles className="h-4 w-4" /> Academic Hub em atualização
            </div>

            <h1 className="max-w-xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">
              Estamos a preparar uma experiência académica ainda melhor.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              A aplicação encontra-se temporariamente indisponível enquanto implementamos melhorias funcionais e visuais. Os dados já registados mantêm-se protegidos.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <ShieldCheck className="mb-3 h-6 w-6 text-amber-300" />
                <p className="font-semibold">Os teus dados mantêm-se seguros</p>
                <p className="mt-1 text-sm text-slate-400">A informação existente será preservada durante a atualização.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <Clock3 className="mb-3 h-6 w-6 text-amber-300" />
                <p className="font-semibold">Regressamos em breve</p>
                <p className="mt-1 text-sm text-slate-400">Obrigado pela compreensão durante esta evolução.</p>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-white/10 bg-[#06162d]/80 p-5 sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">O que vai mudar</p>
            <h2 className="mt-2 text-2xl font-semibold">Uma atualização funcional e visual</h2>

            <div className="mt-6 space-y-3">
              {CHANGE_ITEMS.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.035] p-3.5">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-300/15 text-amber-300">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm leading-6 text-slate-300">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-white/10 pt-5 text-sm text-slate-400">
              Quando a atualização estiver concluída, será apresentado um resumo completo das alterações ao entrar na aplicação.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
