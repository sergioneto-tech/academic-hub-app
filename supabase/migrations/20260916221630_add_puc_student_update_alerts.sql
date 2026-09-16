create or replace function public.get_my_puc_update_alerts()
returns table (
  accepted_catalog_id uuid,
  active_catalog_id uuid,
  course_code text,
  course_name text,
  academic_year text,
  edition text,
  accepted_version integer,
  active_version integer,
  accepted_evaluation_model text,
  active_evaluation_model text,
  accepted_payload jsonb,
  active_payload jsonb,
  accepted_at timestamptz,
  active_validated_at timestamptz
)
language sql
security invoker
set search_path = pg_catalog, public
as $$
  with latest_acceptance as (
    select distinct on (accepted.course_code, accepted.academic_year, accepted.edition)
      a.catalog_id as accepted_catalog_id,
      accepted.course_code,
      accepted.course_name,
      accepted.academic_year,
      accepted.edition,
      a.accepted_version,
      accepted.evaluation_model as accepted_evaluation_model,
      accepted.payload as accepted_payload,
      a.accepted_at
    from public.puc_catalog_acceptances a
    join public.puc_catalog_entries accepted on accepted.id = a.catalog_id
    where a.user_id = (select auth.uid())
    order by accepted.course_code, accepted.academic_year, accepted.edition, a.accepted_at desc
  )
  select
    latest.accepted_catalog_id,
    active.id,
    latest.course_code,
    active.course_name,
    latest.academic_year,
    latest.edition,
    latest.accepted_version,
    active.version,
    latest.accepted_evaluation_model,
    active.evaluation_model,
    latest.accepted_payload,
    active.payload,
    latest.accepted_at,
    active.validated_at
  from latest_acceptance latest
  join public.puc_catalog_entries active
    on active.course_code = latest.course_code
   and active.academic_year = latest.academic_year
   and active.edition = latest.edition
   and active.is_active = true
  where active.id <> latest.accepted_catalog_id
     or active.version <> latest.accepted_version
  order by active.validated_at desc, latest.course_code;
$$;

revoke all on function public.get_my_puc_update_alerts() from public, anon;
grant execute on function public.get_my_puc_update_alerts() to authenticated;
