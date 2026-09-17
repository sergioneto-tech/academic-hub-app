import {
  Activity,
  ArrowLeft,
  BellRing,
  Database,
  FileKey2,
  LockKeyhole,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import SecurityVerificationPanel from "@/components/SecurityVerificationPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_VERSION } from "@/lib/version";

const SECURITY_LEVEL = "2026.09";

const protectionLayers = [
  { icon: UserRoundCheck, title: "Conta e autenticação", text: "A sessão é validada pelo serviço de autenticação. O Academic Hub não apresenta nem guarda palavras-passe em registos de segurança." },
  { icon: Database, title: "Dados e isolamento", text: "Os dados Cloud são protegidos por regras de acesso no Supabase, incluindo RLS/FORCE RLS nos dados académicos por utilizador." },
  { icon: LockKeyhole, title: "Proteção web", text: "A aplicação usa HTTPS e a baseline verifica controlos como CSP, HSTS, proteção contra framing e políticas de referência." },
  { icon: Activity, title: "Monitorização", text: "Falhas repetidas de autenticação, rate limiting e outros sinais de segurança podem ser correlacionados e investigados sem expor o IP completo ao aluno." },
  { icon: BellRing, title: "Alertas", text: "Quando aplicável e tecnicamente suportado, incidentes relevantes podem originar avisos Push para ajudar o titular da conta a reagir rapidamente." },
  { icon: FileKey2, title: "Atualizações controladas", text: "O Service Worker valida a versão do app-shell e o processo de atualização é controlado para evitar misturas entre versões diferentes da aplicação." },
];

export default function SecurityPrivacyPage() {
  const [params] = useSearchParams();
  const autoStart = params.get("verificar") === "1";

  return (
    <div className="space-y-5 pb-4">
      <div><Button asChild variant="ghost" size="sm"><Link to="/dados-privacidade"><ArrowLeft className="mr-2 h-4 w-4" />Voltar a Os meus dados</Link></Button></div>

      <section className="premium-surface overflow-hidden">
        <div className="relative p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-[hsl(var(--gold)/0.10)] blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm"><ShieldCheck className="h-7 w-7" /></div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Academic Hub</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Segurança e Transparência</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Resumo técnico das proteções realmente implementadas, dos controlos verificáveis e dos limites do estado de segurança apresentado pela aplicação.</p>
              </div>
            </div>
            <div className="grid min-w-[220px] grid-cols-2 gap-2">
              <div className="rounded-2xl border bg-card/75 p-3 shadow-sm backdrop-blur"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Baseline</div><div className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{SECURITY_LEVEL}</div></div>
              <div className="rounded-2xl border bg-card/75 p-3 shadow-sm backdrop-blur"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Aplicação</div><div className="mt-1 text-sm font-semibold">v{APP_VERSION}</div></div>
            </div>
          </div>
        </div>
      </section>

      <SecurityVerificationPanel autoStart={autoStart} />

      <section><div className="mb-3"><h2 className="text-lg font-semibold">Camadas de proteção</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Resumo técnico em linguagem acessível, sem publicar detalhes que facilitem contornar os controlos.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{protectionLayers.map(({ icon: Icon, title, text }) => <Card key={title} className="premium-card h-full"><CardContent className="p-4 sm:p-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{text}</p></CardContent></Card>)}</div></section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="premium-card"><CardHeader><CardTitle className="text-base">O que significa um estado verde</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p>Um estado verde significa que os controlos essenciais consultados passaram e que a última baseline central disponível não apresenta falhas bloqueantes conhecidas.</p><p>Não significa invulnerabilidade absoluta, ausência de risco ou certificação externa do Academic Hub.</p></CardContent></Card>
        <Card className="premium-card"><CardHeader><CardTitle className="text-base">Acesso administrativo e suporte</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p>As consultas administrativas de suporte usam o ID Academic Hub e devem devolver apenas os diagnósticos necessários ao caso. Essas consultas são registadas para efeitos de responsabilização.</p><p>O ID Academic Hub é pseudónimo, não é uma palavra-passe e não permite, por si só, entrar na conta.</p></CardContent></Card>
      </div>

      <Card className="premium-card border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold-soft)/0.28)]"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><div className="text-sm font-semibold">Documentação relacionada</div><p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">A informação jurídica de privacidade e as condições de utilização são apresentadas em documentos próprios.</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link to="/legal">Privacidade e RGPD</Link></Button><Button asChild variant="outline" size="sm"><Link to="/termos">Termos de Utilização</Link></Button></div></CardContent></Card>
    </div>
  );
}
