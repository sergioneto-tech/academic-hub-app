# Academic Hub — Correção “Esqueci-me da password”

## O que isto corrige
Quando clicavas no link do email de recuperação, a aplicação abria no **Dashboard** (página principal) e não mostrava o ecrã/área para **definir a nova password**.

Com esta correção:
- Se o link abrir em `/` (Dashboard), a app deteta o **recovery token** e redireciona automaticamente para **Definições**.
- A secção **Recuperar password** aparece em **Definições** e permite definir a nova password e guardar.
- Se algum email antigo ainda apontar para `/reset-password`, ele também redireciona para **Definições**.

## Como aplicar no Lovable / GitHub
1) Copia/cola **por cima** estes 3 ficheiros (mantendo os caminhos):
- `src/components/Layout.tsx`
- `src/pages/Settings.tsx`
- `src/pages/ResetPassword.tsx`

2) Faz commit/publish.

## (Importante) Confirmar URLs no Supabase Auth
No painel Supabase: **Authentication → URL Configuration**
- Confirma o **Site URL**: `https://academichub.sergioneto.pt`
- Em **Additional Redirect URLs**, adiciona (se ainda não tiveres):
  - `https://academichub.sergioneto.pt/definicoes`
  - `https://academichub.sergioneto.pt/reset-password` (opcional, por compatibilidade)
  - Em desenvolvimento (opcional): `http://localhost:5173/definicoes`

> Mesmo que o Supabase ignore o redirect por não estar autorizado, o link vem com `type=recovery` e esta correção força o redirecionamento interno para **Definições**.

## Como testar
1) Vai a **Definições** → escreve o email → clica **Esqueci-me da password**.
2) Abre o email e clica no link.
3) Deves cair automaticamente em **Definições** com a secção **Recuperar password**.
4) Define a nova password → **Guardar**.
5) Volta à área de login e entra com a nova password.
