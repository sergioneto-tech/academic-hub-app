import { Database, ShieldCheck, Wrench } from "lucide-react";

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12">
        <section className="w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl shadow-black/30">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-8 sm:p-12">
              <div className="mb-8 flex items-center gap-4">
                <img
                  src="/academic-hub-premium.svg"
                  alt="Academic Hub"
                  className="h-16 w-16 rounded-2xl bg-white/5 p-2"
                />
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-400">
                    Academic Hub
                  </p>
                  <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                    Estamos a preparar uma nova base de dados
                  </h1>
                </div>
              </div>

              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                O acesso está temporariamente suspenso enquanto preparamos uma nova
                infraestrutura de dados, mais estável e controlada diretamente pelo
                Academic Hub.
              </p>

              <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                <p className="font-semibold text-amber-200">Os registos existentes estão a ser preservados.</p>
                <p className="mt-2 leading-6 text-slate-300">
                  Quando o serviço reabrir, as contas já existentes serão orientadas
                  durante a transição para a nova base de dados. Até lá, não é possível
                  criar ou alterar registos.
                </p>
              </div>

              <p className="mt-8 text-sm text-slate-400">
                Não é necessária qualquer ação neste momento. Agradecemos a compreensão.
              </p>
            </div>

            <div className="border-t border-slate-800 bg-slate-950/70 p-8 sm:p-12 lg:border-l lg:border-t-0">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="mt-1 rounded-xl bg-sky-500/10 p-3 text-sky-300">
                    <Database className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-white">Migração controlada</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Estamos a preparar a estrutura necessária para transferir os dados de forma segura.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="mt-1 rounded-xl bg-emerald-500/10 p-3 text-emerald-300">
                    <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-white">Proteção dos registos</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      O bloqueio temporário evita alterações enquanto validamos a nova infraestrutura.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="mt-1 rounded-xl bg-violet-500/10 p-3 text-violet-300">
                    <Wrench className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-white">Intervenção temporária</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      O serviço será reaberto assim que os testes de migração forem concluídos.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
