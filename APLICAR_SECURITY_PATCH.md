# Patch de Segurança + Recuperação de Password (Academic Hub)

Este patch faz 3 coisas principais:

1) **Supabase (segurança real)**
- RLS reforçada na tabela `public.user_state` (com `FORCE ROW LEVEL SECURITY`).
- Políticas com **`TO authenticated`**.
- Permissões extra: **remove acesso do role `anon`** e mantém `SELECT/INSERT/UPDATE` apenas para `authenticated`.

2) **Frontend (mínimos essenciais)**
- Remove `dangerouslySetInnerHTML` do componente de gráficos.
- Mantém o CSP atual e adiciona **CSP Report-Only** (para veres violações na consola sem partir a app).
- Scripts úteis no `package.json`: `npm run audit` / `npm run audit:fix`.

3) **Recuperação de password por email (Supabase Auth)**
- Botão **“Esqueci-me da password”** em **Definições**.
- Nova página **`/reset-password`** para o utilizador definir a nova password.

---

## 1) Aplicar ficheiros no Lovable / GitHub

Copia/cola (substitui) os ficheiros incluídos no ZIP para os mesmos caminhos no teu projeto.

Depois faz **Publish**.

---

## 2) Aplicar SQL no Supabase

No Supabase Dashboard → **SQL Editor**:

- Executa o ficheiro:
  - `supabase/migrations/20260218154000_harden_user_state_security.sql`

Isto é **idempotente** (podes executar mais do que uma vez sem estragar).

---

## 3) Configurar Redirect URLs (obrigatório para a recuperação)

No Supabase Dashboard → **Authentication → URL Configuration** (ou “Redirect URLs”):

Adiciona pelo menos:
- `https://academichub.sergioneto.pt/reset-password`
- `http://localhost:5173/reset-password`

E garante que o **Site URL** está correto (o teu domínio principal).

---

## 4) Como testar

1. Abre a app → **Definições**.
2. Escreve o email da conta.
3. Clica **“Esqueci-me da password”**.
4. Abre o email recebido e segue o link.
5. Na página `/reset-password`, define a nova password.
6. Volta a **Definições** e faz login (para reativar a sincronização neste dispositivo).

---

## 5) Check rápido de segurança

- **NUNCA** coloques a `service_role key` no frontend. Este patch bloqueia automaticamente se detetar `role=service_role`.
- Se o CSP Report-Only reportar violações na consola, ajusta o CSP antes de o tornares mais restrito.

