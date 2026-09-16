revoke all on table public.puc_catalog_entries from public, anon, authenticated;
revoke all on table public.puc_catalog_submissions from public, anon, authenticated;
revoke all on table public.puc_catalog_acceptances from public, anon, authenticated;

grant select on table public.puc_catalog_entries to authenticated;
grant select, insert on table public.puc_catalog_submissions to authenticated;
grant select, insert, update, delete on table public.puc_catalog_acceptances to authenticated;

drop policy if exists puc_catalog_entries_select_active on public.puc_catalog_entries;
create policy puc_catalog_entries_select_active
on public.puc_catalog_entries
for select
to authenticated
using (is_active = true);

drop policy if exists puc_catalog_submissions_select_own_or_manager on public.puc_catalog_submissions;
create policy puc_catalog_submissions_select_own_or_manager
on public.puc_catalog_submissions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select auth.uid()) = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid
);

drop policy if exists puc_catalog_submissions_insert_own on public.puc_catalog_submissions;
create policy puc_catalog_submissions_insert_own
on public.puc_catalog_submissions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and manager_read_at is null
  and resolved_at is null
  and resolution_note is null
);

drop policy if exists puc_catalog_acceptances_select_own on public.puc_catalog_acceptances;
create policy puc_catalog_acceptances_select_own
on public.puc_catalog_acceptances
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists puc_catalog_acceptances_insert_own on public.puc_catalog_acceptances;
create policy puc_catalog_acceptances_insert_own
on public.puc_catalog_acceptances
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists puc_catalog_acceptances_update_own on public.puc_catalog_acceptances;
create policy puc_catalog_acceptances_update_own
on public.puc_catalog_acceptances
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists puc_catalog_acceptances_delete_own on public.puc_catalog_acceptances;
create policy puc_catalog_acceptances_delete_own
on public.puc_catalog_acceptances
for delete
to authenticated
using (user_id = (select auth.uid()));
