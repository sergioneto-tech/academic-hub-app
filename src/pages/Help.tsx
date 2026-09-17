import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, BellRing, BookOpen, CalendarDays, CheckCircle2, Cloud, ExternalLink, FileText, Fingerprint, GraduationCap, HelpCircle, LayoutDashboard, LifeBuoy, LockKeyhole, Printer, Scale, ShieldCheck, Sparkles, UserPlus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const REGULATION_URL="https://portal.uab.pt/avaliacao/";

const guides=[
  {title:"Primeiros passos",description:"Escolher a licenciatura, carregar o plano e ativar as cadeiras do semestre.",icon:GraduationCap},
  {title:"Como usar o Academic Hub",description:"Visão geral do painel, calendário, plano de estudos, histórico e alertas.",icon:LayoutDashboard},
  {title:"Alertas e notificações",description:"Ativar notificações no dispositivo e escolher avisos para e-fólios, exames, recursos e prazos oficiais da UAb.",icon:BellRing},
  {title:"Como funciona a avaliação",description:"Regime oficial em vigor, configuração por cadeira, mínimos, exame e recurso.",icon:BookOpen},
  {title:"Backup e sincronização",description:"Guardar, recuperar e sincronizar os dados com segurança entre dispositivos.",icon:Cloud},
  {title:"Suporte e pedidos",description:"Comunicar falhas, erros, dúvidas ou sugestões e acompanhar o estado do pedido através da aplicação.",icon:LifeBuoy},
  {title:"Dados e privacidade",description:"Consultar o ID Academic Hub, exportar dados, perceber prazos de conservação e aceder às opções de correção ou eliminação.",icon:ShieldCheck},
  {title:"Perguntas frequentes",description:"Respostas rápidas sobre notas, cadeiras, dados, instalação, segurança e atualizações.",icon:HelpCircle},
];

const steps=[
  {title:"1. Explora antes de criares conta",icon:LayoutDashboard,text:"Podes conhecer a estrutura do Academic Hub, consultar cursos, plano, cadeiras e ligações públicas sem criar conta. As ações pessoais ficam protegidas até aderires.",action:"Explorar o início",to:"/"},
  {title:"2. Escolhe a tua licenciatura",icon:GraduationCap,text:"Em Definições escolhe o curso. O Academic Hub passa a apresentar o plano, anos, semestres, áreas e ECTS correspondentes.",action:"Ver cursos e definições",to:"/definicoes"},
  {title:"3. Consulta as cadeiras",icon:BookOpen,text:"Abre Cadeiras para conheceres as unidades curriculares. Depois de criares conta, podes ativar apenas as que estás realmente a frequentar.",action:"Ver cadeiras",to:"/cadeiras"},
  {title:"4. Ativa e acompanha",icon:CheckCircle2,text:"Com conta criada, ativa uma cadeira e regista e-fólios, exame, recurso e datas. O painel calcula o progresso e ajuda a perceber o estado da avaliação.",locked:true,action:"Criar conta / entrar",to:"/conta"},
  {title:"5. Organiza prazos",icon:CalendarDays,text:"O Calendário reúne datas académicas e acontecimentos das cadeiras para que tenhas uma visão temporal do semestre.",action:"Abrir calendário",to:"/calendario"},
  {title:"6. Ativa os alertas no dispositivo",icon:BellRing,text:"Em Definições podes ativar notificações Push neste dispositivo e escolher quantos dias antes queres ser avisado. Os e-fólios avisam no início, antes do fim e no último dia; exames e recursos avisam com antecedência e no próprio dia, mostrando também a hora quando estiver registada; os prazos oficiais da UAb avisam antes da abertura e do fecho e nos respetivos dias.",locked:true,action:"Configurar notificações",to:"/definicoes"},
  {title:"7. Consulta o teu percurso",icon:Printer,text:"À medida que concluis cadeiras, o Histórico e os relatórios pessoais mostram ECTS, média, progresso e detalhe das avaliações. Estes documentos não substituem documentos oficiais da UAb.",locked:true,action:"Ver histórico",to:"/historico"},
  {title:"8. Usa o Suporte quando algo não estiver bem",icon:LifeBuoy,text:"Se encontrares uma falha, erro, comportamento inesperado, tiveres uma dúvida ou quiseres sugerir uma melhoria, utiliza Suporte. Cada pedido recebe referência e pode ser acompanhado. Quando estás autenticado, o suporte utiliza o teu ID Academic Hub em vez de expor o email no fluxo normal.",locked:true,action:"Abrir Suporte",to:"/feedback"},
  {title:"9. Conhece e controla os teus dados",icon:Fingerprint,text:"Em Os meus dados e privacidade podes consultar o teu ID Academic Hub, perceber que categorias de dados podem existir, ver os prazos de conservação, exportar os dados locais e encontrar as opções de correção, privacidade e eliminação da conta.",locked:true,action:"Os meus dados e privacidade",to:"/dados-privacidade"},
  {title:"10. Protege e sincroniza o teu percurso",icon:Cloud,text:"Na área Conta e Perfil podes gerir a tua conta e fotografia e, quando utilizas a sincronização cloud, manter o percurso disponível nos teus dispositivos.",locked:true,action:"Conta e Perfil",to:"/conta"},
];

