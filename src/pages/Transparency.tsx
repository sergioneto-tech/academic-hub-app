import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Fingerprint,
  LockKeyhole,
  Scale,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { getStoredSession } from "@/lib/cloudSync";
import { getPublicSupabaseConfig } from "@/lib/publicSupabaseConfig";
import {
  openTransparencyDocument,
  TRANSPARENCY_DOCUMENT_APPLIES_TO,
  TRANSPARENCY_DOCUMENT_VERSION,
} from "@/lib/transparencyDocument";

const officialLinks = [
  ["RGPD · EUR-Lex", "https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=pt"],
  ["CNPD · Direitos dos titulares", "https://www.cnpd.pt/cidadaos/direitos/"],
  ["CNPD · Medidas de segurança", "https://www.cnpd.pt/comunicacao-publica/noticias/diretriz-sobre-medidas-de-seguranca/"],
  ["EDPB · Privacy by design", "https://www.edpb.europa.eu/topics/ai-and-technology/privacy-by-design-and-by-default_en"],
  ["Supabase · Segurança", "https://supabase.com/docs/guides/security"],
] as const;

const faqs = [
  ["O Academic Hub é oficial da Universidade Aberta?", "Não. É um projeto pessoal e independente criado por um estudante. Não representa a UAb nem substitui plataformas, PUC, calendários, regulamentos ou qualquer outra fonte institucional."],
  ["Sou obrigado a utilizar a aplicação?", "Não. Ninguém é obrigado a utilizar o Academic Hub. É apenas mais uma ferramenta disponível. Se for útil, ótimo; se não for, o percurso académico continua normalmente através dos meios oficiais."],
  ["Porque existem agora mais informações sobre privacidade e segurança?", "Porque o projeto cresceu e passou a ser utilizado por dezenas de estudantes. Isso justificou formalizar melhor as medidas já existentes, reforçar outras e explicar de forma mais clara como os dados e os acessos são tratados."],
  ["O código-fonte é público?", "Não. O Academic Hub não é atualmente um projeto open source. O código é mantido num repositório privado. Isso é diferente do dever de transparência sobre os dados, finalidades, segurança e direitos dos utilizadores."],
  ["O Academic Hub é certificado RGPD?", "Não. O projeto não se apresenta como certificado pela CNPD, pelo EDPB ou por outra entidade. Procura aplicar medidas alinhadas com princípios e orientações oficiais, sem transformar essa referência numa certificação."],
  ["Porque o documento completo exige conta?", "O resumo essencial permanece público para qualquer visitante. O documento integral acompanha a utilização efetiva da aplicação e fica disponível a quem tenha uma conta autenticada no Academic Hub."],
] as const;

export default function TransparencyPage() {
  const config = useMemo(getPublicSupabaseConfig, []);
  const authenticated = Boolean(config && getStoredSession(config));
  const [opening, setOpening] = useState(false);

  const openDocument = async () => {
    if (!authenticated) return;
    try {
      setOpening(true);
      await openTransparencyDocument();
    } catch (error) {
      toast({
        title: "Não foi possível abrir o documento",
        description: error instanceof Error ? error.message : "Tenta novamente dentro de alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="space-y-6 pb-4">
      <div><Button asChild variant="ghost" size="sm"><Link to="/ajuda"><ArrowLeft className="mr-2 h-4 w-4" />Voltar à Ajuda</Link></Button></div>

      <section className="premium-surface overflow-hidden">
        <div className="relative p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold-soft)/0.5)] text-[hsl(var(--gold))]"><ShieldCheck className="h-7 w-7" /></div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sobre o Academic Hub</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Transparência e Privacidade</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Informação pública e simples sobre a natureza do projeto, utilização facultativa, proteção de dados, segurança e documentação disponível.</p>
              </div>
            </div>
            <div className="rounded-2xl border bg-card/80 p-4 text-xs shadow-sm">
              <div className="font-semibold">Documento de Transparência v{TRANSPARENCY_DOCUMENT_VERSION}</div>
              <div className="mt-1 text-muted-foreground">Aplicável ao Academic Hub {TRANSPARENCY_DOCUMENT_APPLIES_TO}</div>
            </div>
          </div>
        </div>
      </section>

      <Card className="premium-card border-[hsl(var(--gold)/0.35)]">
        <CardContent className="p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div><div className="flex items-center gap-2 text-sm font-semibold"><UserRoundCheck className="h-4 w-4 text-primary" />Projeto independente</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Criado e mantido por iniciativa pessoal de um estudante. Não é uma aplicação oficial da Universidade Aberta.</p></div>
            <div><div className="flex items-center gap-2 text-sm font-semibold"><Scale className="h-4 w-4 text-primary" />Utilização facultativa</div><p className="mt-2 text-xs leading-5 text-muted-foreground">Ninguém é obrigado a utilizar o Academic Hub. As fontes e sistemas oficiais da UAb continuam sempre a prevalecer.</p></div>
            <div><div className="flex items-center gap-2 text-sm font-semibold"><Fingerprint className="h-4 w-4 text-primary" />Privacidade por princípio</div><p className="mt-2 text-xs leading-5 text-muted-foreground">O projeto procura minimizar dados, limitar acessos, usar identificação pseudónima no suporte e explicar de forma clara as medidas adotadas.</p></div>
          </div>
        </CardContent>
      </Card>

      <section>
        <div className="mb-3"><h2 className="text-lg font-semibold">Perguntas frequentes</h2><p className="mt-1 text-xs text-muted-foreground">As dúvidas são normais. Estas respostas procuram esclarecer sem exigir registo.</p></div>
        <div className="grid gap-3 lg:grid-cols-2">
          {faqs.map(([question, answer]) => (
            <Card key={question} className="premium-card h-full">
              <CardHeader className="pb-2"><CardTitle className="text-sm leading-5">{question}</CardTitle></CardHeader>
              <CardContent><p className="text-xs leading-5 text-muted-foreground">{answer}</p></CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="premium-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" />Documento completo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">O documento integral reúne a evolução do projeto, medidas de privacidade e segurança, perguntas frequentes, código privado, desenvolvimento independente, visão futura e referências oficiais.</p>
          {authenticated ? (
            <Button type="button" onClick={() => void openDocument()} disabled={opening}>
              <FileText className="mr-2 h-4 w-4" />{opening ? "A abrir documento..." : "Consultar documento completo"}
            </Button>
          ) : (
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--gold))]" /><p className="text-xs leading-5 text-muted-foreground">O resumo e as fontes oficiais são públicos. O PDF integral fica disponível apenas depois de iniciares sessão.</p></div>
              <Button asChild variant="outline" size="sm"><Link to="/definicoes?conta=criar">Criar conta / entrar</Link></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="premium-card">
        <CardHeader><CardTitle className="text-base">Fontes oficiais</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {officialLinks.map(([label, href]) => <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 text-xs font-medium transition-colors hover:bg-accent">{label}<ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary" /></a>)}
        </CardContent>
      </Card>

      <p className="text-center text-[11px] leading-5 text-muted-foreground">Conceção e desenvolvimento: Sérgio Neto · Projeto independente de apoio à organização académica.</p>
    </div>
  );
}
