import {
  AlertTriangle,
  Camera,
  Database,
  ExternalLink,
  FileCheck2,
  GraduationCap,
  Scale,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CIVIL_CODE_IMAGE_URL = "https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1966-34509075-49761975";
const PENAL_CODE_PHOTO_URL = "https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1995-34437675-49701175";
const CNPD_RIGHTS_URL = "https://www.cnpd.pt/cidadaos/direitos/";
const UAB_PORTAL_URL = "https://portal.uab.pt/";
const CONTACT_EMAIL = "sergioneto78@gmail.com";

const creatorCommitments = [
  "Recolher apenas os dados necessários ao funcionamento da aplicação.",
  "Não vender dados pessoais nem criar perfis públicos dos utilizadores.",
  "Manter mecanismos de backup, exportação, eliminação e proteção da conta.",
  "Corrigir falhas de segurança conhecidas e comunicar alterações relevantes.",
  "Indicar claramente as fontes externas e a natureza não oficial da aplicação.",
];

const userCommitments = [
  "Introduzir apenas dados próprios ou dados que esteja legitimado a tratar.",
  "Utilizar uma fotografia própria ou cuja utilização tenha sido autorizada.",
  "Proteger as credenciais da conta e os ficheiros de backup exportados.",
  "Confirmar datas, avaliações e regras no PUC e nas fontes oficiais da UAb.",
  "Não apresentar relatórios gerados pela aplicação como certificados oficiais.",
];

function ExternalLegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

export default function LegalPage() {
  return (
    <div className="space-y-5">
      <section className="premium-surface p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Academic Hub</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Legal, Privacidade e Utilização</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Informação sobre responsabilidades, tratamento de dados, utilização de fotografias e limites da aplicação.
              Este conteúdo é informativo e não substitui aconselhamento jurídico.
            </p>
          </div>
        </div>
      </section>

      <Card className="premium-card border-warning/35 bg-warning/10">
        <CardContent className="flex gap-3 p-4 sm:p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="text-sm">
            <div className="font-semibold">Aplicação independente e não oficial</div>
            <p className="mt-1 leading-6 text-muted-foreground">
              O Academic Hub é uma ferramenta pessoal de organização académica. Não representa, não substitui e não é
              operado pela Universidade Aberta. Pautas, certificados, regulamentos, datas e classificações oficiais devem
              ser confirmados no <ExternalLegalLink href={UAB_PORTAL_URL}>Portal UAb</ExternalLegalLink>.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Compromissos do criador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {creatorCommitments.map((item) => (
                <li key={item} className="flex gap-2">
                  <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-5 w-5 text-primary" />
              Responsabilidades do utilizador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {userCommitments.map((item) => (
                <li key={item} className="flex gap-2">
                  <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-5 w-5 text-primary" />
            Fotografias, imagem e conteúdos carregados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            A fotografia de perfil é opcional e destina-se apenas à personalização do próprio utilizador. O Academic Hub
            não é uma rede social, não cria galerias públicas e não autoriza a reutilização de imagens de terceiros.
          </p>
          <p>
            Quem carregar uma fotografia declara que é a pessoa retratada ou que possui autorização adequada para a sua
            utilização. O direito à imagem está protegido pelo artigo 79.º do Código Civil, que também prevê exceções
            legais específicas. O artigo 199.º do Código Penal abrange fotografar, filmar ou utilizar imagens contra a
            vontade da pessoa retratada. Situações de devassa da intimidade têm enquadramento penal próprio e mais grave.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-xs">
            <ExternalLegalLink href={CIVIL_CODE_IMAGE_URL}>Código Civil — artigo 79.º</ExternalLegalLink>
            <ExternalLegalLink href={PENAL_CODE_PHOTO_URL}>Código Penal — artigo 199.º</ExternalLegalLink>
          </div>
        </CardContent>
      </Card>

      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-primary" />
            Política de privacidade
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 text-sm leading-6 text-muted-foreground md:grid-cols-2">
          <div className="space-y-2">
            <h2 className="font-semibold text-foreground">Dados tratados</h2>
            <p>
              Nome de apresentação, email da conta, fotografia opcional, licenciatura, cadeiras, datas, avaliações,
              classificações, preferências, backups e metadados técnicos de sincronização.
            </p>
            <h2 className="pt-2 font-semibold text-foreground">Finalidades</h2>
            <p>
              Organizar o percurso académico, calcular resultados, gerar alertas e relatórios, personalizar a experiência,
              recuperar dados e sincronizar dispositivos quando essa opção é ativada.
            </p>
          </div>
          <div className="space-y-2">
            <h2 className="font-semibold text-foreground">Conservação e controlo</h2>
            <p>
              Os dados locais permanecem no dispositivo até serem eliminados pelo utilizador. Quando a sincronização cloud
              é utilizada, os dados permanecem associados à conta até serem substituídos, apagados ou a conta ser eliminada.
            </p>
            <h2 className="pt-2 font-semibold text-foreground">Direitos do titular</h2>
            <p>
              O utilizador pode consultar, corrigir, exportar e eliminar os seus dados através da aplicação. Outros direitos
              previstos no RGPD podem ser exercidos através do contacto indicado abaixo.
            </p>
            <ExternalLegalLink href={CNPD_RIGHTS_URL}>Consultar direitos na CNPD</ExternalLegalLink>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-5 w-5 text-primary" />
              Dados académicos e relatórios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
            <p>As notas e datas são introduzidas ou confirmadas pelo utilizador e podem conter erros ou estar desatualizadas.</p>
            <p>
              Relatórios impressos ou guardados em PDF são documentos pessoais de acompanhamento. Não substituem certidões,
              pautas, declarações ou históricos emitidos oficialmente pela instituição de ensino.
            </p>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader>
            <CardTitle className="text-base">Contacto e exercício de direitos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
            <p>Responsável pelo projeto: Sérgio Neto.</p>
            <p>
              Contacto: <a className="font-medium text-primary hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </p>
            <p>
              Para pedidos de acesso, correção, exportação, eliminação ou esclarecimentos, identifica a conta utilizada e
              descreve apenas os dados estritamente necessários ao pedido.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
