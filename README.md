# Academic Hub

**Gestão académica pessoal para estudantes da Universidade Aberta (UAb).**

Aplicação web progressiva (PWA) para acompanhar o percurso académico num único espaço, com funcionamento adaptado a computador, tablet e telemóvel.

## Estado atual

- **Versão da aplicação:** 1.4.0
- **Interface:** responsiva, com modo claro/escuro
- **Instalação:** PWA em computador, tablet e telemóvel
- **Sincronização:** cloud entre dispositivos, com atualização automática e resolução de conflitos
- **Notificações:** alertas Push por dispositivo para e-fólios, exames/recursos e prazos oficiais da UAb
- **Sons da aplicação:** opção geral para confirmações, avisos, erros e notificações enquanto o Academic Hub está aberto
- **Feedback:** área integrada para opiniões, sugestões e reporte de problemas, com referência, estado, histórico e persistência protegida no Supabase
- **Desempenho:** otimizado para desktop e dispositivos móveis

## Funcionalidades principais

- Gestão das cadeiras ativas e concluídas.
- Plano de estudos e cálculo do progresso da licenciatura por ECTS.
- Registo de e-fólios, avaliações, exames, recursos e notas finais.
- Modelos de avaliação compatíveis com o regime anterior e com o Regulamento de Avaliação de 2026.
- Calendário académico e agenda pessoal.
- Alertas Push configuráveis por dispositivo para prazos académicos.
- Histórico académico.
- Relatório das cadeiras concluídas, preparado para impressão/PDF.
- Critérios e pré-requisitos específicos de inscrição quando publicados pela UAb.
- Perfil, fotografia, aparência, alertas e preferências pessoais.
- Conta Academic Hub com email institucional UAb e recuperação de password.
- Sincronização automática dos dados entre dispositivos, mantendo suporte a backup local.
- Área **Feedback** para enviar uma opinião, sugerir uma melhoria ou reportar um problema.
- Identificação visual do tipo de feedback: opinião a azul, sugestão a verde e problema a vermelho.
- Caixa de feedback com filtros por tipo e estado, referências `AH-0001`, `AH-0002`, etc., histórico de alterações e respostas identificadas como **Academic Hub**.
- Reporte de problemas com descrição do percurso, comportamento observado, resultado esperado e suporte a 1–3 capturas de ecrã.
- Sons opcionais da aplicação configuráveis em **Definições**, independentes do som das notificações Push controlado pelo sistema operativo.

## Área de Feedback

A área de Feedback foi integrada na navegação de apoio do Academic Hub e permite acompanhar cada pedido através dos estados **Novo**, **Em análise**, **A aguardar informação**, **Planeado**, **Em desenvolvimento**, **Concluído**, **Não previsto** e **Arquivado**.

A interface adapta-se a computador, tablet e telemóvel. No telemóvel, os cartões de estado são apresentados numa grelha 2 × 2 para reduzir a extensão vertical da página.

Os pedidos são persistidos no Supabase. As tabelas de pedidos, mensagens, histórico e anexos estão protegidas por **Row Level Security (RLS)**. Cada aluno pode consultar apenas os próprios pedidos; a conta responsável pela gestão pode consultar e atualizar os pedidos recebidos. As capturas de problemas são guardadas num bucket privado `feedback-attachments`, limitado a imagens PNG, JPEG e WebP.

A aplicação mantém um espelho local para resposta imediata da interface e sincroniza-o com o Supabase, permitindo que o feedback criado num dispositivo possa ser consultado noutro dispositivo autenticado da mesma conta e pela conta gestora.

## Identidade visual

O Academic Hub utiliza uma identidade própria em azul-marinho, dourado e prata. O mesmo logótipo é usado na aplicação, instalação PWA, relatórios e comunicações de conta para manter consistência visual entre plataformas.

## Privacidade e segurança

Os dados académicos pertencem ao utilizador. A aplicação mantém os dados locais disponíveis e, quando a conta e a sincronização estão ativas, utiliza a cloud para permitir continuidade entre dispositivos. A sincronização inclui mecanismos de comparação de versões para reduzir o risco de substituição silenciosa de alterações realizadas noutro dispositivo.

Os feedbacks são privados: cada aluno consulta apenas os próprios pedidos. A conta responsável pela gestão do Academic Hub pode acompanhar os pedidos recebidos, responder em nome do **Academic Hub** e alterar o respetivo estado. As políticas RLS impedem que um aluno consulte pedidos pertencentes a outros utilizadores.

## Fontes académicas

Informações institucionais, planos de estudos, calendário e requisitos específicos apresentados pela aplicação são baseados nas páginas oficiais da **Universidade Aberta (UAb)**. O Academic Hub é uma ferramenta pessoal e independente e **não constitui uma aplicação oficial da Universidade Aberta**.

## Tecnologias

- React + TypeScript
- Vite
- Supabase
- Cloudflare Pages
- PWA / Service Worker
- GitHub para controlo de versões, revisão e validação das alterações

## Manutenção e validação

O projeto é mantido no GitHub. As alterações são desenvolvidas em branches próprias e revistas através de Pull Requests antes de serem integradas no `main`.

O repositório executa verificações automáticas antes de considerar uma alteração validada:

- verificação TypeScript;
- build de produção;
- testes automatizados;
- lint dos principais ficheiros da aplicação.

---

**Academic Hub · Gestão académica pessoal**