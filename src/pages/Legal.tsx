import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Database,
  ExternalLink,
  FileText,
  Scale,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GDPR_URL = "https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=CELEX%3A32016R0679";
const CNPD_RIGHTS_URL = "https://www.cnpd.pt/cidadaos/direitos/";
const CNPD_COMPLAINTS_URL = "https://www.cnpd.pt/cidadaos/participacoes/";
const EDPB_BASICS_URL = "https://www.edpb.europa.eu/sme/learn-the-basics/data-protection-basics_pt";
const SUPABASE_DPA_URL = "https://supabase.com/downloads/docs/Supabase%2BDPA%2B231211.pdf";
const CLOUDFLARE_DPA_URL = "https://www.cloudflare.com/cloudflare-customer-dpa/";
const UAB_PORTAL_URL = "https://portal.uab.pt/";

const RETENTION = [
  ["Registos de entrega de notificações Push", "até 180 dias"],
  ["Subscrições Push desativadas", "até 90 dias"],
  ["Erros técnicos já resolvidos", "até 180 dias"],
  ["Respostas a inquéritos", "até 365 dias"],
  ["Propostas PUC já resolvidas", "até 730 dias"],
  ["Consultas administrativas de suporte", "até 365 dias"],
  ["Eventos de segurança", "normalmente 90–180 dias; até 365 dias quando necessário"],
] as const;

function ExternalLegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">{children}<ExternalLink className="h-3.5 w-3.5" /></a>;
}

