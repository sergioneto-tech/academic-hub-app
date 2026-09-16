create table if not exists public.puc_catalog_entries (
  id uuid primary key default gen_random_uuid(),
  course_code text not null check (course_code ~ '^[0-9]{4,8}$'),
  course_name text not null check (char_length(trim(course_name)) between 2 and 200),
  academic_year text not null check (academic_year ~ '^[0-9]{4}/[0-9]{4}$'),
  edition text not null default '01' check (char_length(trim(edition)) between 1 and 20),
  evaluation_model text not null check (evaluation_model in ('type1','type2','type3','type4','exam-only','custom')),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 65536
  ),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  source_page_count smallint check (source_page_count between 1 and 80),
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  validated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_code, academic_year, edition)
);

create index if not exists puc_catalog_lookup_idx
  on public.puc_catalog_entries (course_code, academic_year, edition)
  where is_active = true;
create index if not exists puc_catalog_updated_idx
  on public.puc_catalog_entries (updated_at desc)
  where is_active = true;

create table if not exists public.puc_catalog_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('new_entry','correction')),
  course_code text not null check (course_code ~ '^[0-9]{4,8}$'),
  course_name text not null check (char_length(trim(course_name)) between 2 and 200),
  academic_year text not null check (academic_year ~ '^[0-9]{4}/[0-9]{4}$'),
  edition text not null default '01' check (char_length(trim(edition)) between 1 and 20),
  evaluation_model text not null check (evaluation_model in ('type1','type2','type3','type4','exam-only','custom')),
  proposed_payload jsonb not null check (
    jsonb_typeof(proposed_payload) = 'object'
    and octet_length(proposed_payload::text) <= 65536
  ),
  source_hash text check (source_hash is null or source_hash ~ '^[0-9a-f]{64}$'),
  source_page_count smallint check (source_page_count is null or source_page_count between 1 and 80),
  base_catalog_id uuid references public.puc_catalog_entries(id) on delete set null,
  base_version integer check (base_version is null or base_version > 0),
  reason text check (reason is null or char_length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','superseded')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  manager_read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'new_entry' and base_catalog_id is null and base_version is null)
    or
    (kind = 'correction' and base_catalog_id is not null and base_version is not null)
  )
);

create index if not exists puc_catalog_submissions_user_idx
  on public.puc_catalog_submissions (user_id, created_at desc);
create index if not exists puc_catalog_submissions_pending_idx
  on public.puc_catalog_submissions (status, created_at asc)
  where status = 'pending';
create index if not exists puc_catalog_submissions_catalog_idx
  on public.puc_catalog_submissions (base_catalog_id, created_at desc)
  where base_catalog_id is not null;

create table if not exists public.puc_catalog_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_id uuid not null references public.puc_catalog_entries(id) on delete cascade,
  accepted_version integer not null check (accepted_version > 0),
  accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, catalog_id)
);

create index if not exists puc_catalog_acceptances_catalog_idx
  on public.puc_catalog_acceptances (catalog_id, accepted_version);

alter table public.puc_catalog_entries enable row level security;
alter table public.puc_catalog_entries force row level security;
alter table public.puc_catalog_submissions enable row level security;
alter table public.puc_catalog_submissions force row level security;
alter table public.puc_catalog_acceptances enable row level security;
alter table public.puc_catalog_acceptances force row level security;

revoke all on table public.puc_catalog_entries from public, anon, authenticated;
revoke all on table public.puc_catalog_submissions from public, anon, authenticated;
revoke all on table public.puc_catalog_acceptances from public, anon, authenticated;

grant select on table public.puc_catalog_entries to authenticated;
grant select, insert on table public.puc_catalog_submissions to authenticated;
grant select, insert, update, delete on table public.puc_catalog_acceptances to authenticated;
grant all on table public.puc_catalog_entries to service_role;
grant all on table public.puc_catalog_submissions to service_role;
grant all on table public.puc_catalog_acceptances to service_role;

-- Only validated/active shared entries are visible to signed-in students.
drop policy if exists puc_catalog_entries_select_active on public.puc_catalog_entries;
create policy puc_catalog_entries_select_active
on public.puc_catalog_entries
for select
to authenticated
using (is_active = true);

-- Students can only see their own submissions. The manager can review all submissions.
drop policy if exists puc_catalog_submissions_select_own_or_manager on public.puc_catalog_submissions;
create policy puc_catalog_submissions_select_own_or_manager
on public.puc_catalog_submissions
for select
to authenticated
using (
  user_id = auth.uid()
  or auth.uid() = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid
);

drop policy if exists puc_catalog_submissions_insert_own on public.puc_catalog_submissions;
create policy puc_catalog_submissions_insert_own
on public.puc_catalog_submissions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and manager_read_at is null
  and resolved_at is null
  and resolution_note is null
);

