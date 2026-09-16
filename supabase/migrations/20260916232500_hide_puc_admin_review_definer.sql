create schema if not exists puc_admin;
revoke all on schema puc_admin from public, anon;
grant usage on schema puc_admin to authenticated;

create or replace function puc_admin.review_puc_catalog_submission(
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
begin
  if caller is null then
    raise exception 'puc_admin_not_authenticated';
  end if;
  if caller <> manager_uuid then
    raise exception 'puc_admin_forbidden';
  end if;

  return query
    select *
    from private.review_puc_catalog_submission_impl(
      p_submission_id,
      p_decision,
      p_note
    );
end;
$$;

revoke all on function puc_admin.review_puc_catalog_submission(uuid, text, text) from public, anon;
grant execute on function puc_admin.review_puc_catalog_submission(uuid, text, text) to authenticated;

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
set search_path = pg_catalog, public, puc_admin
as $$
  select *
  from puc_admin.review_puc_catalog_submission(
    p_submission_id,
    p_decision,
    p_note
  );
$$;

revoke all on function public.review_puc_catalog_submission(uuid, text, text) from public, anon;
grant execute on function public.review_puc_catalog_submission(uuid, text, text) to authenticated;
