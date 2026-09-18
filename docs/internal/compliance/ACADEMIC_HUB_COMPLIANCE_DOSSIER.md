# Dossier interno de conformidade — Academic Hub

**Estado:** interno / não destinado a publicação direta  
**Responsável pela manutenção:** Sérgio Neto  
**Versão do dossier:** 2026-09-17  
**Âmbito:** aplicação Academic Hub, respetivo backend Supabase, alojamento Cloudflare Pages/PWA, suporte, notificações, feedback, PUC, sincronização e registos técnicos associados.

> Este documento funciona como registo interno de decisões, medidas e evidências de proteção de dados. Não substitui a informação pública de privacidade, os Termos de Utilização nem a página de Segurança e Transparência. Não contém segredos, chaves, tokens ou credenciais.

---

## 1. Identificação do serviço e papéis

- **Serviço:** Academic Hub.
- **Natureza:** aplicação independente de apoio e organização académica; não é serviço oficial da Universidade Aberta.
- **Responsável pelo tratamento:** Sérgio Neto, na medida em que determina as finalidades e meios do tratamento efetuado pelo Academic Hub.
- **Titulares principais:** utilizadores/alunos que criam conta ou utilizam funcionalidades pessoais.
- **Prestadores principais de infraestrutura:** Supabase e Cloudflare, nas funções efetivamente utilizadas pelo serviço e de acordo com os respetivos termos e instrumentos de proteção de dados aplicáveis.
- **Universidade Aberta:** não opera o Academic Hub e não é apresentada como responsável pelo tratamento efetuado pela aplicação.

## 2. Princípios adotados

As decisões de arquitetura e produto devem respeitar, conforme aplicável:

- licitude, lealdade e transparência;
- limitação das finalidades;
- minimização dos dados;
- exatidão;
- limitação da conservação;
- integridade e confidencialidade;
- responsabilização;
- proteção de dados desde a conceção e por defeito.

Referência principal: Regulamento (UE) 2016/679 — RGPD, nomeadamente artigos 5.º, 6.º, 12.º a 14.º, 24.º, 25.º e 32.º.

## 3. Inventário de categorias de dados

### 3.1 Conta e autenticação

Podem incluir:

- email de autenticação;
- identificador técnico da conta;
- estado de confirmação/autenticação;
- metadados estritamente necessários ao funcionamento do serviço de autenticação.

**Finalidade:** criação e manutenção da conta, autenticação e proteção de acesso.  
**Base jurídica principal:** execução do serviço solicitado pelo utilizador; interesses legítimos para segurança e prevenção de abuso quando aplicável.

### 3.2 Perfil e preferências

Podem incluir:

- nome de apresentação;
- fotografia opcional;
- licenciatura/curso selecionado;
- preferências e definições da aplicação.

**Finalidade:** personalização e utilização do serviço.  
**Base jurídica:** execução do serviço; consentimento quando uma funcionalidade opcional dependa de escolha expressa, como fotografia de perfil.

### 3.3 Dados académicos

Podem incluir:

- cadeiras/UC;
- datas e eventos académicos;
- avaliações, classificações e notas introduzidas pelo utilizador;
- estado académico e dados usados em cálculos e relatórios pessoais.

**Finalidade:** organização académica, cálculos de apoio, calendário, alertas e relatórios.  
**Base jurídica principal:** execução do serviço solicitado pelo utilizador.

### 3.4 Cloud e sincronização

Podem incluir:

- estado académico sincronizado;
- preferências;
- metadados de sincronização;
- timestamps/estado técnico necessários a sincronização e recuperação.

**Finalidade:** sincronização entre dispositivos e recuperação de dados quando a funcionalidade é utilizada.  
**Base jurídica principal:** execução da funcionalidade solicitada.

### 3.5 Notificações Push

Podem incluir:

- subscrição Push;
- identificadores técnicos do navegador/dispositivo necessários à entrega;
- estado e registos operacionais de entrega.

**Finalidade:** envio e diagnóstico de notificações solicitadas pelo utilizador.  
**Base jurídica:** consentimento/escolha explícita para ativação da funcionalidade; interesses legítimos limitados para diagnóstico e segurança operacional quando aplicável.

### 3.6 Feedback, suporte e anexos

Podem incluir:

- pedido de feedback/suporte;
- mensagens;
- anexos enviados pelo utilizador;
- ID Academic Hub pseudónimo;
- estado e histórico do pedido.

