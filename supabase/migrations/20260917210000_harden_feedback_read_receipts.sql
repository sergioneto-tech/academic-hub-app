-- Remove the authenticated SECURITY DEFINER surface from feedback read receipts.
-- Signed-in users receive UPDATE privilege only on read_at, and RLS limits that
-- update to Academic Hub replies that belong to their own feedback requests.

grant update (read_at) on public.feedback_messages to authenticated;

drop policy if exists feedback_messages_update_read_receipt on public.feedback_messages;
create policy feedback_messages_update_read_receipt
  on public.feedback_messages
  for update
  to authenticated
  using (
    author = 'academic_hub'
    and exists (
      select 1
      from public.feedback_requests r
      where r.id = feedback_messages.request_id
        and r.user_id = (select auth.uid())
    )
  )
  with check (
    author = 'academic_hub'
    and exists (
      select 1
      from public.feedback_requests r
      where r.id = feedback_messages.request_id
        and r.user_id = (select auth.uid())
    )
  );

create or replace function public.feedback_lock_read_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.read_at is distinct from old.read_at then
    -- A receipt can only move from unread to the server timestamp once.
    -- Direct client UPDATEs therefore cannot forge, clear or rewrite the time.
    new.read_at := coalesce(old.read_at, now());
  end if;
  return new;
end;
$$;

revoke all on function public.feedback_lock_read_at() from public, anon, authenticated;

drop trigger if exists feedback_messages_lock_read_at on public.feedback_messages;
create trigger feedback_messages_lock_read_at
before update of read_at on public.feedback_messages
for each row
execute function public.feedback_lock_read_at();

create or replace function public.mark_feedback_messages_read(p_request_id uuid)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  affected integer := 0;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.feedback_requests r
    where r.id = p_request_id
      and r.user_id = caller_id
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.feedback_messages m
  set read_at = now()
  where m.request_id = p_request_id
    and m.author = 'academic_hub'
    and m.read_at is null;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.mark_feedback_messages_read(uuid) from public, anon;
grant execute on function public.mark_feedback_messages_read(uuid) to authenticated;