export default function LegalPage() {
  return <div className="space-y-5">
    <div><Button asChild variant="ghost" size="sm"><Link to="/dados-privacidade"><ArrowLeft className="mr-2 h-4 w-4"/>Voltar a Os meus dados</Link></Button></div>

    <section className="premium-surface p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Scale className="h-6 w-6" /></div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Academic Hub · versão de privacidade 17/09/2026</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Privacidade e tratamento de dados</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Esta página explica, de forma transparente, que dados pessoais podem ser tratados pelo Academic Hub, para que finalidades, com que fundamento, durante quanto tempo, por quem e que direitos tens enquanto utilizador.</p>
        </div>
      </div>
    </section>

    <Card className="premium-card border-warning/35 bg-warning/10"><CardContent className="flex gap-3 p-4 sm:p-5"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning"/><div className="text-sm"><div className="font-semibold">Aplicação independente e não oficial</div><p className="mt-1 leading-6 text-muted-foreground">O Academic Hub é uma aplicação independente de apoio e organização académica. Não representa, não substitui e não é operado pela Universidade Aberta. Informação oficial deve ser confirmada no <ExternalLegalLink href={UAB_PORTAL_URL}>Portal UAb</ExternalLegalLink>.</p></div></CardContent></Card>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserCheck className="h-5 w-5 text-primary"/>Responsável pelo tratamento</CardTitle></CardHeader><CardContent className="space-y-2 text-sm leading-6 text-muted-foreground"><p className="font-medium text-foreground">Sérgio Neto</p><p>Criador e responsável pelo Academic Hub e, na medida em que determina as finalidades e os meios do tratamento efetuado pela aplicação, responsável pelo tratamento dos dados pessoais associados ao serviço.</p><p>Contacto preferencial para questões de privacidade, acesso, correção ou eliminação: área <Link className="font-medium text-primary hover:underline" to="/feedback">Feedback</Link> do Academic Hub, utilizando o teu ID Academic Hub sempre que possível.</p></CardContent></Card>
      <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-primary"/>Princípios aplicados</CardTitle></CardHeader><CardContent className="space-y-2 text-sm leading-6 text-muted-foreground"><p>O tratamento é organizado segundo princípios de licitude, lealdade e transparência, limitação das finalidades, minimização, exatidão, limitação da conservação, integridade, confidencialidade e responsabilização.</p><div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs"><ExternalLegalLink href={GDPR_URL}>RGPD — texto oficial</ExternalLegalLink><ExternalLegalLink href={EDPB_BASICS_URL}>EDPB — princípios de proteção de dados</ExternalLegalLink></div></CardContent></Card>
    </div>

    <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-5 w-5 text-primary"/>Que dados podem ser tratados e porquê</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">
      {[
        ["Conta e autenticação", "Email institucional, identificador técnico da conta e estado de confirmação, para criar e manter a conta e permitir autenticação."],
        ["Perfil e utilização", "Nome de apresentação, fotografia opcional, preferências e definições escolhidas pelo utilizador, para personalização da aplicação."],
        ["Dados académicos", "Licenciatura, cadeiras, datas, avaliações, classificações, notas e estado académico introduzido ou confirmado pelo utilizador, para organização, cálculos, alertas e relatórios."],
        ["Cloud e sincronização", "Estado académico, preferências e metadados técnicos de sincronização, quando o utilizador ativa funções cloud."],
        ["Notificações", "Subscrição Push, identificadores técnicos do dispositivo/navegador e registos de entrega, para enviar e diagnosticar notificações solicitadas pelo utilizador."],
        ["Feedback e suporte", "Pedidos, mensagens, anexos que envies e ID Academic Hub pseudónimo, para responder, acompanhar e corrigir problemas."],
        ["Erros e segurança", "Eventos técnicos, data/hora, versão da aplicação, dispositivo/navegador e, quando tecnicamente necessário, IP e país aproximado, para deteção de falhas, abuso e proteção do serviço."],
        ["PUC e inquéritos", "Correções PUC submetidas e respostas voluntárias a inquéritos, quando utilizas essas funcionalidades opcionais."],
      ].map(([title, text]) => <div key={title} className="rounded-xl border bg-muted/20 p-4"><div className="text-sm font-semibold text-foreground">{title}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div>)}
    </CardContent></Card>

    <Card className="premium-card"><CardHeader><CardTitle className="text-base">Fundamentos jurídicos utilizados</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p><strong className="text-foreground">Execução do serviço pedido pelo utilizador:</strong> conta, autenticação, cloud, organização académica, feedback e outras funções necessárias para prestar as funcionalidades solicitadas.</p><p><strong className="text-foreground">Consentimento:</strong> funcionalidades opcionais que dependem de uma escolha específica do utilizador, como fotografia de perfil, notificações Push ou participação voluntária em inquéritos, quando aplicável. O consentimento pode ser retirado através da própria funcionalidade ou eliminando o dado correspondente.</p><p><strong className="text-foreground">Interesses legítimos:</strong> segurança, prevenção de abuso, diagnóstico técnico, manutenção da integridade do serviço e conservação limitada de elementos necessários à defesa de direitos, desde que esses interesses não prevaleçam sobre os direitos e liberdades do utilizador.</p><p>O fundamento concreto depende da finalidade e do dado em causa. O Academic Hub não utiliza o consentimento como fundamento genérico para tudo.</p></CardContent></Card>

    <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-5 w-5 text-primary"/>Prestadores de infraestrutura</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p><strong className="text-foreground">Supabase:</strong> autenticação, base de dados, Storage e funções de backend utilizadas pelo Academic Hub. O tratamento depende das funcionalidades efetivamente usadas e das condições contratuais aplicáveis.</p><p><strong className="text-foreground">Cloudflare:</strong> alojamento e entrega da aplicação web/PWA e serviços de infraestrutura associados.</p><p>Estes fornecedores podem tratar dados técnicos necessários à prestação e segurança dos respetivos serviços. Quando existe tratamento em nome do responsável, aplicam-se os contratos e mecanismos de proteção de dados disponibilizados pelos fornecedores. Transferências internacionais, quando existam, ficam sujeitas aos mecanismos previstos no RGPD e aos instrumentos contratuais aplicáveis.</p><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs"><ExternalLegalLink href={SUPABASE_DPA_URL}>Supabase DPA</ExternalLegalLink><ExternalLegalLink href={CLOUDFLARE_DPA_URL}>Cloudflare DPA</ExternalLegalLink></div></CardContent></Card>

    <Card className="premium-card"><CardHeader><CardTitle className="text-base">Conservação dos dados</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">Os dados necessários à conta, sincronização e organização académica são conservados enquanto a conta se mantiver ativa ou até serem substituídos/eliminados pelo utilizador, salvo necessidade legal específica. Dados operacionais têm prazos próprios e limpeza automática.</p><div className="grid gap-2 md:grid-cols-2">{RETENTION.map(([label, period]) => <div key={label} className="grid min-w-0 gap-1 rounded-xl border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4"><span className="min-w-0 break-words text-xs font-medium">{label}</span><span className="min-w-0 break-words text-xs text-muted-foreground sm:text-right">{period}</span></div>)}</div><p className="text-xs leading-5 text-muted-foreground">Se a conta for eliminada, os registos associados ao utilizador e os anexos privados de feedback são removidos pelo procedimento de eliminação, exceto dados que devam ser conservados temporariamente por obrigação legal ou defesa de direitos.</p></CardContent></Card>

    <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-5 w-5 text-primary"/>Direitos do utilizador</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p>Nos termos do RGPD e quando aplicável, podes exercer os direitos de acesso, retificação, apagamento, limitação do tratamento, oposição e portabilidade, bem como retirar consentimentos anteriormente prestados sem afetar a licitude do tratamento anterior à retirada.</p><p>Alguns destes direitos podem ser exercidos diretamente na aplicação: consulta e correção do perfil e dados académicos, exportação dos dados locais e eliminação da conta. Para outros pedidos, utiliza o Feedback e identifica-te preferencialmente através do ID Academic Hub, evitando enviar dados pessoais desnecessários.</p><p>Os pedidos são tratados sem demora injustificada e, em regra, no prazo previsto pelo RGPD. Também tens o direito de apresentar reclamação à Comissão Nacional de Proteção de Dados.</p><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs"><ExternalLegalLink href={CNPD_RIGHTS_URL}>CNPD — Direitos</ExternalLegalLink><ExternalLegalLink href={CNPD_COMPLAINTS_URL}>CNPD — Participações/Reclamações</ExternalLegalLink></div></CardContent></Card>

    <Card className="premium-card border-primary/25"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-primary"/>Segurança e acessos administrativos</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p>O Academic Hub utiliza autenticação, regras de acesso à base de dados, ligações HTTPS, controlos de isolamento por utilizador e mecanismos de auditoria. O acesso administrativo destinado a suporte deve ser limitado ao mínimo necessário e as consultas por ID Academic Hub são registadas para efeitos de responsabilização.</p><p>O ID Academic Hub é um identificador pseudónimo para suporte. Não é palavra-passe, não substitui autenticação e, isoladamente, não dá acesso à conta.</p><p>Não são guardadas palavras-passe em registos de segurança nem são apresentados tokens completos ao administrador através das ferramentas de suporte.</p><Button asChild variant="outline" size="sm"><Link to="/seguranca-privacidade">Consultar Segurança e Privacidade</Link></Button></CardContent></Card>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="premium-card"><CardHeader><CardTitle className="text-base">Decisões automatizadas e perfis</CardTitle></CardHeader><CardContent className="space-y-2 text-sm leading-6 text-muted-foreground"><p>O Academic Hub não toma decisões exclusivamente automatizadas que produzam efeitos jurídicos ou afetem de forma semelhante e significativa o utilizador.</p><p>Cálculos de notas, alertas, ordenações e sugestões académicas são funções de apoio e não substituem decisões oficiais da Universidade Aberta.</p></CardContent></Card>
      <Card className="premium-card"><CardHeader><CardTitle className="text-base">Alterações a esta informação</CardTitle></CardHeader><CardContent className="space-y-2 text-sm leading-6 text-muted-foreground"><p>Esta informação é revista quando existam alterações relevantes nas finalidades, categorias de dados, fornecedores, prazos de conservação ou direitos do utilizador. Alterações materiais serão comunicadas de forma adequada antes de produzirem efeitos quando isso seja necessário.</p><p className="text-xs">Última revisão desta versão: 17 de setembro de 2026.</p></CardContent></Card>
    </div>

    <Card className="premium-card"><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-semibold">Fontes oficiais e informação adicional</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Podes confirmar diretamente os princípios, direitos e obrigações nas fontes oficiais.</p></div><div className="flex flex-wrap gap-2 text-xs"><ExternalLegalLink href={GDPR_URL}>RGPD</ExternalLegalLink><ExternalLegalLink href={EDPB_BASICS_URL}>EDPB</ExternalLegalLink><ExternalLegalLink href={CNPD_RIGHTS_URL}>CNPD</ExternalLegalLink></div></CardContent></Card>
  </div>;
}
