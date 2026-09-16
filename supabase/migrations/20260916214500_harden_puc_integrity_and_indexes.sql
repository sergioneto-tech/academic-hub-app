create unique index if not exists puc_catalog_one_active_idx
  on public.puc_catalog_entries (course_code, academic_year, edition)
  where is_active = true;

create index if not exists puc_catalog_lookup_idx
  on public.puc_catalog_entries (course_code, academic_year, edition, version desc);
create index if not exists puc_catalog_updated_idx
  on public.puc_catalog_entries (updated_at desc)
  where is_active = true;
create index if not exists puc_catalog_submissions_user_idx
  on public.puc_catalog_submissions (user_id, created_at desc);
create index if not exists puc_catalog_submissions_pending_idx
  on public.puc_catalog_submissions (status, created_at asc)
  where status = 'pending';
create index if not exists puc_catalog_submissions_catalog_idx
  on public.puc_catalog_submissions (base_catalog_id, created_at desc)
  where base_catalog_id is not null;
create index if not exists puc_catalog_acceptances_catalog_idx
  on public.puc_catalog_acceptances (catalog_id, accepted_version);

alter table public.puc_catalog_entries
  drop constraint if exists puc_catalog_entries_academic_year_sequence_check;
alter table public.puc_catalog_entries
  add constraint puc_catalog_entries_academic_year_sequence_check
  check (split_part(academic_year, '/', 2)::integer = split_part(academic_year, '/', 1)::integer + 1);

alter table public.puc_catalog_submissions
  drop constraint if exists puc_catalog_submissions_academic_year_sequence_check;
alter table public.puc_catalog_submissions
  add constraint puc_catalog_submissions_academic_year_sequence_check
  check (split_part(academic_year, '/', 2)::integer = split_part(academic_year, '/', 1)::integer + 1);

create or replace function private.puc_catalog_validate_payload()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  p jsonb;
  item jsonb;
  total_points numeric := 0;
  final_points numeric := 0;
  event_count integer := 0;
begin
  p := case when tg_table_name = 'puc_catalog_entries' then new.payload else new.proposed_payload end;

  if jsonb_typeof(p) <> 'object' then raise exception 'puc_payload_must_be_object'; end if;
  if not (p ? 'events') or jsonb_typeof(p->'events') <> 'array' then raise exception 'puc_payload_events_must_be_array'; end if;

  event_count := jsonb_array_length(p->'events');
  if event_count > 30 then raise exception 'puc_payload_too_many_events'; end if;

  for item in select value from jsonb_array_elements(p->'events') loop
    if jsonb_typeof(item) <> 'object' then raise exception 'puc_payload_event_must_be_object'; end if;
    if coalesce(char_length(trim(item->>'name')), 0) < 1 or char_length(trim(item->>'name')) > 200 then raise exception 'puc_payload_invalid_event_name'; end if;
    if jsonb_typeof(item->'maxPoints') <> 'number' then raise exception 'puc_payload_event_points_required'; end if;
    if (item->>'maxPoints')::numeric <= 0 or (item->>'maxPoints')::numeric > 20 then raise exception 'puc_payload_invalid_event_points'; end if;
    total_points := total_points + (item->>'maxPoints')::numeric;

    if item ? 'startDate' and item->>'startDate' <> '' and item->>'startDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'puc_payload_invalid_start_date'; end if;
    if item ? 'endDate' and item->>'endDate' <> '' and item->>'endDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'puc_payload_invalid_end_date'; end if;
    if item ? 'gradeReleaseDate' and item->>'gradeReleaseDate' <> '' and item->>'gradeReleaseDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'puc_payload_invalid_grade_date'; end if;
  end loop;

  if p ? 'finalAssessment' and p->'finalAssessment' is not null then
    if jsonb_typeof(p->'finalAssessment') <> 'object' then raise exception 'puc_payload_final_assessment_must_be_object'; end if;
    if jsonb_typeof(p->'finalAssessment'->'maxPoints') <> 'number' then raise exception 'puc_payload_final_points_required'; end if;
    final_points := (p->'finalAssessment'->>'maxPoints')::numeric;
    if final_points <= 0 or final_points > 20 then raise exception 'puc_payload_invalid_final_points'; end if;
    if (p->'finalAssessment') ?| array['date','startDate','endDate','startTime','endTime','gradeReleaseDate'] then raise exception 'puc_payload_exam_dates_forbidden'; end if;
    total_points := total_points + final_points;
  end if;

  if event_count = 0 and final_points = 0 then raise exception 'puc_payload_empty_structure'; end if;
  if abs(total_points - 20) > 0.001 then raise exception 'puc_payload_points_must_total_20'; end if;
  return new;
end;
$$;

create or replace function private.puc_catalog_guard_submission_base()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  base_row public.puc_catalog_entries%rowtype;
begin
  if new.kind = 'correction' then
    select * into base_row from public.puc_catalog_entries where id = new.base_catalog_id;
    if not found then raise exception 'puc_submission_base_not_found'; end if;
    if new.base_version is distinct from base_row.version then raise exception 'puc_submission_base_version_mismatch'; end if;
    if new.course_code is distinct from base_row.course_code
       or new.academic_year is distinct from base_row.academic_year
       or new.edition is distinct from base_row.edition then
      raise exception 'puc_submission_base_identity_mismatch';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.puc_catalog_guard_acceptance_version()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  catalog_version integer;
  catalog_active boolean;
begin
  select version, is_active into catalog_version, catalog_active from public.puc_catalog_entries where id = new.catalog_id;
  if catalog_version is null then raise exception 'puc_acceptance_catalog_not_found'; end if;
  if catalog_active is not true then raise exception 'puc_acceptance_catalog_inactive'; end if;
  if new.accepted_version is distinct from catalog_version then raise exception 'puc_acceptance_version_mismatch'; end if;
  return new;
end;
$$;

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
     or new.created_at is distinct from old.created_at then
    raise exception 'puc_catalog_version_is_immutable';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.puc_catalog_validate_payload() from public, anon, authenticated;
revoke all on function private.puc_catalog_guard_submission_base() from public, anon, authenticated;
revoke all on function private.puc_catalog_guard_acceptance_version() from public, anon, authenticated;
revoke all on function private.puc_catalog_guard_immutable_version() from public, anon, authenticated;

drop trigger if exists puc_catalog_entries_validate_payload on public.puc_catalog_entries;
create trigger puc_catalog_entries_validate_payload before insert or update on public.puc_catalog_entries for each row execute function private.puc_catalog_validate_payload();

drop trigger if exists puc_catalog_entries_guard_immutable_version on public.puc_catalog_entries;
create trigger puc_catalog_entries_guard_immutable_version before update on public.puc_catalog_entries for each row execute function private.puc_catalog_guard_immutable_version();

drop trigger if exists puc_catalog_submissions_validate_payload on public.puc_catalog_submissions;
create trigger puc_catalog_submissions_validate_payload before insert or update on public.puc_catalog_submissions for each row execute function private.puc_catalog_validate_payload();

drop trigger if exists puc_catalog_submissions_guard_base on public.puc_catalog_submissions;
create trigger puc_catalog_submissions_guard_base before insert or update on public.puc_catalog_submissions for each row execute function private.puc_catalog_guard_submission_base();

drop trigger if exists puc_catalog_acceptances_guard_version on public.puc_catalog_acceptances;
create trigger puc_catalog_acceptances_guard_version before insert or update on public.puc_catalog_acceptances for each row execute function private.puc_catalog_guard_acceptance_version();
