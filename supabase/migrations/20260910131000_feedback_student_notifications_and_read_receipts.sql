alter table public.feedback_messages
  add column if not exists read_at timestamptz;

comment on column public.feedback_messages.read_at is
  'First time the student who owns the feedback request opened the Academic Hub reply.';

create index if not exists feedback_messages_unread_academic_hub_idx
  on public.feedback_messages (request_id, created_at)
  where author = 'academic_hub' and read_at is null;

-- Students never receive direct UPDATE rights on feedback_messages. This RPC is
-- the only supported way to acknowledge Academic Hub replies as read. It derives
-- the timestamp on the server and verifies ownership of the request.
create or replace function public.mark_feedback_messages_read(p_request_id uuid)
returns integer
language plpgsql
security definer
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

-- Keep the message table immutable to students/managers after insertion. Read
-- receipts can only be changed through mark_feedback_messages_read().
revoke update on public.feedback_messages from authenticated;

insert into public.push_server_config (key, value)
values (
  'feedback_student_function_url',
  'https://apgoyzfzuukkpmuxiqvy.supabase.co/functions/v1/feedback-student-push'
)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

create or replace function private.dispatch_feedback_reply_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  function_url text;
  cron_secret text;
begin
  if new.author <> 'academic_hub' then
    return new;
  end if;

  select value into function_url
  from public.push_server_config
  where key = 'feedback_student_function_url';

  select value into cron_secret
  from public.push_server_config
  where key = 'cron_secret';

  if function_url is null or cron_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object(
      'event', 'reply',
      'request_id', new.request_id::text,
      'message_id', new.id::text
    ),
    timeout_milliseconds := 10000
  );

  return new;
end;
$$;

create or replace function private.dispatch_feedback_status_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  function_url text;
  cron_secret text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- These are meaningful student-facing transitions. Archiving is an internal
  -- housekeeping action and deliberately does not generate a notification.
  if new.status not in ('reviewing', 'waiting_user', 'planned', 'in_development', 'completed', 'not_planned') then
    return new;
  end if;

  select value into function_url
  from public.push_server_config
  where key = 'feedback_student_function_url';

  select value into cron_secret
  from public.push_server_config
  where key = 'cron_secret';

  if function_url is null or cron_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object(
      'event', 'status',
      'request_id', new.id::text,
      'status', new.status::text,
      'status_at', new.updated_at::text
    ),
    timeout_milliseconds := 10000
  );

  return new;
end;
$$;

revoke execute on function private.dispatch_feedback_reply_push() from public, anon, authenticated;
revoke execute on function private.dispatch_feedback_status_push() from public, anon, authenticated;

drop trigger if exists feedback_reply_push_after_insert on public.feedback_messages;
create trigger feedback_reply_push_after_insert
after insert on public.feedback_messages
for each row
when (new.author = 'academic_hub')
execute function private.dispatch_feedback_reply_push();

drop trigger if exists feedback_status_push_after_update on public.feedback_requests;
create trigger feedback_status_push_after_update
after update of status on public.feedback_requests
for each row
when (old.status is distinct from new.status)
execute function private.dispatch_feedback_status_push();
