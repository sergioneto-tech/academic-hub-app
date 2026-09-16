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
  on conflict on constraint puc_catalog_acceptances_pkey
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
