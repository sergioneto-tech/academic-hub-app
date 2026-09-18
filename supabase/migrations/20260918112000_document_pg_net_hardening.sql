-- pg_net is required by Academic Hub backend dispatch triggers.
-- The hosted extension is not relocatable, so moving it would require destructive
-- recreation. Harden the client surface instead by revoking direct net access.
do $$
begin
  execute 'revoke usage on schema net from public, anon, authenticated';
  execute 'revoke execute on all functions in schema net from public, anon, authenticated';
exception
  when insufficient_privilege then
    raise notice 'pg_net ACLs are owned by supabase_admin on hosted Supabase; keep this hardening documented and managed by the platform.';
end
$$;

comment on extension pg_net is
  'Required by Academic Hub private dispatch functions. Hosted extension is non-relocatable; direct client exposure is reviewed separately from the extension-in-public Advisor warning.';
