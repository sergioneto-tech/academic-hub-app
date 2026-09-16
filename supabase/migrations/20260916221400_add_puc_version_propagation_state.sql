alter table public.puc_catalog_entries
  add column if not exists superseded_by_catalog_id uuid references public.puc_catalog_entries(id) on delete set null;

alter table public.puc_catalog_entries
  add column if not exists approved_from_submission_id uuid references public.puc_catalog_submissions(id) on delete set null;

create unique index if not exists puc_catalog_entries_approved_submission_uidx
  on public.puc_catalog_entries (approved_from_submission_id)
  where approved_from_submission_id is not null;

create index if not exists puc_catalog_entries_superseded_by_idx
  on public.puc_catalog_entries (superseded_by_catalog_id)
  where superseded_by_catalog_id is not null;

create or replace function private.puc_catalog_guard_immutable_version()
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
     or new.source_page_count is distinct from old.source_page_count
     or new.version is distinct from old.version
     or new.validated_at is distinct from old.validated_at
     or new.created_at is distinct from old.created_at
     or new.approved_from_submission_id is distinct from old.approved_from_submission_id then
    raise exception 'puc_catalog_version_is_immutable';
  end if;

  if old.superseded_by_catalog_id is not null
     and new.superseded_by_catalog_id is distinct from old.superseded_by_catalog_id then
    raise exception 'puc_catalog_successor_is_immutable';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.puc_catalog_validate_successor()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  successor public.puc_catalog_entries%rowtype;
begin
  if new.superseded_by_catalog_id is null then return new; end if;

  select * into successor
  from public.puc_catalog_entries
  where id = new.superseded_by_catalog_id;

  if not found then raise exception 'puc_catalog_successor_not_found'; end if;
  if successor.course_code is distinct from new.course_code
     or successor.academic_year is distinct from new.academic_year
     or successor.edition is distinct from new.edition then
    raise exception 'puc_catalog_successor_identity_mismatch';
  end if;
  if successor.version <= new.version then raise exception 'puc_catalog_successor_version_invalid'; end if;
  if new.is_active is true then raise exception 'puc_catalog_active_cannot_have_successor'; end if;

  return new;
end;
$$;

revoke all on function private.puc_catalog_validate_successor() from public, anon, authenticated;

drop trigger if exists puc_catalog_entries_validate_successor on public.puc_catalog_entries;
create trigger puc_catalog_entries_validate_successor
before insert or update of superseded_by_catalog_id, is_active on public.puc_catalog_entries
for each row execute function private.puc_catalog_validate_successor();

drop policy if exists puc_catalog_entries_select_active on public.puc_catalog_entries;
drop policy if exists puc_catalog_entries_select_active_or_accepted on public.puc_catalog_entries;
create policy puc_catalog_entries_select_active_or_accepted
on public.puc_catalog_entries
for select
to authenticated
using (
  is_active = true
  or exists (
    select 1
    from public.puc_catalog_acceptances a
    where a.catalog_id = puc_catalog_entries.id
      and a.user_id = (select auth.uid())
  )
);

create or replace function public.accept_puc_catalog_version(
  p_catalog_id uuid,
  p_expected_version integer
)
returns table (catalog_id uuid, accepted_version integer, accepted_at timestamptz)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  caller uuid := auth.uid();
  catalog_row public.puc_catalog_entries%rowtype;
begin
  if caller is null then raise exception 'puc_acceptance_not_authenticated'; end if;
  if p_expected_version is null or p_expected_version <= 0 then raise exception 'puc_acceptance_invalid_version'; end if;

  select * into catalog_row
  from public.puc_catalog_entries
  where id = p_catalog_id and is_active = true;

  if not found then raise exception 'puc_acceptance_catalog_not_active'; end if;
  if catalog_row.version is distinct from p_expected_version then raise exception 'puc_acceptance_version_mismatch'; end if;

  insert into public.puc_catalog_acceptances (user_id, catalog_id, accepted_version, accepted_at, updated_at)
  values (caller, catalog_row.id, catalog_row.version, now(), now())
  on conflict (user_id, catalog_id)
  do update set accepted_version = excluded.accepted_version,
                accepted_at = excluded.accepted_at,
                updated_at = excluded.updated_at;

  return query
    select a.catalog_id, a.accepted_version, a.accepted_at
    from public.puc_catalog_acceptances a
    where a.user_id = caller and a.catalog_id = catalog_row.id;
end;
$$;

revoke all on function public.accept_puc_catalog_version(uuid, integer) from public, anon;
grant execute on function public.accept_puc_catalog_version(uuid, integer) to authenticated;