-- Acceptance state is private per user and is later used to detect a newer validated catalog version.
drop policy if exists puc_catalog_acceptances_select_own on public.puc_catalog_acceptances;
create policy puc_catalog_acceptances_select_own
on public.puc_catalog_acceptances
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists puc_catalog_acceptances_insert_own on public.puc_catalog_acceptances;
create policy puc_catalog_acceptances_insert_own
on public.puc_catalog_acceptances
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists puc_catalog_acceptances_update_own on public.puc_catalog_acceptances;
create policy puc_catalog_acceptances_update_own
on public.puc_catalog_acceptances
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists puc_catalog_acceptances_delete_own on public.puc_catalog_acceptances;
create policy puc_catalog_acceptances_delete_own
on public.puc_catalog_acceptances
for delete
to authenticated
using (user_id = auth.uid());

create or replace function private.puc_catalog_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.puc_catalog_bump_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  if new.course_code is distinct from old.course_code
     or new.course_name is distinct from old.course_name
     or new.academic_year is distinct from old.academic_year
     or new.edition is distinct from old.edition
     or new.evaluation_model is distinct from old.evaluation_model
     or new.payload is distinct from old.payload
     or new.source_hash is distinct from old.source_hash
     or new.source_page_count is distinct from old.source_page_count then
    new.version = old.version + 1;
    new.validated_at = now();
  else
    new.version = old.version;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.puc_catalog_guard_acceptance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_version integer;
  current_active boolean;
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'invalid_catalog_acceptance_owner';
  end if;

  select version, is_active
    into current_version, current_active
  from public.puc_catalog_entries
  where id = new.catalog_id;

  if current_version is null or current_active is not true then
    raise exception 'catalog_entry_unavailable';
  end if;

  if new.accepted_version > current_version then
    raise exception 'catalog_version_not_available';
  end if;

  new.updated_at = now();
  if tg_op = 'INSERT' then
    new.accepted_at = now();
  elsif new.accepted_version is distinct from old.accepted_version then
    new.accepted_at = now();
  end if;
  return new;
end;
$$;

create or replace function private.puc_catalog_guard_submission_rate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  recent_count integer;
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'invalid_puc_submission_owner';
  end if;

  select count(*)::integer
    into recent_count
  from public.puc_catalog_submissions
  where user_id = new.user_id
    and created_at >= now() - interval '1 hour';

  if recent_count >= 5 then
    raise exception 'puc_submission_rate_limited';
  end if;

  return new;
end;
$$;

revoke all on function private.puc_catalog_touch_updated_at() from public, anon, authenticated;
revoke all on function private.puc_catalog_bump_version() from public, anon, authenticated;
revoke all on function private.puc_catalog_guard_acceptance() from public, anon, authenticated;
revoke all on function private.puc_catalog_guard_submission_rate() from public, anon, authenticated;

drop trigger if exists puc_catalog_entries_bump_version on public.puc_catalog_entries;
create trigger puc_catalog_entries_bump_version
before update on public.puc_catalog_entries
for each row execute function private.puc_catalog_bump_version();

drop trigger if exists puc_catalog_submissions_touch_updated_at on public.puc_catalog_submissions;
create trigger puc_catalog_submissions_touch_updated_at
before update on public.puc_catalog_submissions
for each row execute function private.puc_catalog_touch_updated_at();

drop trigger if exists puc_catalog_acceptances_guard on public.puc_catalog_acceptances;
create trigger puc_catalog_acceptances_guard
before insert or update on public.puc_catalog_acceptances
for each row execute function private.puc_catalog_guard_acceptance();

drop trigger if exists puc_catalog_submissions_guard_rate on public.puc_catalog_submissions;
create trigger puc_catalog_submissions_guard_rate
before insert on public.puc_catalog_submissions
for each row execute function private.puc_catalog_guard_submission_rate();

-- Returns only the caller's outdated accepted catalog versions. This is the basis for the
-- future in-app/push alert after a validated correction publishes a newer version.
create or replace function public.puc_catalog_pending_updates()
returns table (
  catalog_id uuid,
  course_code text,
  course_name text,
  academic_year text,
  edition text,
  accepted_version integer,
  available_version integer,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    c.id,
    c.course_code,
    c.course_name,
    c.academic_year,
    c.edition,
    a.accepted_version,
    c.version,
    c.updated_at
  from public.puc_catalog_acceptances a
  join public.puc_catalog_entries c on c.id = a.catalog_id
  where a.user_id = auth.uid()
    and c.is_active = true
    and a.accepted_version < c.version
  order by c.updated_at desc;
$$;

revoke all on function public.puc_catalog_pending_updates() from public, anon;
grant execute on function public.puc_catalog_pending_updates() to authenticated;

comment on table public.puc_catalog_entries is
  'Validated shared PUC evaluation structures. Contains structured academic data only; raw PDFs and student identity are not stored.';
comment on table public.puc_catalog_submissions is
  'Student proposals for a new shared PUC entry or a correction. Proposals never modify the shared catalog directly.';
comment on table public.puc_catalog_acceptances is
  'Private per-user acknowledgement of the shared PUC version copied into the student area.';
