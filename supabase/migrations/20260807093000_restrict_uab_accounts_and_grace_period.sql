-- Academic Hub — contas UAb e regularização de contas antigas
--
-- Objetivos:
-- 1) Novas contas: aceitar apenas emails @estudante.uab.pt através do Auth Hook.
-- 2) Contas antigas com outros domínios: criar um prazo de 30 dias para regularização.
-- 3) Depois do prazo, suspender o acesso à cloud sem eliminar conta nem dados.

create table if not exists public.account_email_migration (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_detected_at timestamptz not null default now(),
  deadline timestamptz not null default (now() + interval '30 days')
);

alter table public.account_email_migration enable row level security;
alter table public.account_email_migration force row level security;

revoke all on table public.account_email_migration from anon;
grant select, insert on table public.account_email_migration to authenticated;

-- Cada utilizador apenas pode consultar/criar o seu próprio registo de regularização.
drop policy if exists "account_email_migration_select_own" on public.account_email_migration;
create policy "account_email_migration_select_own"
on public.account_email_migration
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "account_email_migration_insert_own" on public.account_email_migration;
create policy "account_email_migration_insert_own"
on public.account_email_migration
for insert
to authenticated
with check (auth.uid() = user_id);

-- Todas as contas não-UAb já existentes recebem 30 dias a partir da aplicação
-- desta migração. Isto impede que limpar o browser ou trocar de dispositivo
-- reinicie o prazo.
insert into public.account_email_migration (user_id, first_detected_at, deadline)
select
  u.id,
  now(),
  now() + interval '30 days'
from auth.users u
where split_part(lower(coalesce(u.email, '')), '@', 2) <> 'estudante.uab.pt'
on conflict (user_id) do nothing;

-- Auth Hook "Before User Created": bloqueia novas inscrições que não usem
-- exatamente o domínio institucional dos estudantes da Universidade Aberta.
create or replace function public.hook_restrict_signup_to_uab(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  signup_email text;
begin
  signup_email := lower(trim(coalesce(event->'user'->>'email', '')));

  if split_part(signup_email, '@', 2) = 'estudante.uab.pt' then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'O Academic Hub é exclusivo para estudantes da Universidade Aberta. Utilize o seu email @estudante.uab.pt.'
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_restrict_signup_to_uab(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_to_uab(jsonb) from anon, authenticated, public;

-- Reforça também a cloud: uma conta institucional pode sempre sincronizar.
-- Uma conta antiga não-UAb só pode fazê-lo enquanto o prazo de regularização
-- estiver ativo. Depois da data limite, os dados permanecem guardados mas
-- select/insert/update/delete ficam suspensos até o email ser alterado para UAb.
drop policy if exists "user_state_select_own" on public.user_state;
create policy "user_state_select_own"
on public.user_state
for select
to authenticated
using (
  auth.uid() = user_id
  and (
    split_part(lower(coalesce(auth.jwt()->>'email', '')), '@', 2) = 'estudante.uab.pt'
    or exists (
      select 1
      from public.account_email_migration migration
      where migration.user_id = auth.uid()
        and now() < migration.deadline
    )
  )
);

drop policy if exists "user_state_insert_own" on public.user_state;
create policy "user_state_insert_own"
on public.user_state
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    split_part(lower(coalesce(auth.jwt()->>'email', '')), '@', 2) = 'estudante.uab.pt'
    or exists (
      select 1
      from public.account_email_migration migration
      where migration.user_id = auth.uid()
        and now() < migration.deadline
    )
  )
);

drop policy if exists "user_state_update_own" on public.user_state;
create policy "user_state_update_own"
on public.user_state
for update
to authenticated
using (
  auth.uid() = user_id
  and (
    split_part(lower(coalesce(auth.jwt()->>'email', '')), '@', 2) = 'estudante.uab.pt'
    or exists (
      select 1
      from public.account_email_migration migration
      where migration.user_id = auth.uid()
        and now() < migration.deadline
    )
  )
)
with check (
  auth.uid() = user_id
  and (
    split_part(lower(coalesce(auth.jwt()->>'email', '')), '@', 2) = 'estudante.uab.pt'
    or exists (
      select 1
      from public.account_email_migration migration
      where migration.user_id = auth.uid()
        and now() < migration.deadline
    )
  )
);

drop policy if exists "user_state_delete_own" on public.user_state;
create policy "user_state_delete_own"
on public.user_state
for delete
to authenticated
using (
  auth.uid() = user_id
  and (
    split_part(lower(coalesce(auth.jwt()->>'email', '')), '@', 2) = 'estudante.uab.pt'
    or exists (
      select 1
      from public.account_email_migration migration
      where migration.user_id = auth.uid()
        and now() < migration.deadline
    )
  )
);