**Finalidade:** responder, diagnosticar, acompanhar e corrigir problemas reportados.  
**Base jurídica principal:** execução do pedido do utilizador; interesses legítimos limitados para segurança, auditoria e defesa de direitos quando aplicável.

### 3.7 PUC e inquéritos

Podem incluir:

- propostas/correções PUC submetidas;
- estado da revisão;
- respostas voluntárias a inquéritos.

**Finalidade:** melhoria colaborativa de dados e recolha de opinião quando a funcionalidade é usada.  
**Base jurídica:** execução da funcionalidade solicitada; consentimento quando a participação é voluntária e facultativa.

### 3.8 Erros e segurança

Podem incluir, apenas quando tecnicamente necessário:

- data/hora;
- versão da aplicação;
- informação de navegador/dispositivo;
- eventos técnicos;
- identificadores operacionais;
- IP e país aproximado quando necessários à deteção de abuso, proteção da conta ou investigação de incidente.

**Finalidade:** segurança, diagnóstico, prevenção de abuso, investigação e proteção do serviço.  
**Base jurídica principal:** interesses legítimos do responsável, sujeitos a minimização, necessidade e proporcionalidade.

## 4. Identificador pseudónimo de suporte

Foi implementado um **ID Academic Hub** estável e pseudónimo para reduzir a utilização do email ou número de estudante em pedidos e consultas de suporte.

Características principais:

- formato próprio do Academic Hub;
- associado internamente à conta;
- não é palavra-passe;
- não substitui autenticação;
- isoladamente não concede acesso à conta;
- utilizado como identificador preferencial na área de suporte.

**Evidência técnica:** tabela `public.user_support_identity`, regras de acesso por utilizador e geração server-side.

## 5. Minimização no suporte administrativo

A consulta administrativa de suporte deve devolver apenas o diagnóstico necessário ao caso.

Devem permanecer excluídos de uma consulta normal de suporte, salvo necessidade justificada e fluxo específico:

- nome completo;
- email;
- número de estudante;
- UUID interno exposto na interface;
- classificações académicas;
- fotografia;
- IP completo;
- chaves Push/tokens completos;
- conteúdo pessoal desnecessário.

O suporte normal pesquisa pelo **ID Academic Hub**.

## 6. Auditoria de acessos administrativos

Consultas administrativas de suporte são registadas em área interna protegida.

Elementos de auditoria previstos:

- administrador responsável;
- utilizador sujeito da consulta;
- ID Academic Hub;
- ação realizada;
- motivo indicado;
- campos devolvidos;
- data/hora;
- data de expiração do registo.

A consulta de suporte deve falhar de forma segura se o registo de auditoria necessário não puder ser criado.

**Retenção definida:** até 365 dias.  
**Rotina automática:** `private.purge_expired_admin_support_access_logs()` agendada diariamente.

## 7. Controlo de acesso e isolamento

Medidas relevantes:

- autenticação por conta;
- RLS nas tabelas que expõem dados por utilizador;
- FORCE RLS onde aplicável;
- funções administrativas protegidas no backend;
- `service_role` não utilizado pelo browser;
- Storage privado para anexos de feedback;
- separação entre interface do utilizador e operações administrativas.

A mera existência de uma base de dados central não é tratada como falha de conformidade. O foco é necessidade, minimização, isolamento, controlo de acesso, retenção e segurança.

## 8. Retenção e eliminação

Política operacional definida:

| Categoria | Prazo atual |
|---|---:|
| Registos de entrega de notificações Push | até 180 dias |
| Subscrições Push desativadas | até 90 dias |
| Erros técnicos resolvidos | até 180 dias |
| Respostas a inquéritos | até 365 dias |
| Propostas PUC já resolvidas | até 730 dias |
| Consultas administrativas de suporte | até 365 dias |
| Eventos de segurança | normalmente 90–180 dias; até 365 dias quando necessário |
| Dados essenciais de conta/estado académico | enquanto a conta estiver ativa ou até eliminação/substituição aplicável |
| Feedback e anexos | enquanto necessários ao caso/conta, sujeitos ao procedimento de eliminação aplicável |
| ID Academic Hub | enquanto existir a conta |

A limpeza operacional é automatizada através de `private.cleanup_operational_retention()`.

Rotinas atualmente verificadas na base de dados:

- limpeza de auditoria administrativa: todos os dias às 03:17;
- limpeza operacional de retenção: todos os dias às 03:37.

## 9. Eliminação de conta

