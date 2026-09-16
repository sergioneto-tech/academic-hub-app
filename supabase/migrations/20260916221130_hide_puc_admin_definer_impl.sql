create or replace function private.review_puc_catalog_submission_impl(
  p_submission_id uuid,
  p_decision text,
  p_note text default null
)
returns table (
  submission_id uuid,
  submission_status text,
  new_catalog_id uuid,
  new_catalog_version integer
)
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
  if normalized_note is not null and char_length(normalized_note) > 2000 then
    raise exception 'puc_admin_note_too_long';
  end if;

  select * into submission_row
  from public.puc_catalog_submissions
  where id = p_submission_id
  for update;

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

  select * into base_row
  from public.puc_catalog_entries
  where id = submission_row.base_catalog_id
  for update;

  if not found then raise exception 'puc_correction_base_unavailable'; end if;
  if base_row.version is distinct from submission_row.base_version
     or base_row.course_code is distinct from submission_row.course_code
     or base_row.academic_year is distinct from submission_row.academic_year
     or base_row.edition is distinct from submission_row.edition then
    raise exception 'puc_correction_base_mismatch';
  end if;

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
  where course_code = base_row.course_code
    and academic_year = base_row.academic_year
    and edition = base_row.edition;

  update public.puc_catalog_entries
  set is_active = false, updated_at = now()
  where id = base_row.id;

  insert into public.puc_catalog_entries (
    course_code, course_name, academic_year, edition, evaluation_model, payload,
    source_hash, source_page_count, version, is_active, validated_at, created_at, updated_at
  ) values (
    submission_row.course_code, submission_row.course_name, submission_row.academic_year,
    submission_row.edition, submission_row.evaluation_model,
    jsonb_build_object(
      'events', coalesce(submission_row.proposed_payload->'events', '[]'::jsonb),
      'finalAssessment', submission_row.proposed_payload->'finalAssessment'
    ),
    base_row.source_hash, base_row.source_page_count, next_version, true, now(), now(), now()
  ) returning id into created_catalog_id;

  update public.puc_catalog_submissions
  set status = 'approved', reviewed_by = caller,
      manager_read_at = coalesce(manager_read_at, now()), resolved_at = now(),
      resolution_note = normalized_note, updated_at = now()
  where id = submission_row.id;

  return query select submission_row.id, 'approved'::text, created_catalog_id, next_version;
end;
$$;

revoke all on function private.review_puc_catalog_submission_impl(uuid, text, text) from public, anon;
grant execute on function private.review_puc_catalog_submission_impl(uuid, text, text) to authenticated;

create or replace function public.review_puc_catalog_submission(
  p_submission_id uuid,
  p_decision text,
  p_note text default null
)
returns table (
  submission_id uuid,
  submission_status text,
  new_catalog_id uuid,
  new_catalog_version integer
)
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select * from private.review_puc_catalog_submission_impl(p_submission_id, p_decision, p_note);
$$;

revoke all on function public.review_puc_catalog_submission(uuid, text, text) from public, anon;
grant execute on function public.review_puc_catalog_submission(uuid, text, text) to authenticated;
