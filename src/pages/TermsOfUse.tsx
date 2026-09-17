import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  ExternalLink,
  FileCheck2,
  Image,
  Scale,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const UAB_PORTAL_URL = "https://portal.uab.pt/";
const CIVIL_CODE_IMAGE_URL = "https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1966-34509075-49761975";

function ExternalTermLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">{children}<ExternalLink className="h-3.5 w-3.5" /></a>;
}

const userResponsibilities = [
  "Utilizar a aplicação de forma legítima e apenas para fins compatíveis com organização e apoio académico.",
  "Manter as credenciais da conta protegidas e não as partilhar com terceiros.",
  "Introduzir apenas dados próprios ou dados que esteja legitimado a tratar.",
  "Confirmar no PUC e nas fontes oficiais da Universidade Aberta datas, regras, classificações e decisões académicas.",
  "Não tentar contornar controlos de segurança, aceder a contas de terceiros ou interferir com o funcionamento do serviço.",
  "Evitar enviar pelo Feedback dados pessoais de terceiros ou informação que não seja necessária ao pedido.",
];

export default function TermsOfUsePage() {
  return <div className="space-y-5 pb-4">
    <div><Button asChild variant="ghost" size="sm"><Link to="/dados-privacidade"><ArrowLeft className="mr-2 h-4 w-4"/>Voltar a Os meus dados</Link></Button></div>

    <section className="premium-surface p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><FileCheck2 className="h-6 w-6" /></div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Academic Hub · versão 17/09/2026</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Termos de Utilização</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Condições de utilização do Academic Hub, responsabilidades do utilizador, limites do serviço e relação com as restantes áreas de privacidade e segurança.</p>
        </div>
      </div>
    </section>

    <Card className="premium-card border-warning/35 bg-warning/10"><CardContent className="flex gap-3 p-4 sm:p-5"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning"/><div className="text-sm"><div className="font-semibold">Aplicação independente e não oficial</div><p className="mt-1 leading-6 text-muted-foreground">O Academic Hub é uma aplicação independente de apoio e organização académica. Não representa, não substitui e não é operado pela Universidade Aberta. Informação oficial deve ser confirmada no <ExternalTermLink href={UAB_PORTAL_URL}>Portal UAb</ExternalTermLink>.</p></div></CardContent></Card>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpenCheck className="h-5 w-5 text-primary"/>Objeto do serviço</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p>O Academic Hub disponibiliza ferramentas pessoais de organização académica, incluindo gestão de cadeiras e avaliações, calendário, cálculos de apoio, relatórios pessoais, notificações, sincronização cloud, feedback e outras funcionalidades indicadas na aplicação.</p><p>Ao criares uma conta e utilizares funcionalidades pessoais, solicitas a disponibilização dessas funcionalidades nas condições descritas nestes Termos e na Política de Privacidade.</p></CardContent></Card>
      <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Scale className="h-5 w-5 text-primary"/>Natureza da informação</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p>Os cálculos, alertas, previsões, relatórios e organização apresentada pelo Academic Hub são instrumentos de apoio. Não constituem informação académica oficial, certificado, pauta, declaração ou decisão da Universidade Aberta.</p><p>Em caso de divergência, prevalecem sempre o PUC, os regulamentos, o Portal UAb e as comunicações oficiais aplicáveis.</p></CardContent></Card>
    </div>

    <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserRoundCheck className="h-5 w-5 text-primary"/>Responsabilidades do utilizador</CardTitle></CardHeader><CardContent><ul className="grid gap-3 text-sm leading-6 text-muted-foreground md:grid-cols-2">{userResponsibilities.map(item => <li key={item} className="flex gap-2 rounded-xl border bg-muted/20 p-3"><FileCheck2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"/><span>{item}</span></li>)}</ul></CardContent></Card>

    <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Image className="h-5 w-5 text-primary"/>Fotografias e conteúdos enviados</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p>A fotografia de perfil é opcional e destina-se à personalização da própria conta. O utilizador deve carregar apenas uma fotografia própria ou uma imagem cuja utilização esteja legitimamente autorizada.</p><p>Nos pedidos de Feedback e respetivos anexos, devem ser incluídos apenas os elementos necessários para compreender o problema. Não devem ser enviados dados pessoais de terceiros, documentos académicos completos ou informação sensível quando uma descrição ou recorte limitado seja suficiente.</p><ExternalTermLink href={CIVIL_CODE_IMAGE_URL}>Código Civil — direito à imagem, artigo 79.º</ExternalTermLink></CardContent></Card>

    <Card className="premium-card"><CardHeader><CardTitle className="text-base">Disponibilidade, manutenção e alterações</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p>O Academic Hub pode receber atualizações, correções, manutenção ou alterações funcionais necessárias à segurança, compatibilidade ou evolução do serviço. Sempre que uma alteração material afete a utilização, a privacidade ou as condições relevantes do serviço, a informação correspondente será atualizada e comunicada de forma adequada.</p><p>Não é possível garantir disponibilidade ininterrupta ou ausência absoluta de erros. Quando exista uma falha conhecida, o objetivo é corrigi-la sem apresentar como resolvido aquilo que ainda não foi tecnicamente confirmado.</p></CardContent></Card>

    <Card className="premium-card"><CardHeader><CardTitle className="text-base">Conta, suspensão e eliminação</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p>O utilizador pode terminar a utilização e eliminar a conta através das opções disponibilizadas na aplicação. A eliminação segue o procedimento descrito na Política de Privacidade.</p><p>O acesso pode ser limitado quando exista abuso técnico, tentativa de acesso indevido, utilização manifestamente incompatível com o serviço ou necessidade de proteger outros utilizadores e a infraestrutura. Qualquer intervenção deve ser proporcional à situação e, quando adequado, registada para efeitos de segurança e responsabilização.</p></CardContent></Card>

    <Card className="premium-card border-primary/25"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-primary"/>Documentos relacionados</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>Privacidade, condições de utilização e informação técnica de segurança são apresentadas separadamente para facilitar a leitura e evitar misturar obrigações diferentes.</p><div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link to="/legal">Privacidade e RGPD</Link></Button><Button asChild variant="outline" size="sm"><Link to="/seguranca-transparencia">Segurança e Transparência</Link></Button><Button asChild variant="outline" size="sm"><Link to="/dados-privacidade">Os meus dados</Link></Button></div></CardContent></Card>

    <p className="text-xs leading-5 text-muted-foreground">Última revisão: 17 de setembro de 2026.</p>
  </div>;
}
