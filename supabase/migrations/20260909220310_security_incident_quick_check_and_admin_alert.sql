insert into public.push_server_config(key,value,updated_at)
values ('security_manager_user_id','b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c',now())
on conflict (key) do update set value=excluded.value, updated_at=now();

create or replace function public.security_quick_integrity_check()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, storage
as $$
declare
  v_rls bigint := 0;
  v_force_rls bigint := 0;
  v_anon_table bigint := 0;
  v_client_maintain bigint := 0;
  v_public_buckets bigint := 0;
  v_total bigint := 0;
begin
  select count(*) into v_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity;

  select count(*) into v_force_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p') and not c.relforcerowsecurity;

  select count(*) into v_anon_table
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
    and has_table_privilege('anon', format('%I.%I',n.nspname,c.relname), 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN');

  select count(*) into v_client_maintain
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
    and (has_table_privilege('anon', format('%I.%I',n.nspname,c.relname), 'MAINTAIN')
      or has_table_privilege('authenticated', format('%I.%I',n.nspname,c.relname), 'MAINTAIN'));

  select count(*) into v_public_buckets from storage.buckets where public is true;
  v_total := v_rls + v_force_rls + v_anon_table + v_client_maintain + v_public_buckets;

  return jsonb_build_object(
    'checked_at', now(),
    'blocking_findings', v_total,
    'public_tables_without_rls', v_rls,
    'public_tables_without_force_rls', v_force_rls,
    'anon_direct_table_access', v_anon_table,
    'client_maintain_privilege', v_client_maintain,
    'public_storage_buckets', v_public_buckets
  );
end;
$$;

revoke all on function public.security_quick_integrity_check() from public, anon, authenticated;
grant execute on function public.security_quick_integrity_check() to service_role;
