create table private.admin_support_access_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  subject_user_id uuid references auth.users(id) on delete set null,
  support_id text not null,
  action text not null default 'support_lookup',
  reason text not null,
  fields_returned text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '365 days'),
  constraint admin_support_access_log_support_id_format
    check (support_id ~ '^AH-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$'),
  constraint admin_support_access_log_reason_length
    check (char_length(btrim(reason)) between 8 and 500),
  constraint admin_support_access_log_action
    check (action in ('support_lookup', 'exceptional_access'))
);

alter table private.admin_support_access_log enable row level security;
alter table private.admin_support_access_log force row level security;

revoke all on table private.admin_support_access_log from public, anon, authenticated;
grant select, insert, delete on table private.admin_support_access_log to service_role;

create index admin_support_access_log_admin_created_idx
  on private.admin_support_access_log(admin_user_id, created_at desc);
create index admin_support_access_log_subject_created_idx
  on private.admin_support_access_log(subject_user_id, created_at desc)
  where subject_user_id is not null;
create index admin_support_access_log_expires_idx
  on private.admin_support_access_log(expires_at);

create or replace function private.guard_admin_support_access_log_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'Academic Hub admin support audit records are immutable';
end;
$$;

revoke all on function private.guard_admin_support_access_log_immutable() from public, anon, authenticated, service_role;

drop trigger if exists admin_support_access_log_immutable on private.admin_support_access_log;
create trigger admin_support_access_log_immutable
before update on private.admin_support_access_log
for each row execute function private.guard_admin_support_access_log_immutable();

create or replace function private.purge_expired_admin_support_access_logs()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  removed integer;
begin
  delete from private.admin_support_access_log where expires_at <= now();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function private.purge_expired_admin_support_access_logs() from public, anon, authenticated;
grant execute on function private.purge_expired_admin_support_access_logs() to service_role;

create or replace function public.log_admin_support_access(
  p_admin_user_id uuid,
  p_subject_user_id uuid,
  p_support_id text,
  p_reason text,
  p_fields_returned text[],
  p_action text default 'support_lookup'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_id uuid;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if p_admin_user_id is null then
    raise exception 'admin_user_id_required';
  end if;
  if p_support_id !~ '^AH-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$' then
    raise exception 'invalid_support_id';
  end if;
  if char_length(v_reason) < 8 or char_length(v_reason) > 500 then
    raise exception 'invalid_reason';
  end if;
  if p_action not in ('support_lookup', 'exceptional_access') then
    raise exception 'invalid_action';
  end if;

  insert into private.admin_support_access_log(
    admin_user_id,
    subject_user_id,
    support_id,
    action,
    reason,
    fields_returned
  ) values (
    p_admin_user_id,
    p_subject_user_id,
    p_support_id,
    p_action,
    v_reason,
    coalesce(p_fields_returned, '{}'::text[])
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.log_admin_support_access(uuid, uuid, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.log_admin_support_access(uuid, uuid, text, text, text[], text) to service_role;

do $$
begin
  perform cron.unschedule('academic-hub-purge-admin-support-access-log');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'academic-hub-purge-admin-support-access-log',
  '17 3 * * *',
  'select private.purge_expired_admin_support_access_logs();'
);
