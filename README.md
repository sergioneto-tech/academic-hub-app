# Academic Hub

**Gestão académica pessoal para estudantes da Universidade Aberta (UAb).**

Aplicação web progressiva (PWA) para acompanhar o percurso académico num único espaço, com funcionamento adaptado a computador, tablet e telemóvel.

**Acesso:** https://academichub.sergioneto.pt

## Estado atual

- **Versão da aplicação:** 1.6.4
- **Interface:** responsiva, com modo claro/escuro
- **Instalação:** PWA em computador, tablet e telemóvel
- **Sincronização:** cloud entre dispositivos, com atualização automática e resolução de conflitos
- **Notificações:** alertas Push por dispositivo para e-fólios, exames/recursos, prazos oficiais, atualizações e outros avisos relevantes
- **Importação PUC:** leitura local do PDF, revisão obrigatória e gravação apenas após confirmação do aluno
- **Feedback:** área integrada para opiniões, sugestões e reporte de problemas, com referência, estado, histórico e persistência protegida no Supabase
- **Segurança:** RLS, validações server-side, monitorização técnica, controlo de sessões e alertas de incidentes
- **Desempenho:** otimizado para desktop e dispositivos móveis

## Funcionalidades principais

- Gestão das cadeiras ativas e concluídas.
- Plano de estudos e cálculo do progresso da licenciatura por ECTS.
- Registo de e-fólios, avaliações, exames, recursos e notas finais.
- Modelos de avaliação compatíveis com o regime anterior e com o Regulamento de Avaliação de 2026/2027.
- Importação assistida dos dados do PUC, mantendo sempre uma revisão editável antes de guardar.
- Suporte à importação do PUC em cadeiras do regime anterior que estejam a ser frequentadas, sem converter automaticamente a cadeira para o novo regulamento.
- Preservação das datas e horas oficiais de exame e recurso; o PUC não substitui a fonte oficial dessas provas.
- Reconciliação segura de cadeiras já preenchidas: a importação pode atualizar estrutura, cotações e datas sem apagar classificações ou estados quando existe correspondência segura entre os elementos.
- Proteção contra associações perigosas: se uma alteração de estrutura puder deslocar uma classificação para o elemento errado, a aplicação interrompe a operação e pede revisão manual.
- Elementos sem progresso que deixaram de existir no PUC podem ser removidos durante a reconciliação, evitando cartões duplicados e somas incorretas.
- No regime anterior, e-fólios podem ser adicionados ou eliminados manualmente, incluindo os cartões A/B; um cartão removido não volta a ser criado apenas por abrir a cadeira.
- Catálogo partilhado de estruturas PUC validadas por UC, ano letivo e edição/turma, com aceitação individual pelo aluno.
- Calendário académico e agenda pessoal.
- Alertas Push configuráveis por dispositivo para prazos académicos, versões e outras alterações relevantes.
- Histórico académico.
- Relatório das cadeiras concluídas, preparado para impressão/PDF.
- Critérios e pré-requisitos específicos de inscrição quando publicados pela UAb.
- Perfil, fotografia, aparência, alertas e preferências pessoais.
- Conta Academic Hub com email institucional UAb e recuperação de password.
- Sincronização automática dos dados entre dispositivos, mantendo suporte a backup local.
- Área **Feedback** para enviar uma opinião, sugerir uma melhoria ou reportar um problema.
- Caixa de feedback com filtros por tipo e estado, referências `AH-0001`, `AH-0002`, etc., histórico de alterações e respostas identificadas como **Academic Hub**.
- Reporte de problemas com descrição do percurso, comportamento observado, resultado esperado e suporte a 1–3 capturas de ecrã.
- Sons opcionais da aplicação configuráveis em **Definições**, independentes do som das notificações Push controlado pelo sistema operativo.

## Importação assistida do PUC

O Academic Hub pode ler localmente o PDF do PUC e propor os elementos de avaliação, datas e cotações identificados. O PDF não é guardado na base de dados.

Antes de qualquer alteração, o aluno revê os dados extraídos e pode corrigi-los. A gravação é sempre explícita. Um PUC identificado como pertencendo a outra unidade curricular é bloqueado.

Quando a cadeira já tem dados, o Academic Hub tenta reconciliar a estrutura existente com a versão revista do PUC. Sempre que existe correspondência segura, mantém o mesmo elemento e preserva classificações, submissões e estados, atualizando apenas os dados académicos confirmados. Elementos sem progresso que já não façam parte da estrutura revista podem ser removidos.