export default function HelpPage(){
  const[open,setOpen]=useState(false);
  const[step,setStep]=useState(0);
  const current=steps[step];
  const Icon=current.icon;

  return <div className="space-y-6">
    <div><Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4"/>Voltar ao início</Link></Button></div>

    <section className="premium-surface overflow-hidden p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground"><LifeBuoy className="h-3.5 w-3.5 text-primary"/>Centro de apoio</div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ajuda & Guia</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Aprende a explorar, configurar e utilizar o Academic Hub, incluindo suporte, privacidade e controlo dos teus dados.</p>
        </div>
        <Button asChild variant="outline"><Link to="/definicoes">Abrir Definições</Link></Button>
      </div>
    </section>

    <Card className="premium-card overflow-hidden border-[hsl(var(--gold)/0.4)] shadow-sm">
      <CardContent className="p-0">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[hsl(var(--gold)/0.25)] bg-[hsl(var(--gold-soft)/0.6)] text-[hsl(var(--gold))] shadow-sm"><Sparkles className="h-6 w-6"/></div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[hsl(var(--gold))]">Novo no Academic Hub?</div>
              <h2 className="mt-1 text-lg font-semibold sm:text-xl">Como começar — guia passo a passo</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Percorre os principais passos desde a escolha do curso até às cadeiras, avaliações, calendário, notificações, histórico, suporte, privacidade e sincronização.</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-[hsl(var(--gold)/0.18)] bg-[hsl(var(--gold-soft)/0.18)] p-3 sm:p-4">
          <Button className="w-full sm:w-auto sm:min-w-44" onClick={()=>{setStep(0);setOpen(true)}}>Começar guia <ArrowRight className="ml-2 h-4 w-4"/></Button>
        </div>
      </CardContent>
    </Card>

    <Card className="premium-card overflow-hidden border-primary/25 shadow-sm">
      <CardContent className="p-0">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/5 text-primary shadow-sm dark:bg-primary/10"><LifeBuoy className="h-6 w-6"/></div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Suporte e pedidos</div>
              <h2 className="mt-1 text-lg font-semibold sm:text-xl">Encontraste uma falha ou precisas de ajuda?</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Comunica erros, falhas, comportamentos inesperados ou dúvidas. Também podes enviar sugestões. Se estiveres autenticado, o pedido fica associado ao teu ID Academic Hub e podes acompanhar o respetivo estado.</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-primary/10 bg-primary/[0.025] p-3 sm:p-4 dark:bg-primary/[0.045]">
          <Button asChild variant="outline" className="w-full sm:w-auto sm:min-w-44"><Link to="/feedback">Abrir Suporte <ArrowRight className="ml-2 h-4 w-4"/></Link></Button>
        </div>
      </CardContent>
    </Card>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{guides.map(({title,description,icon:GuideIcon})=><Card key={title} className="premium-card h-full border-border/80 shadow-sm transition-shadow hover:shadow-md"><CardHeader className="pb-2"><div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary dark:bg-primary/10"><GuideIcon className="h-5 w-5"/></div><CardTitle className="text-base leading-6">{title}</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">{description}</CardContent></Card>)}</div>

    <Card className="premium-card border-[hsl(var(--gold)/0.28)] shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-5 w-5 text-[hsl(var(--gold))]"/>Sobre o projeto</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p className="font-medium text-foreground">Criado e desenvolvido por Sérgio Neto, aluno da Licenciatura em Engenharia Informática da Universidade Aberta.</p><p>O Academic Hub nasceu como uma ferramenta pessoal de organização académica e evoluiu para uma aplicação independente de apoio aos estudantes.</p><Button asChild variant="outline" size="sm"><Link to="/transparencia">Transparência e Privacidade</Link></Button></CardContent></Card>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="premium-card border-primary/20 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Scale className="h-5 w-5 text-primary"/>Privacidade, termos e segurança</CardTitle></CardHeader><CardContent className="space-y-4 text-sm leading-6 text-muted-foreground"><p>Acede num só local à informação sobre tratamento de dados, Termos de Utilização, Segurança e Transparência, exportação, correção e eliminação.</p><Button asChild variant="outline"><Link to="/dados-privacidade">Abrir dados e privacidade</Link></Button></CardContent></Card>
      <Card className="premium-card border-primary/20 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Printer className="h-5 w-5 text-primary"/>Relatório académico pessoal</CardTitle></CardHeader><CardContent className="space-y-4 text-sm leading-6 text-muted-foreground"><p>Imprime ou guarda em PDF o percurso registado, incluindo avaliações, nota final e ECTS.</p><Button asChild variant="outline"><Link to="/historico/relatorio">Abrir relatório</Link></Button></CardContent></Card>
    </div>

    <Card className="premium-card overflow-hidden border-[hsl(var(--gold)/0.35)] shadow-sm"><CardContent className="p-0"><div className="p-5 sm:p-6"><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[hsl(var(--gold)/0.2)] bg-[hsl(var(--gold-soft)/0.5)] text-[hsl(var(--gold))]"><FileText className="h-5 w-5"/></div><div><h2 className="font-semibold">Regulamento de avaliação atualmente publicado</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Confirma sempre as regras aplicáveis no PUC e na informação oficial da Universidade Aberta.</p></div></div></div><div className="flex justify-end border-t border-[hsl(var(--gold)/0.16)] bg-[hsl(var(--gold-soft)/0.16)] p-3 sm:p-4"><Button asChild variant="outline" className="w-full sm:w-auto"><a href={REGULATION_URL} target="_blank" rel="noopener noreferrer">Consultar na UAb <ExternalLink className="ml-2 h-4 w-4"/></a></Button></div></CardContent></Card>

    <Card className="premium-card border-border/80 shadow-sm"><CardHeader><CardTitle className="text-base">Ligações úteis</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"><a className="rounded-xl border bg-card p-3 transition-colors hover:bg-accent" href="https://portal.uab.pt/" target="_blank" rel="noopener noreferrer">Portal UAb</a><a className="rounded-xl border bg-card p-3 transition-colors hover:bg-accent" href="https://guiadoscursos.uab.pt/" target="_blank" rel="noopener noreferrer">Guia dos Cursos</a><a className="rounded-xl border bg-card p-3 transition-colors hover:bg-accent" href="https://portal.uab.pt/calendario-letivo/" target="_blank" rel="noopener noreferrer">Calendário letivo</a><a className="rounded-xl border bg-card p-3 transition-colors hover:bg-accent" href="https://www.dges.gov.pt/" target="_blank" rel="noopener noreferrer">DGES</a></CardContent></Card>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[hsl(var(--gold))]">Passo {step+1} de {steps.length}</span>{current.locked&&<span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] text-muted-foreground"><LockKeyhole className="h-3 w-3"/>Requer conta para alterar dados</span>}</div><DialogTitle className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5"/></span>{current.title}</DialogTitle><DialogDescription className="pt-3 text-sm leading-6">{current.text}</DialogDescription></DialogHeader><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[hsl(var(--gold))] transition-all" style={{width:`${((step+1)/steps.length)*100}%`}}/></div><div><Button asChild variant="outline" size="sm" onClick={()=>setOpen(false)}>{current.to==="/conta"&&current.title.startsWith("4.")?<Link to="/definicoes?conta=criar"><UserPlus className="mr-2 h-4 w-4"/>{current.action}</Link>:<Link to={current.to}>{current.action}<ExternalLink className="ml-2 h-3.5 w-3.5"/></Link>}</Button></div><DialogFooter className="flex-row justify-between sm:justify-between"><Button variant="ghost" disabled={step===0} onClick={()=>setStep(s=>Math.max(0,s-1))}><ArrowLeft className="mr-2 h-4 w-4"/>Anterior</Button>{step<steps.length-1?<Button onClick={()=>setStep(s=>Math.min(steps.length-1,s+1))}>Seguinte<ArrowRight className="ml-2 h-4 w-4"/></Button>:<Button onClick={()=>setOpen(false)}>Concluir guia</Button>}</DialogFooter></DialogContent></Dialog>
  </div>;
}