O procedimento de eliminação deve:

1. autenticar o pedido;
2. remover anexos privados associados ao utilizador no Storage;
3. interromper a eliminação se a limpeza de Storage falhar, evitando ficheiros órfãos;
4. eliminar a conta no serviço de autenticação;
5. permitir que as relações `ON DELETE CASCADE` removam os registos associados previstos;
6. respeitar apenas exceções de conservação que tenham fundamento jurídico concreto.

**Evidência técnica:** função `delete-account` e respetivas relações de base de dados.

## 10. Direitos dos titulares

O Academic Hub deve permitir, conforme aplicável:

- acesso;
- retificação;
- apagamento;
- limitação do tratamento;
- oposição;
- portabilidade;
- retirada de consentimento quando essa seja a base utilizada;
- reclamação junto da CNPD.

Mecanismos já disponíveis ou previstos:

- consulta/correção de perfil;
- correção de dados académicos;
- exportação local do estado da aplicação;
- eliminação da conta;
- Feedback para pedidos adicionais;
- identificação preferencial por ID Academic Hub.

**Nota interna importante:** a exportação JSON atualmente disponível representa os dados académicos/preferências existentes no dispositivo e **não deve ser apresentada como cópia integral de todos os dados pessoais mantidos no backend**. Um pedido formal de acesso deve considerar também dados backend aplicáveis.

## 11. Transparência pública

A informação pública encontra-se separada em três áreas:

- **Privacidade e RGPD** — tratamento de dados, bases jurídicas, conservação, direitos, prestadores;
- **Termos de Utilização** — regras de uso, natureza não oficial, responsabilidades e limites do serviço;
- **Segurança e Transparência** — resumo técnico das medidas e limites, sem publicação de detalhes que facilitem contornar controlos.

Existe ainda a página **Os meus dados e privacidade**, que centraliza controlo, exportação, correção, suporte e eliminação.

## 12. Prestadores e transferências internacionais

### Supabase

Usos atuais incluem autenticação, PostgreSQL, Storage e Edge Functions.

A documentação pública deve apontar para o DPA do fornecedor e descrever o seu papel apenas na medida das funcionalidades efetivamente utilizadas.

### Cloudflare

Usado para alojamento/entrega da aplicação web/PWA e infraestrutura associada.

A documentação pública deve apontar para o DPA do fornecedor.

### Regra interna

Não afirmar genericamente que “todos os dados ficam na UE” sem confirmação técnica e contratual atualizada dos fluxos reais. Quando existam transferências internacionais, devem ser analisados os mecanismos aplicáveis previstos no RGPD e contratos do fornecedor.

## 13. Incidentes e violações de dados

Em caso de potencial violação de dados pessoais:

1. conter e preservar evidência técnica necessária;
2. identificar categorias e volume aproximado de dados/titulares afetados;
3. avaliar consequências e nível de risco;
4. documentar a decisão, mesmo quando não exista notificação externa;
5. quando aplicável, notificar a CNPD sem demora injustificada e, se possível, até 72 horas após conhecimento;
6. quando seja provável risco elevado, avaliar a comunicação direta aos titulares, sem prejuízo das exceções legais;
7. corrigir a causa e registar medidas preventivas.

Nunca publicar em transparência pública detalhes técnicos que aumentem o risco de exploração.

## 14. DPO, DPIA e registo de atividades

### DPO

Não existe decisão interna de nomear DPO por defeito. A necessidade deve ser reavaliada se o tratamento passar a preencher alguma das condições do artigo 37.º do RGPD.

### DPIA/AIPD

Não se presume automaticamente obrigatória. Deve ser reavaliada antes de introduzir tratamento suscetível de resultar em elevado risco, nomeadamente novas formas de monitorização sistemática, tratamento em larga escala de categorias especiais ou tecnologias/combinações de dados com impacto substancial nos titulares.

### Registo de atividades

Este dossier, em conjunto com o inventário técnico, retenção e documentação de finalidades/bases jurídicas, serve como evidência interna de accountability. Deve ser mantido atualizado e pode ser convertido num registo formal estruturado de atividades de tratamento se necessário.

## 15. Decisões automatizadas

Atualmente, o Academic Hub não é concebido para tomar decisões exclusivamente automatizadas que produzam efeitos jurídicos ou afetem de forma semelhante e significativa o utilizador.

Cálculos, alertas, ordenações e sugestões são ferramentas de apoio e não substituem decisões oficiais da Universidade Aberta.

