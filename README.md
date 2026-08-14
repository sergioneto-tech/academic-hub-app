# Academic Hub

**Gestão académica pessoal para estudantes da Universidade Aberta (UAb).**

Aplicação web progressiva (PWA) para acompanhar o percurso académico num único espaço, com funcionamento adaptado a computador, tablet e telemóvel.

## Estado atual

- **Versão da aplicação:** 1.4.0
- **Interface:** responsiva, com modo claro/escuro
- **Instalação:** PWA em computador, tablet e telemóvel
- **Sincronização:** cloud entre dispositivos, com atualização automática e resolução de conflitos
- **Notificações:** alertas Push por dispositivo para e-fólios, exames/recursos e prazos oficiais da UAb
- **Desempenho:** otimizado para desktop e dispositivos móveis

## Funcionalidades principais

- Gestão das cadeiras ativas e concluídas.
- Plano de estudos e cálculo do progresso da licenciatura por ECTS.
- Registo de e-fólios, avaliações, exames, recursos e notas finais.
- Modelos de avaliação compatíveis com o regime anterior e com o regulamento de avaliação de 2026.
- Calendário académico e agenda pessoal.
- Alertas Push configuráveis por dispositivo para prazos académicos.
- Histórico académico.
- Relatório das cadeiras concluídas, preparado para impressão/PDF.
- Critérios e pré-requisitos específicos de inscrição quando publicados pela UAb.
- Perfil, fotografia, aparência, alertas e preferências pessoais.
- Conta Academic Hub com email institucional UAb e recuperação de password.
- Sincronização automática dos dados entre dispositivos, mantendo suporte a backup local.

## Identidade visual

O Academic Hub utiliza uma identidade própria em azul-marinho, dourado e prata. O mesmo logótipo é usado na aplicação, instalação PWA, relatórios e comunicações de conta para manter consistência visual entre plataformas.

## Privacidade e segurança

Os dados académicos pertencem ao utilizador. A aplicação mantém os dados locais disponíveis e, quando a conta e a sincronização estão ativas, utiliza a cloud para permitir continuidade entre dispositivos. A sincronização inclui mecanismos de comparação de versões para reduzir o risco de substituição silenciosa de alterações realizadas noutro dispositivo.

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
