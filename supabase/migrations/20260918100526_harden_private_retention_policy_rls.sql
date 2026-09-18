-- Defense in depth for the internal retention catalogue.
-- The table already lives in the private schema and has no anon/authenticated grants.
-- RLS + FORCE RLS makes that isolation explicit and prevents accidental future exposure.
alter table private.data_retention_policy enable row level security;
alter table private.data_retention_policy force row level security;

revoke all on table private.data_retention_policy from public, anon, authenticated;
grant select on table private.data_retention_policy to service_role;

comment on table private.data_retention_policy is
  'Internal Academic Hub retention catalogue. Private schema, FORCE RLS, no client policies; readable only by trusted backend/service role and owner.';
