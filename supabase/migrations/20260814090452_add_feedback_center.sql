create sequence if not exists public.feedback_reference_seq start with 1 increment by 1;

do $$ begin
  create type public.feedback_kind as enum ('opinion','suggestion','bug');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.feedback_status as enum ('new','reviewing','waiting_user','planned','in_development','completed','not_planned','archived');
exception when duplicate_object then null; end $$;

create table if not exists public.feedback_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('AH-' || lpad(nextval('public.feedback_reference_seq')::text, 4, '0')),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.feedback_kind not null,
  area text,
  title text not null check (char_length(trim(title)) >= 3),
  body text not null default '',
  steps text,
  expected text,
  status public.feedback_status not null default 'new',
  resolution_note text,
  resolved_version text,
  app_version text not null,
  device text not null,
  manager_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.feedback_requests(id) on delete cascade,
  author text not null check (author in ('student','academic_hub')),
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.feedback_requests(id) on delete cascade,
  status public.feedback_status not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.feedback_requests(id) on delete cascade,
  storage_path text not null unique,
  name text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.feedback_requests enable row level security;
alter table public.feedback_requests force row level security;
alter table public.feedback_messages enable row level security;
alter table public.feedback_messages force row level security;
alter table public.feedback_history enable row level security;
alter table public.feedback_history force row level security;
alter table public.feedback_attachments enable row level security;
alter table public.feedback_attachments force row level security;

revoke all on public.feedback_requests from anon, authenticated;
revoke all on public.feedback_messages from anon, authenticated;
revoke all on public.feedback_history from anon, authenticated;
revoke all on public.feedback_attachments from anon, authenticated;
grant select, insert, update on public.feedback_requests to authenticated;
grant select, insert on public.feedback_messages to authenticated;
grant select on public.feedback_history to authenticated;
grant select, insert on public.feedback_attachments to authenticated;
grant usage, select on sequence public.feedback_reference_seq to authenticated;

drop policy if exists feedback_requests_select on public.feedback_requests;
create policy feedback_requests_select on public.feedback_requests for select to authenticated using (
  auth.uid() = user_id or auth.uid() = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid
);

drop policy if exists feedback_requests_insert on public.feedback_requests;
create policy feedback_requests_insert on public.feedback_requests for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists feedback_requests_update_manager on public.feedback_requests;
create policy feedback_requests_update_manager on public.feedback_requests for update to authenticated using (
  auth.uid() = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid
) with check (
  auth.uid() = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid
);

drop policy if exists feedback_messages_select on public.feedback_messages;
create policy feedback_messages_select on public.feedback_messages for select to authenticated using (
  exists (select 1 from public.feedback_requests r where r.id = request_id and (r.user_id = auth.uid() or auth.uid() = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid))
);

drop policy if exists feedback_messages_insert on public.feedback_messages;
create policy feedback_messages_insert on public.feedback_messages for insert to authenticated with check (
  (author = 'student' and exists (select 1 from public.feedback_requests r where r.id = request_id and r.user_id = auth.uid()))
  or
  (author = 'academic_hub' and auth.uid() = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid)
);

drop policy if exists feedback_history_select on public.feedback_history;
create policy feedback_history_select on public.feedback_history for select to authenticated using (
  exists (select 1 from public.feedback_requests r where r.id = request_id and (r.user_id = auth.uid() or auth.uid() = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid))
);

drop policy if exists feedback_attachments_select on public.feedback_attachments;
create policy feedback_attachments_select on public.feedback_attachments for select to authenticated using (
  exists (select 1 from public.feedback_requests r where r.id = request_id and (r.user_id = auth.uid() or auth.uid() = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid))
);

drop policy if exists feedback_attachments_insert on public.feedback_attachments;
create policy feedback_attachments_insert on public.feedback_attachments for insert to authenticated with check (
  exists (select 1 from public.feedback_requests r where r.id = request_id and r.user_id = auth.uid())
);

create or replace function public.feedback_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.feedback_record_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.feedback_history(request_id, status, note)
    values (new.id, new.status, 'Feedback recebido pelo Academic Hub.');
  elsif new.status is distinct from old.status then
    insert into public.feedback_history(request_id, status, note)
    values (new.id, new.status, new.resolution_note);
  end if;
  return new;
end;
$$;

revoke all on function public.feedback_record_history() from public, anon, authenticated;
revoke all on function public.feedback_touch_updated_at() from public, anon, authenticated;

drop trigger if exists feedback_requests_touch_updated_at on public.feedback_requests;
create trigger feedback_requests_touch_updated_at before update on public.feedback_requests for each row execute function public.feedback_touch_updated_at();

drop trigger if exists feedback_requests_history on public.feedback_requests;
create trigger feedback_requests_history after insert or update on public.feedback_requests for each row execute function public.feedback_record_history();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-attachments', 'feedback-attachments', false, 8388608, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists feedback_storage_select on storage.objects;
create policy feedback_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'feedback-attachments' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or auth.uid() = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid
  )
);

drop policy if exists feedback_storage_insert on storage.objects;
create policy feedback_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'feedback-attachments' and (storage.foldername(name))[1] = auth.uid()::text
);
