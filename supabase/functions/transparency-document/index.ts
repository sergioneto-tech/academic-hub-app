import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "npm:pdf-lib@1.17.1";

const ALLOWED_ORIGINS = new Set([
  "https://academichub.sergioneto.pt",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const cors = (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://academichub.sergioneto.pt";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
};

type Paragraph = { text: string; bold?: boolean; bullet?: boolean; link?: string };
type Section = { title: string; paragraphs: Paragraph[]; newPage?: boolean };

const sections: Section[] = [
  {
    title: "1. Resumo executivo",
    paragraphs: [
      { text: "O Academic Hub nasceu como uma ferramenta de organização académica criada por um estudante para uso próprio. A adesão espontânea de outros colegas transformou gradualmente esse projeto pessoal numa aplicação utilizada por dezenas de estudantes. Em 17 de setembro de 2026, o serviço contabiliza 89 registos de utilizador." },
      { text: "Uma ferramenta facultativa, não uma plataforma oficial", bold: true },
      { text: "O Academic Hub não é uma aplicação oficial da Universidade Aberta, não substitui os sistemas institucionais e não é obrigatório. Cada estudante decide livremente se a ferramenta lhe é útil. Em caso de divergência, prevalecem sempre as fontes e documentos oficiais da Universidade." },
      { text: "O crescimento do projeto justificou uma nova fase de maturidade: formalizar e tornar mais visíveis medidas de proteção de dados, segurança, auditoria, retenção, eliminação de conta e transparência. O objetivo não é apresentar uma certificação jurídica da aplicação, mas demonstrar de forma clara as medidas adotadas e o enquadramento oficial que serviu de referência." },
      { text: "O que este documento pretende esclarecer", bold: true },
      { text: "qual é a natureza do Academic Hub e quem o mantém;", bullet: true },
      { text: "porque foram reforçadas as áreas de privacidade e segurança;", bullet: true },
      { text: "que medidas técnicas e organizativas foram introduzidas;", bullet: true },
      { text: "porque o código-fonte não é público e o que isso significa;", bullet: true },
      { text: "como se enquadra a funcionalidade de leitura/importação de PUC no desenvolvimento do projeto;", bullet: true },
      { text: "qual é a visão futura: continuar como ferramenta independente ou, idealmente, inspirar uma solução institucional ainda melhor.", bullet: true },
      { text: "Nota de enquadramento", bold: true },
      { text: "O facto de o Academic Hub ser um projeto pessoal, e não uma empresa, não significa que a proteção de dados deixe de ser relevante. O RGPD define o responsável pelo tratamento de forma ampla, podendo tratar-se de uma pessoa singular ou coletiva que determine as finalidades e os meios do tratamento. Por essa razão, a opção adotada pelo projeto é assumir explicitamente a responsabilidade operacional pelas decisões técnicas e pela informação prestada aos utilizadores." },
    ],
  },
  {
    title: "2. Natureza do projeto, independência e responsabilidade",
    newPage: true,
    paragraphs: [
      { text: "O Academic Hub é um projeto independente, concebido e desenvolvido por iniciativa pessoal de um estudante da Universidade Aberta. Não é uma empresa, não é um serviço contratado pela Universidade e não representa institucionalmente a UAb." },
      { text: "A infraestrutura técnica é gerida pelo responsável pelo projeto através de serviços tecnológicos externos utilizados para alojamento, autenticação, base de dados, armazenamento, funções de servidor e publicação da aplicação. A utilização de fornecedores tecnológicos não transfere automaticamente para esses fornecedores todas as responsabilidades relativas à forma como a aplicação é configurada ou aos dados que decide tratar." },
      { text: "Responsabilidade não depende de existir uma empresa", bold: true },
      { text: "O RGPD admite expressamente que o responsável pelo tratamento seja uma pessoa singular. Ser um projeto pessoal não é, por si só, uma dispensa de responsabilidade. Por isso, o Academic Hub procura aplicar princípios de transparência, minimização, segurança, limitação de acesso e conservação adequada, mesmo sem existir uma estrutura empresarial." },
      { text: "Projeto independente e utilização voluntária", bold: true },
      { text: "A existência do Academic Hub não altera nem substitui qualquer obrigação académica. O estudante pode utilizar apenas os sistemas oficiais da UAb e nunca é obrigado a criar conta no Academic Hub. A aplicação deve ser entendida como uma camada adicional de organização." },
      { text: "Uma ambição futura, não uma alegação atual", bold: true },
      { text: "O projeto tem uma ambição legítima: demonstrar que determinadas dificuldades sentidas pelos estudantes podem ser reduzidas através de uma experiência digital mais integrada. O cenário ideal seria que, no futuro, a Universidade Aberta entendesse o valor deste tipo de abordagem e optasse por adotar, desenvolver ou disponibilizar uma solução institucional equivalente ou ainda melhor." },
      { text: "Essa possibilidade é apresentada apenas como visão de futuro. À data deste documento, o Academic Hub continua a ser um projeto independente e não existe qualquer afirmação de adoção, parceria, validação institucional ou representação oficial pela Universidade Aberta." },
    ],
  },
  {
    title: "3. Da ferramenta pessoal a uma aplicação usada por dezenas de estudantes",
    newPage: true,
    paragraphs: [
      { text: "A primeira motivação do Academic Hub foi prática: reduzir o esforço necessário para organizar informação académica dispersa e manter uma visão clara das tarefas e datas relevantes. Durante a fase inicial, muitas operações dependiam de introdução manual pelo próprio estudante." },
      { text: "Com o aumento da utilização, começaram a surgir sugestões e dificuldades repetidas. Uma das mais relevantes foi precisamente o trabalho necessário para transcrever manualmente informação de documentos académicos, como o PUC. Essa utilização real influenciou a evolução do projeto e ajudou a priorizar automatismos que inicialmente tinham ficado apenas como ideia ou possibilidade futura." },
      { text: "89 registos não “ativam” o RGPD", bold: true },
      { text: "As regras de proteção de dados não começam num número específico de utilizadores. O crescimento para 89 registos é relevante por outra razão: tornou evidente que uma ferramenta inicialmente pessoal passou a ter utilização comunitária suficiente para justificar documentação mais formal, avisos claros na aplicação e revisões técnicas regulares." },
      { text: "Crescer também significa documentar", bold: true },
      { text: "A evolução recente não deve ser interpretada como uma admissão de que antes não existiam controlos. Significa que, à medida que a aplicação cresce, os controlos técnicos, a documentação e a comunicação com os utilizadores também devem amadurecer." },
    ],
  },
  {
    title: "4. Medidas de privacidade, segurança e transparência reforçadas",
    newPage: true,
    paragraphs: [
      { text: "A versão 1.6.6 consolida várias alterações destinadas a tornar a aplicação mais clara e robusta. Entre as medidas implementadas e revistas encontram-se:" },
      { text: "identificador pseudónimo de suporte, reduzindo a necessidade de expor diretamente e-mail ou número de estudante em tarefas de apoio;", bullet: true },
      { text: "limitação e auditoria de determinados acessos administrativos de suporte;", bullet: true },
      { text: "regras de Row Level Security (RLS) e permissões de base de dados para restringir o acesso aos dados;", bullet: true },
      { text: "operações sensíveis executadas no servidor, com autenticação e controlos adequados ao respetivo caso de uso;", bullet: true },
      { text: "regras explícitas de retenção de dados operacionais e limpeza periódica de registos que deixem de ser necessários;", bullet: true },
      { text: "reforço do processo de eliminação de conta, incluindo verificação da remoção de ficheiros associados;", bullet: true },
      { text: "endurecimento dos recibos de leitura de mensagens de suporte, evitando uma função privilegiada exposta a utilizadores autenticados;", bullet: true },
      { text: "mecanismos de monitorização e registo de determinados erros e eventos de segurança;", bullet: true },
      { text: "processo controlado de atualização da PWA, reduzindo o risco de combinações inconsistentes entre versões de ficheiros da aplicação.", bullet: true },
      { text: "O que foi verificado antes desta publicação", bold: true },
      { text: "Foi efetuada uma revisão técnica dos pontos considerados mais críticos. Entre outros controlos, foi verificado o estado do projeto de base de dados, políticas RLS e privilégios relevantes, exposição de funções privilegiadas, funções de servidor sensíveis, processo de build, testes, dependências e consistência das migrações." },
      { text: "Estas verificações não constituem uma certificação de segurança independente. Representam um processo de desenvolvimento e revisão interna orientado para reduzir riscos e detetar regressões antes da publicação de novas versões." },
    ],
  },
  {
    title: "5. Perguntas frequentes",
    newPage: true,
    paragraphs: [
      { text: "O Academic Hub é oficial da Universidade Aberta?", bold: true },
      { text: "Não. É um projeto independente, criado por um estudante. Não representa a Universidade Aberta e não substitui plataformas, PUC, calendários, regulamentos ou qualquer outra fonte institucional." },
      { text: "Sou obrigado a utilizar a aplicação?", bold: true },
      { text: "Não. A utilização é facultativa. Um estudante pode realizar o seu percurso académico apenas através das ferramentas oficiais. O Academic Hub existe como opção adicional para quem considere que melhora a sua organização." },
      { text: "Porque surgiram agora mais avisos sobre privacidade e segurança?", bold: true },
      { text: "Porque a utilização cresceu e tornou-se adequado transformar medidas técnicas dispersas numa política mais clara, visível e documentada." },
      { text: "O facto de o projeto ser pessoal significa que não existem responsabilidades de proteção de dados?", bold: true },
      { text: "Não. O RGPD prevê que o responsável pelo tratamento possa ser uma pessoa singular. O caráter pessoal do projeto não elimina automaticamente as responsabilidades associadas às decisões sobre a finalidade e os meios do tratamento." },
      { text: "O Academic Hub é “certificado RGPD”?", bold: true },
      { text: "Não. O projeto não se apresenta como certificado pela CNPD, pelo EDPB ou por outra autoridade. A formulação adequada é que procura adotar medidas alinhadas com princípios e orientações oficiais." },
      { text: "Outros utilizadores conseguem consultar os meus dados?", bold: true },
      { text: "A aplicação utiliza controlos de autenticação, permissões e políticas de acesso ao nível da base de dados. O objetivo é que cada utilizador tenha acesso apenas ao que lhe é destinado." },
      { text: "Um administrador pode consultar tudo livremente?", bold: true },
      { text: "Não é esse o modelo adotado. Foram criados mecanismos específicos de suporte, redução dos dados apresentados e registo de determinados acessos administrativos." },
      { text: "Posso eliminar a minha conta?", bold: true },
      { text: "A aplicação possui um processo de eliminação de conta reforçado para tratar também ficheiros associados e verificar a limpeza antes da eliminação final da identidade de autenticação." },
    ],
  },
  {
    title: "6. Código privado, colaboração e desenvolvimento independente",
    newPage: true,
    paragraphs: [
      { text: "O código-fonte do Academic Hub é público?", bold: true },
      { text: "Não. O código-fonte é mantido num repositório de acesso restrito. O Academic Hub não é atualmente um projeto open source." },
      { text: "Código privado significa falta de transparência?", bold: true },
      { text: "Não são a mesma coisa. A transparência em proteção de dados diz respeito, entre outros aspetos, a explicar quem trata os dados, para que fins, que categorias de informação estão envolvidas, durante quanto tempo são conservadas e quais os direitos dos utilizadores. Publicar integralmente o código-fonte não é uma condição geral prevista pelo RGPD para cumprir esse dever de transparência." },
      { text: "Porque não abrir o código para que outros colegas possam desenvolver diretamente?", bold: true },
      { text: "Foi escolhido um modelo de desenvolvimento controlado: uma linha única de manutenção, revisão antes de produção, gestão centralizada das alterações e separação entre código público e configurações/credenciais sensíveis. Sugestões, relatos de erros e ideias continuam a ser bem-vindos sem necessidade de acesso ao repositório." },
      { text: "Se outro projeto tiver uma funcionalidade semelhante, isso significa que houve cópia?", bold: true },
      { text: "Não é possível concluir isso apenas pela semelhança funcional. Ferramentas que procuram resolver o mesmo problema podem naturalmente convergir em funcionalidades parecidas. No Academic Hub, as decisões de implementação são integradas no histórico próprio do projeto, resultam de necessidades já identificadas e são desenvolvidas dentro da sua arquitetura e código próprios." },
      { text: "A funcionalidade de leitura/importação do PUC", bold: true },
      { text: "A redução da introdução manual de dados era uma necessidade identificada desde as fases iniciais do Academic Hub. A ideia de aproveitar informação existente no PUC ficou inicialmente sem implementação prática. Com o crescimento do número de utilizadores, tornou-se mais frequente a observação de que preencher todas as datas manualmente era moroso, o que voltou a dar prioridade a essa funcionalidade." },
      { text: "A implementação avançou posteriormente num período em que outros projetos académicos também exploraram formas de organizar informação semelhante. A proximidade temporal não altera a origem independente do desenvolvimento do Academic Hub. O objetivo funcional é comum e compreensível: evitar que o estudante tenha de repetir manualmente informação que já existe num documento académico." },
      { text: "Ideias e expressão de software são conceitos diferentes", bold: true },
      { text: "A Diretiva 2009/24/CE da União Europeia estabelece que a proteção por direitos de autor dos programas de computador incide sobre a expressão do programa; as ideias e princípios subjacentes aos seus elementos e interfaces não são, enquanto tais, protegidos por direitos de autor. Esta referência não substitui uma análise jurídica de casos concretos." },
      { text: "O Academic Hub não utiliza esta nota para desvalorizar outros projetos. Diferentes estudantes podem identificar as mesmas dificuldades e chegar a soluções distintas. O critério relevante para este projeto é manter desenvolvimento próprio, respeito pelo trabalho alheio e uma comunicação clara sobre a sua evolução." },
    ],
  },
  {
    title: "7. Visão futura: de projeto de aluno a inspiração para uma solução institucional",
    newPage: true,
    paragraphs: [
      { text: "O Academic Hub não pretende competir com a Universidade Aberta. A ambição é exatamente a inversa: demonstrar, através de utilização real, que determinadas necessidades de organização dos estudantes podem ser respondidas de forma mais integrada." },
      { text: "O melhor resultado possível", bold: true },
      { text: "Se a experiência acumulada com o Academic Hub ajudar a demonstrar valor suficiente para que a UAb venha um dia a desenvolver, adotar ou disponibilizar uma solução institucional equivalente ou superior, o objetivo do projeto terá sido plenamente cumprido." },
      { text: "Uma solução institucional teria naturalmente condições diferentes: governação formal, integração direta com sistemas oficiais, responsabilidades institucionais, equipas dedicadas, processos de suporte e capacidade de transformar informação oficial em dados sincronizados sem depender das mesmas limitações de um projeto independente." },
      { text: "Até que isso aconteça — caso venha a acontecer — o Academic Hub continuará a assumir aquilo que é: uma ferramenta opcional, independente e em evolução, desenvolvida para facilitar a vida académica dos seus utilizadores sem substituir a fonte oficial." },
      { text: "Transparência dentro da própria aplicação", bold: true },
      { text: "O ambiente de exploração apresenta informação resumida sobre o Academic Hub, a sua natureza independente, utilização facultativa, privacidade, segurança e fontes oficiais. O documento integral fica disponível dentro da aplicação apenas para utilizadores com conta autenticada." },
    ],
  },
  {
    title: "8. Referências oficiais",
    newPage: true,
    paragraphs: [
      { text: "Regulamento (UE) 2016/679 — Regulamento Geral sobre a Proteção de Dados (RGPD)", bold: true, link: "https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=pt" },
      { text: "Definições, princípios, transparência, direitos, proteção de dados desde a conceção e segurança do tratamento." },
      { text: "Diretriz 1/2023 — Medidas organizativas e de segurança · CNPD", bold: true, link: "https://www.cnpd.pt/comunicacao-publica/noticias/diretriz-sobre-medidas-de-seguranca/" },
      { text: "Direitos dos titulares de dados · CNPD", bold: true, link: "https://www.cnpd.pt/cidadaos/direitos/" },
      { text: "Privacy by design and by default · EDPB", bold: true, link: "https://www.edpb.europa.eu/topics/ai-and-technology/privacy-by-design-and-by-default_en" },
      { text: "Guidelines 4/2019 on Article 25 GDPR · EDPB", bold: true, link: "https://www.edpb.europa.eu/documents/guideline/guidelines-42019-on-article-25-data-protection-by-design-and-by-default_en" },
      { text: "Diretiva 2009/24/CE — Proteção jurídica dos programas de computador", bold: true, link: "https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=CELEX:32009L0024" },
      { text: "Supabase Security", bold: true, link: "https://supabase.com/docs/guides/security" },
      { text: "Row Level Security · Supabase", bold: true, link: "https://supabase.com/docs/guides/database/postgres/row-level-security" },
      { text: "Shared Responsibility Model · Supabase", bold: true, link: "https://supabase.com/docs/guides/deployment/shared-responsibility-model" },
      { text: "Nota sobre certificação e alcance", bold: true },
      { text: "Este documento é informativo. Não constitui parecer jurídico, auditoria independente, certificação RGPD nem validação pela CNPD, pelo EDPB, pela Universidade Aberta ou por qualquer outra entidade." },
    ],
  },
  {
    title: "9. Compromisso de evolução e identificação do projeto",
    newPage: true,
    paragraphs: [
      { text: "O Academic Hub continuará a evoluir com base em três ideias simples: recolher apenas o necessário, limitar o acesso ao necessário e explicar de forma clara como a aplicação funciona." },
      { text: "Nenhum sistema deve apresentar-se como infalível. A segurança exige revisão, atualização e capacidade para corrigir problemas quando são encontrados. A existência deste documento faz parte desse compromisso de transparência e deverá acompanhar futuras versões relevantes da aplicação." },
      { text: "Estado do documento", bold: true },
      { text: "Versão 1.0 publicada em 17 de setembro de 2026 e aplicável ao Academic Hub 1.6.6. As medidas descritas neste documento correspondem à versão colocada em produção nessa data. O documento deverá ser revisto sempre que alterações relevantes de funcionamento, privacidade, segurança ou tratamento de dados o justifiquem." },
      { text: "ACADEMIC HUB", bold: true },
      { text: "Conceção e desenvolvimento: Sérgio Neto" },
      { text: "Projeto independente de apoio à organização académica" },
      { text: "academichub.sergioneto.pt", link: "https://academichub.sergioneto.pt/" },
    ],
  },
];

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 58;
const TOP = 62;
const BOTTOM = 54;
const BODY_SIZE = 10.2;
const LINE = 14.2;
const NAVY = rgb(0.025, 0.07, 0.14);
const CYAN = rgb(0.0, 0.78, 0.93);
const GOLD = rgb(0.76, 0.58, 0.18);
const DARK = rgb(0.10, 0.13, 0.18);
const MUTED = rgb(0.38, 0.42, 0.48);

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
    if (req.method !== "GET") return new Response("Method not allowed", { status: 405, headers: cors(req) });

    const pdf = await PDFDocument.create();
    pdf.setTitle("Academic Hub — Transparência, Privacidade e Evolução do Projeto");
    pdf.setSubject("Informação aos utilizadores, privacidade, segurança e evolução do projeto");
    pdf.setAuthor("Sérgio Neto");
    pdf.setCreator("Academic Hub");
    pdf.setProducer("Academic Hub");
    pdf.setKeywords(["Academic Hub", "privacidade", "segurança", "transparência", "RGPD"]);

    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let logo: Uint8Array | null = null;
    try {
      const response = await fetch("https://academichub.sergioneto.pt/academic-hub-icon-v10-512.png", { cache: "force-cache" });
      if (response.ok) logo = new Uint8Array(await response.arrayBuffer());
    } catch {}

    let page: PDFPage;
    let y = PAGE_H - TOP;
    let pageNo = 0;

    const decorate = (p: PDFPage, title?: string) => {
      pageNo += 1;
      p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.985, 0.99, 1) });
      p.drawRectangle({ x: 0, y: PAGE_H - 20, width: PAGE_W, height: 20, color: NAVY });
      p.drawText("ACADEMIC HUB  |  TRANSPARÊNCIA E PRIVACIDADE", { x: MARGIN_X, y: PAGE_H - 14, size: 7.4, font: bold, color: rgb(0.82, 0.88, 0.94) });
      if (title) p.drawText(title, { x: MARGIN_X, y: PAGE_H - 45, size: 9, font: bold, color: MUTED });
      p.drawText(`Documento v1.0  ·  ${pageNo}`, { x: MARGIN_X, y: 27, size: 7.5, font: regular, color: MUTED });
      p.drawText("academichub.sergioneto.pt", { x: PAGE_W - 165, y: 27, size: 7.5, font: regular, color: MUTED });
    };

    const newPage = (title?: string) => {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      decorate(page, title);
      y = PAGE_H - (title ? 76 : TOP);
      return page;
    };

    page = newPage();
    page.drawRectangle({ x: 34, y: 106, width: PAGE_W - 68, height: PAGE_H - 142, color: NAVY });
    if (logo) {
      try {
        const image = await pdf.embedPng(logo);
        page.drawImage(image, { x: 72, y: 615, width: 64, height: 64 });
      } catch {}
    }
    page.drawText("ACADEMIC HUB", { x: 72, y: 565, size: 31, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Transparência, Privacidade e", { x: 72, y: 525, size: 20, font: bold, color: CYAN });
    page.drawText("Evolução do Projeto", { x: 72, y: 499, size: 20, font: bold, color: CYAN });
    page.drawText("Informação aos utilizadores, princípios adotados e perguntas frequentes", { x: 72, y: 460, size: 10.5, font: regular, color: rgb(0.88, 0.92, 0.96) });
    page.drawRectangle({ x: 72, y: 378, width: PAGE_W - 144, height: 54, color: rgb(0.02, 0.25, 0.32) });
    page.drawText("DOCUMENTO DE TRANSPARÊNCIA", { x: 92, y: 410, size: 11, font: bold, color: CYAN });
    page.drawText("PUBLICAÇÃO v1.0 · APLICÁVEL AO ACADEMIC HUB 1.6.6", { x: 92, y: 392, size: 8.5, font: bold, color: rgb(0.90, 0.96, 1) });
    page.drawText("17 de setembro de 2026", { x: 72, y: 145, size: 10, font: bold, color: rgb(0.85, 0.90, 0.96) });

    const ensure = (needed: number, title: string) => {
      if (y - needed < BOTTOM) newPage(title);
    };

    for (const section of sections) {
      if (section.newPage || y < 180) newPage(section.title);
      else {
        ensure(42, section.title);
        page.drawText(section.title, { x: MARGIN_X, y, size: 16, font: bold, color: NAVY });
        y -= 28;
      }

      if (section.newPage) {
        page.drawText(section.title, { x: MARGIN_X, y, size: 16, font: bold, color: NAVY });
        y -= 28;
      }

      for (const item of section.paragraphs) {
        const font = item.bold ? bold : regular;
        const size = item.bold ? 10.8 : BODY_SIZE;
        const prefix = item.bullet ? "• " : "";
        const indent = item.bullet ? 12 : 0;
        const lines = wrap(prefix + item.text, font, size, PAGE_W - (MARGIN_X * 2) - indent);
        const height = lines.length * LINE + (item.bold ? 8 : 9);
        ensure(height, section.title);

        for (const line of lines) {
          page.drawText(line, {
            x: MARGIN_X + indent,
            y,
            size,
            font,
            color: item.link ? rgb(0.02, 0.36, 0.68) : (item.bold ? DARK : DARK),
          });
          y -= LINE;
        }
        if (item.link) {
          page.drawText(item.link, { x: MARGIN_X + indent, y, size: 7.5, font: regular, color: rgb(0.02, 0.36, 0.68), maxWidth: PAGE_W - MARGIN_X * 2 });
          y -= 12;
        }
        y -= item.bold ? 6 : 5;
      }
    }

    const bytes = await pdf.save({ useObjectStreams: true });
    return new Response(bytes, {
      status: 200,
      headers: {
        ...cors(req),
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="Academic_Hub_Transparencia_Privacidade_e_Evolucao_v1.0.pdf"',
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};
