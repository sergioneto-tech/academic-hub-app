create or replace function private.puc_catalog_prepare_submission()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  recent_count integer;
  caller uuid := auth.uid();
begin
  if caller is not null then
    if new.user_id is distinct from caller then
      raise exception 'invalid_puc_submission_owner';
    end if;

    select count(*)::integer
      into recent_count
    from public.puc_catalog_submissions
    where user_id = caller
      and created_at >= now() - interval '1 hour';

    if recent_count >= 5 then
      raise exception 'puc_submission_rate_limited';
    end if;

    new.status = 'pending';
    new.manager_read_at = null;
    new.resolved_at = null;
    new.resolution_note = null;
    new.created_at = now();
    new.updated_at = now();

    if new.kind in ('correction', 'new_entry') then
      new.submitter_declared_at = now();
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.puc_catalog_prepare_submission() from public, anon, authenticated;
