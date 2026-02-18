-- Academic Hub (cloud sync)
--
-- 1) Criar tabela onde cada utilizador guarda o seu "estado" (JSON)
-- 2) Ativar RLS e permitir que cada utilizador só aceda à sua linha
--
-- Como usar:
-- - No Supabase > SQL Editor, colar e correr este ficheiro.
-- - Depois, em Definições na app, preencher o Supabase URL e Anon key.

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- (Hardening) força RLS mesmo para o owner da tabela (não afeta roles com BYPASSRLS)
alter table public.user_state force row level security;

-- (Hardening) bloqueia acesso anónimo ao nível de permissões (além do RLS)
revoke all on table public.user_state from anon;
grant select, insert, update on table public.user_state to authenticated;

-- Só o próprio utilizador pode ler a sua linha
drop policy if exists "user_state_select_own" on public.user_state;
create policy "user_state_select_own"
on public.user_state
for select
to authenticated
using (auth.uid() = user_id);

-- Só o próprio utilizador pode inserir a sua linha
drop policy if exists "user_state_insert_own" on public.user_state;
create policy "user_state_insert_own"
on public.user_state
for insert
to authenticated
with check (auth.uid() = user_id);

-- Só o próprio utilizador pode atualizar a sua linha
drop policy if exists "user_state_update_own" on public.user_state;
create policy "user_state_update_own"
on public.user_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Opcional: impedir deletes (mantém histórico)
-- drop policy if exists "user_state_delete_own" on public.user_state;
-- create policy "user_state_delete_own"
-- on public.user_state
-- for delete
-- using (false);
