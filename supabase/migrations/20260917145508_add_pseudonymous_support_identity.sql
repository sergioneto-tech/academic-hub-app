create table if not exists public.user_support_identity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  support_id text not null unique,
  created_at timestamptz not null default now(),
  constraint user_support_identity_format check (support_id ~ '^AH-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$')
);

alter table public.user_support_identity enable row level security;
alter table public.user_support_identity force row level security;

revoke all on table public.user_support_identity from public, anon, authenticated;
grant select on table public.user_support_identity to authenticated;
grant select on table public.user_support_identity to service_role;

drop policy if exists user_support_identity_select_own on public.user_support_identity;
create policy user_support_identity_select_own
on public.user_support_identity
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function private.generate_support_id()
returns text
language plpgsql
volatile
set search_path = pg_catalog
as $$
declare
  raw text;
begin
  raw := upper(replace(gen_random_uuid()::text, '-', ''));
  return 'AH-' || substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4);
end;
$$;

revoke all on function private.generate_support_id() from public, anon, authenticated;

create or replace function private.ensure_user_support_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  candidate text;
  attempts integer := 0;
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  if exists (select 1 from public.user_support_identity where user_id = new.id) then
    return new;
  end if;

  loop
    attempts := attempts + 1;
    candidate := private.generate_support_id();
    begin
      insert into public.user_support_identity(user_id, support_id)
      values (new.id, candidate);
      exit;
    exception when unique_violation then
      if attempts >= 10 then
        raise;
      end if;
    end;
  end loop;

  return new;
end;
$$;

revoke all on function private.ensure_user_support_identity() from public, anon, authenticated;

drop trigger if exists academic_hub_create_support_identity on auth.users;
create trigger academic_hub_create_support_identity
after insert on auth.users
for each row execute function private.ensure_user_support_identity();

create or replace function private.guard_user_support_identity_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.user_id is distinct from old.user_id or new.support_id is distinct from old.support_id then
    raise exception 'Academic Hub support identity is immutable';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_user_support_identity_immutable() from public, anon, authenticated;

drop trigger if exists user_support_identity_immutable on public.user_support_identity;
create trigger user_support_identity_immutable
before update on public.user_support_identity
for each row execute function private.guard_user_support_identity_immutable();

do $$
declare
  account record;
  candidate text;
  attempts integer;
begin
  for account in
    select u.id
    from auth.users u
    left join public.user_support_identity s on s.user_id = u.id
    where coalesce(u.is_anonymous, false) = false
      and s.user_id is null
    order by u.created_at, u.id
  loop
    attempts := 0;
    loop
      attempts := attempts + 1;
      candidate := private.generate_support_id();
      begin
        insert into public.user_support_identity(user_id, support_id)
        values (account.id, candidate);
        exit;
      exception when unique_violation then
        if attempts >= 10 then
          raise;
        end if;
      end;
    end loop;
  end loop;
end;
$$;