create or replace function public.get_my_puc_catalog_version_status()
returns table (
  accepted_catalog_id uuid,
  course_code text,
  academic_year text,
  edition text,
  accepted_version integer,
  accepted_at timestamptz,
  active_catalog_id uuid,
  active_version integer,
  active_validated_at timestamptz,
  update_available boolean
)
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select
    accepted.id,
    accepted.course_code,
    accepted.academic_year,
    accepted.edition,
    a.accepted_version,
    a.accepted_at,
    active.id,
    active.version,
    active.validated_at,
    (active.id is not null and (active.id <> accepted.id or active.version <> a.accepted_version))
  from public.puc_catalog_acceptances a
  join public.puc_catalog_entries accepted on accepted.id = a.catalog_id
  left join public.puc_catalog_entries active
    on active.course_code = accepted.course_code
   and active.academic_year = accepted.academic_year
   and active.edition = accepted.edition
   and active.is_active = true
  where a.user_id = (select auth.uid())
  order by accepted.course_code, accepted.academic_year desc, accepted.edition, a.accepted_at desc;
$$;

revoke all on function public.get_my_puc_catalog_version_status() from public, anon;
grant execute on function public.get_my_puc_catalog_version_status() to authenticated;

create index if not exists puc_catalog_acceptances_user_recent_idx
  on public.puc_catalog_acceptances (user_id, accepted_at desc);

create or replace function private.review_puc_catalog_submission_impl(
  p_submission_id uuid,
  p_decision text,
  p_note text default null
)
returns table (submission_id uuid, submission_status text, new_catalog_id uuid, new_catalog_version integer)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller uuid := auth.uid();
  manager_uuid constant uuid := 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid;
  submission_row public.puc_catalog_submissions%rowtype;
  base_row public.puc_catalog_entries%rowtype;
  next_version integer;
  created_catalog_id uuid;
  normalized_note text;
begin
  if caller is null then raise exception 'puc_admin_not_authenticated'; end if;
  if caller <> manager_uuid then raise exception 'puc_admin_forbidden'; end if;
  if p_decision not in ('approve','reject') then raise exception 'puc_admin_invalid_decision'; end if;

  normalized_note := nullif(trim(coalesce(p_note, '')), '');
  if normalized_note is not null and char_length(normalized_note) > 2000 then raise exception 'puc_admin_note_too_long'; end if;

  select * into submission_row from public.puc_catalog_submissions where id = p_submission_id for update;
  if not found then raise exception 'puc_submission_not_found'; end if;
  if submission_row.status <> 'pending' then raise exception 'puc_submission_already_resolved'; end if;
  if submission_row.kind <> 'correction' then raise exception 'puc_admin_only_correction_supported'; end if;

  if p_decision = 'reject' then
    update public.puc_catalog_submissions
    set status = 'rejected', reviewed_by = caller,
        manager_read_at = coalesce(manager_read_at, now()),
        resolved_at = now(), resolution_note = normalized_note, updated_at = now()
    where id = submission_row.id;
    return query select submission_row.id, 'rejected'::text, null::uuid, null::integer;
    return;
  end if;

  select * into base_row from public.puc_catalog_entries where id = submission_row.base_catalog_id for update;
  if not found then raise exception 'puc_correction_base_unavailable'; end if;
  if base_row.version is distinct from submission_row.base_version
     or base_row.course_code is distinct from submission_row.course_code
     or base_row.academic_year is distinct from submission_row.academic_year
     or base_row.edition is distinct from submission_row.edition then raise exception 'puc_correction_base_mismatch'; end if;

  if base_row.is_active is not true then
    update public.puc_catalog_submissions
    set status = 'superseded', reviewed_by = caller,
        manager_read_at = coalesce(manager_read_at, now()), resolved_at = now(),
        resolution_note = coalesce(normalized_note, 'A versão-base deixou de ser a versão ativa.'), updated_at = now()
    where id = submission_row.id;
    return query select submission_row.id, 'superseded'::text, null::uuid, null::integer;
    return;
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.puc_catalog_entries
  where course_code = base_row.course_code and academic_year = base_row.academic_year and edition = base_row.edition;

  update public.puc_catalog_entries set is_active = false, updated_at = now() where id = base_row.id;

  insert into public.puc_catalog_entries (
    course_code, course_name, academic_year, edition, evaluation_model, payload,
    source_hash, source_page_count, version, is_active, validated_at,
    approved_from_submission_id, created_at, updated_at
  ) values (
    submission_row.course_code, submission_row.course_name, submission_row.academic_year,
    submission_row.edition, submission_row.evaluation_model,
    jsonb_build_object(
      'events', coalesce(submission_row.proposed_payload->'events', '[]'::jsonb),
      'finalAssessment', submission_row.proposed_payload->'finalAssessment'
    ),
    base_row.source_hash, base_row.source_page_count, next_version, true, now(),
    submission_row.id, now(), now()
  ) returning id into created_catalog_id;

  update public.puc_catalog_entries
  set superseded_by_catalog_id = created_catalog_id, updated_at = now()
  where id = base_row.id;

  update public.puc_catalog_submissions
  set status = 'approved', reviewed_by = caller,
      manager_read_at = coalesce(manager_read_at, now()), resolved_at = now(),
      resolution_note = normalized_note, updated_at = now()
  where id = submission_row.id;

  return query select submission_row.id, 'approved'::text, created_catalog_id, next_version;
end;
$$;
