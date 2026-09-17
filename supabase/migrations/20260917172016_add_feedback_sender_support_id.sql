alter table public.feedback_requests
  add column if not exists sender_support_id text;

update public.feedback_requests f
set sender_support_id = s.support_id
from public.user_support_identity s
where s.user_id = f.user_id
  and f.sender_support_id is null;

do $$
begin
  if exists (
    select 1
    from public.feedback_requests
    where sender_support_id is null
  ) then
    raise exception 'feedback_sender_support_id_backfill_incomplete';
  end if;
end;
$$;

alter table public.feedback_requests
  alter column sender_support_id set not null;

alter table public.feedback_requests
  drop constraint if exists feedback_requests_sender_support_id_format;
alter table public.feedback_requests
  add constraint feedback_requests_sender_support_id_format
  check (sender_support_id ~ '^AH-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$');

create index if not exists feedback_requests_sender_support_id_idx
  on public.feedback_requests(sender_support_id, created_at desc);

create or replace function private.assign_feedback_sender_support_id()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_support_id text;
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'feedback_user_id_is_immutable';
  end if;

  select s.support_id
  into v_support_id
  from public.user_support_identity s
  where s.user_id = new.user_id;

  if v_support_id is null then
    raise exception 'feedback_support_identity_missing';
  end if;

  new.sender_support_id := v_support_id;
  return new;
end;
$$;

revoke all on function private.assign_feedback_sender_support_id() from public, anon, authenticated;

drop trigger if exists feedback_requests_assign_sender_support_id on public.feedback_requests;
create trigger feedback_requests_assign_sender_support_id
before insert or update of user_id, sender_support_id
on public.feedback_requests
for each row execute function private.assign_feedback_sender_support_id();
