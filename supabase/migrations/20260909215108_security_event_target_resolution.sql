alter table private.security_events add column if not exists target_hash text null;
alter table private.security_incidents add column if not exists target_hash text null;
create index if not exists security_events_target_time_idx on private.security_events(target_hash, occurred_at desc);
create index if not exists security_incidents_target_status_idx on private.security_incidents(target_hash, status, last_seen_at desc);

create or replace function public.security_resolve_user_target(p_email text)
returns table(user_id uuid, target_hash text)
language sql
security definer
set search_path = pg_catalog, auth, extensions
as $$
  select u.id,
         encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex')
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;
revoke all on function public.security_resolve_user_target(text) from public, anon, authenticated;
grant execute on function public.security_resolve_user_target(text) to service_role;

create or replace function public.security_hash_target(p_email text)
returns text
language sql
security definer
set search_path = pg_catalog, extensions
as $$
  select encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex');
$$;
revoke all on function public.security_hash_target(text) from public, anon, authenticated;
grant execute on function public.security_hash_target(text) to service_role;