## 16. Segurança — evidência de alto nível

Medidas implementadas ou documentadas incluem:

- HTTPS;
- autenticação;
- RLS/isolamento por utilizador;
- CSP/HSTS e controlos web verificados pela baseline de segurança;
- validação do app-shell/Service Worker;
- registos de segurança sujeitos a retenção;
- diagnóstico sem exposição de palavra-passe ou tokens completos;
- auditoria de consultas administrativas de suporte;
- Storage privado de anexos;
- eliminação controlada de anexos e conta.

A documentação pública deve continuar a evitar afirmações como “100% seguro”, “inviolável” ou “certificado pelo RGPD”.

## 17. Evidências técnicas de referência

### Aplicação

- `src/pages/MyDataPrivacy.tsx`
- `src/pages/Legal.tsx`
- `src/pages/TermsOfUse.tsx`
- `src/pages/SecurityPrivacy.tsx`
- `src/pages/AdminSupport.tsx`
- `src/App.tsx`

### Backend / migrations

- `supabase/functions/admin-support-lookup/`
- `supabase/functions/delete-account/`
- `supabase/migrations/20260917145508_add_pseudonymous_support_identity.sql`
- `supabase/migrations/20260917180312_add_operational_data_retention_policy.sql`

### Base de dados

Objetos de evidência incluem, conforme o caso:

- `public.user_support_identity`
- `private.admin_support_access_log`
- `private.data_retention_policy`
- tabelas de feedback e respetivo histórico/anexos
- tabelas de notificações
- tabelas de erros técnicos
- tabelas de PUC/inquéritos
- registos de segurança

## 18. Pontos que exigem revisão periódica

Rever sempre que ocorrer uma alteração material em:

- categorias de dados recolhidos;
- finalidade de tratamento;
- base jurídica;
- fornecedor/subprocessador;
- região/fluxo internacional;
- prazo de retenção;
- permissões de administrador;
- mecanismos de autenticação;
- novas formas de análise/perfil;
- novas integrações externas;
- recolha de categorias especiais de dados;
- incidentes relevantes de segurança.

## 19. Pontos de atenção conhecidos

- Rever periodicamente funções `SECURITY DEFINER` e privilégios de execução expostos a `authenticated`.
- Rever avisos do Supabase Security Advisor, distinguindo configuração intencional de risco real.
- Manter `service_role` exclusivamente no backend.
- Evoluir a exportação local para um mecanismo de pedido/cópia completa quando for necessário satisfazer formalmente acesso a todos os dados backend.
- Substituir progressivamente identificadores administrativos hardcoded por controlo de papéis/claims/tabela quando aplicável.
- Manter contacto de privacidade sem expor desnecessariamente número de estudante ou outros identificadores pessoais.

## 20. Revisão e controlo de alterações

Este dossier deve ser revisto:

- após alterações relevantes de privacidade/segurança;
- após incidente de dados;
- após mudança de fornecedor ou arquitetura;
- no mínimo uma vez por ano, mesmo sem alterações relevantes.

### Registo de versões

| Data | Alteração |
|---|---|
| 2026-09-17 | Criação do dossier após implementação dos pontos 1–10 da revisão de privacidade, minimização, suporte pseudónimo, retenção, transparência e separação documental. |

---

## 21. Fontes oficiais de referência

- RGPD — Regulamento (UE) 2016/679: https://eur-lex.europa.eu/legal-content/PT/TXT/?uri=CELEX%3A32016R0679
- EDPB — Data Protection Basics: https://www.edpb.europa.eu/sme/learn-the-basics/data-protection-basics_pt
- EDPB — Data Protection Officer: https://www.edpb.europa.eu/sme/be-compliant/data-protection-officer_pt
- EDPB — Segurança dos dados: https://www.edpb.europa.eu/sme/be-compliant/secure-personal-data_en
- EDPB — Direitos dos titulares: https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en
- CNPD — Direitos: https://www.cnpd.pt/cidadaos/direitos/
- CNPD — Violações de dados: https://www.cnpd.pt/organizacoes/outras-obrigacoes/violacao-de-dados-ou-data-breach/
- CNPD — Participações: https://www.cnpd.pt/cidadaos/participacoes/
- Supabase DPA: https://supabase.com/downloads/docs/Supabase%2BDPA%2B231211.pdf
- Cloudflare DPA: https://www.cloudflare.com/cloudflare-customer-dpa/
