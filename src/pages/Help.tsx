import { Link } from "react-router-dom";
import {
  BookOpen,
  Cloud,
  ExternalLink,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  LifeBuoy,
  Printer,
  Scale,
  Settings,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const REGULATION_URL = "https://portal.uab.pt/avaliacao/";

const guides = [
  {
    title: "Primeiros passos",
    description: "Escolher a licenciatura, carregar o plano e ativar as cadeiras do semestre.",
    icon: GraduationCap,
  },
  {
    title: "Como usar o Academic Hub",
    description: "Visão geral do painel, calendário, plano de estudos, histórico e alertas.",
    icon: LayoutDashboard,
  },
  {
    title: "Como funciona a avaliação",
    description: "Regime oficial em vigor, configuração por cadeira, mínimos, exame e recurso.",
    icon: BookOpen,
  },
  {
    title: "Backup e sincronização",
    description: "Guardar, recuperar e sincronizar os dados com segurança entre dispositivos.",
    icon: Cloud,
  },
  {
    title: "Personalização",
    description: "Fotografia, licenciatura, modo claro, escuro ou automático e notificações.",
    icon: Settings,
  },
  {
    title: "Perguntas frequentes",
    description: "Respostas rápidas sobre notas, cadeiras, dados, instalação e atualizações.",
    icon: HelpCircle,
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-5">
      <section className="premium-surface overflow-hidden p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
              <LifeBuoy className="h-3.5 w-3.5 text-primary" />
              Centro de apoio
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ajuda & Guia</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Procedimentos, explicações e ligações úteis para utilizar o Academic Hub com segurança.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/definicoes">Abrir Definições</Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {guides.map(({ title, description, icon: Icon }) => (
          <Card key={title} className="premium-card h-full">
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border bg-primary/5 text-primary dark:bg-primary/10">
                <Icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{description}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="premium-card border-primary/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-5 w-5 text-primary" />
              Legal, privacidade e utilização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Consulta os compromissos do criador, as responsabilidades do utilizador, a política de privacidade,
              as regras para fotografias e os limites dos relatórios gerados pela aplicação.
            </p>
            <Button asChild variant="outline">
              <Link to="/legal">Consultar informação legal</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="premium-card border-primary/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Printer className="h-5 w-5 text-primary" />
              Relatório académico pessoal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Imprime ou guarda em PDF as cadeiras concluídas por ano e semestre, incluindo avaliações intercalares,
              exame, recurso, nota final e ECTS.
            </p>
            <Button asChild variant="outline">
              <Link to="/historico/relatorio">Abrir relatório</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="premium-card overflow-hidden border-[hsl(var(--gold)/0.45)]">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-[1fr_auto]">
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--gold-soft))] text-[hsl(var(--gold))]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Regulamento de avaliação atualmente publicado</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A UAb identifica o Despacho n.º 10317/2025 como regulamento em vigor e mantém, para 2025/26,
                    avaliação contínua ou avaliação final, conforme a unidade curricular.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center border-t bg-[hsl(var(--gold-soft)/0.55)] p-4 md:border-l md:border-t-0">
              <Button asChild className="w-full md:w-auto">
                <a href={REGULATION_URL} target="_blank" rel="noopener noreferrer">
                  Consultar na UAb <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="premium-card border-warning/35 bg-warning/10">
        <CardHeader>
          <CardTitle className="text-base">Configuração flexível de avaliação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Os modelos adicionais disponíveis na aplicação servem para preparar e testar diferentes estruturas indicadas no PUC de cada cadeira.</p>
          <p>Até existir uma publicação oficial definitiva com novas regras, devem ser tratados como configuração experimental e confirmados sempre com o PUC e o portal da UAb.</p>
        </CardContent>
      </Card>

      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-[hsl(var(--gold))]" />
            Novidades da versão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Após cada atualização importante, a aplicação apresenta um cartão com as alterações funcionais e visuais.</p>
          <p>O cartão pode ser fechado e as novidades continuam disponíveis nesta área de ajuda.</p>
        </CardContent>
      </Card>

      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="text-base">Ligações úteis mantidas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <a className="rounded-lg border p-3 hover:bg-accent" href="https://portal.uab.pt/" target="_blank" rel="noopener noreferrer">Portal UAb</a>
          <a className="rounded-lg border p-3 hover:bg-accent" href="https://guiadoscursos.uab.pt/" target="_blank" rel="noopener noreferrer">Guia dos Cursos</a>
          <a className="rounded-lg border p-3 hover:bg-accent" href="https://portal.uab.pt/calendario-letivo/" target="_blank" rel="noopener noreferrer">Calendário letivo</a>
          <a className="rounded-lg border p-3 hover:bg-accent" href="https://www.dges.gov.pt/" target="_blank" rel="noopener noreferrer">DGES</a>
        </CardContent>
      </Card>
    </div>
  );
}