Se existirem classificações ou estados que não possam ser associados com segurança à nova estrutura, a importação é interrompida em vez de deslocar silenciosamente uma nota para outro elemento. O aluno pode então rever a cadeira manualmente.

Nas cadeiras do regime anterior, a importação preserva o regime e a estrutura já escolhidos. Nas cadeiras configuradas apenas como histórico de nota final, a importação do PUC não é apresentada, porque esse modo se destina exclusivamente ao registo da classificação final conhecida.

As datas e horas de exame, recurso e épocas especiais continuam a ser obtidas exclusivamente das fontes oficiais usadas pelo Academic Hub. Quando o PUC contém essas datas, elas não substituem o calendário oficial.

## Notificações

As notificações Push são ativadas individualmente em cada dispositivo. É recomendável mantê-las ativas para receber alertas de prazos, atualizações da aplicação, respostas a feedback e outras alterações que possam exigir revisão do aluno.

Uma atualização de PUC partilhado nunca altera automaticamente os dados pessoais de uma cadeira. Quando existe uma nova versão validada aplicável à mesma UC, ano letivo e edição/turma, o aluno é avisado para rever e aceitar a alteração se esta corresponder ao seu PUC.

## Monitorização e recuperação

O Academic Hub regista de forma limitada e sanitizada determinados erros técnicos quando existe uma sessão autenticada válida. Estes relatórios não incluem passwords nem tokens e podem originar um alerta administrativo para facilitar a correção de problemas reais encontrados nos dispositivos dos alunos.

Falhas de carregamento provocadas por ficheiros de versões diferentes têm uma tentativa única de recuperação automática. Se o problema persistir, a aplicação mantém um ecrã de recuperação manual em vez de deixar a interface bloqueada ou vazia.

## Área de Feedback

A área de Feedback foi integrada na navegação de apoio do Academic Hub e permite acompanhar cada pedido através dos estados **Novo**, **Em análise**, **A aguardar informação**, **Planeado**, **Em desenvolvimento**, **Concluído**, **Não previsto** e **Arquivado**.

A interface adapta-se a computador, tablet e telemóvel. No telemóvel, os cartões de estado são apresentados numa grelha 2 × 2 para reduzir a extensão vertical da página.

Os pedidos são persistidos no Supabase. As tabelas de pedidos, mensagens, histórico e anexos estão protegidas por **Row Level Security (RLS)**. Cada aluno pode consultar apenas os próprios pedidos; a conta responsável pela gestão pode consultar e atualizar os pedidos recebidos. As capturas de problemas são guardadas num bucket privado `feedback-attachments`, limitado a imagens PNG, JPEG e WebP.

A aplicação mantém um espelho local para resposta imediata da interface e sincroniza-o com o Supabase, permitindo que o feedback criado num dispositivo possa ser consultado noutro dispositivo autenticado da mesma conta e pela conta gestora.

## Identidade visual

O Academic Hub utiliza uma identidade própria em azul-marinho, dourado e prata. O mesmo logótipo é usado na aplicação, instalação PWA, relatórios e comunicações de conta para manter consistência visual entre plataformas.

## Privacidade e segurança

Os dados académicos pertencem ao utilizador. A aplicação mantém os dados locais disponíveis e, quando a conta e a sincronização estão ativas, utiliza a cloud para permitir continuidade entre dispositivos. A sincronização inclui mecanismos de comparação de versões para reduzir o risco de substituição silenciosa de alterações realizadas noutro dispositivo.

As áreas expostas no Supabase usam controlo de acesso adequado ao respetivo objetivo, incluindo RLS, funções protegidas no servidor e validações de identidade. Operações administrativas sensíveis não dependem apenas de verificações no frontend.

Os feedbacks são privados: cada aluno consulta apenas os próprios pedidos. A conta responsável pela gestão do Academic Hub pode acompanhar os pedidos recebidos, responder em nome do **Academic Hub** e alterar o respetivo estado.

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

- auditoria de dependências;
- consistência da versão e dos metadados de release;
- verificação TypeScript;
- build de produção;
- testes automatizados;
- lint dos principais ficheiros da aplicação.

---

**Academic Hub · Gestão académica pessoal**