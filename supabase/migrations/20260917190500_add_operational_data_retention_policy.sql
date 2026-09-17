create schema if not exists private;

create table if not exists private.data_retention_policy (
  category text primary key,
  retention_days integer,
  trigger_condition text not null,
  action text not null,
  notes text,
  updated_at timestamptz not null default now(),
  constraint data_retention_policy_days_positive check (retention_days is null or retention_days > 0)
);

revoke all on table private.data_retention_policy from public, anon, authenticated;
grant select on table private.data_retention_policy to service_role;

insert into private.data_retention_policy(category, retention_days, trigger_condition, action, notes)
values
  ('push_delivery_log', 180, 'sent_at older than 180 days', 'delete', 'Operational delivery troubleshooting only.'),
  ('disabled_push_subscriptions', 90, 'enabled=false and updated_at older than 90 days', 'delete', 'Old disabled browser endpoints are no longer operationally useful.'),
  ('resolved_client_errors', 180, 'status=resolved and resolved_at older than 180 days', 'delete', 'Keeps a limited post-resolution diagnostic window.'),
  ('survey_responses', 365, 'created_at older than 365 days', 'delete', 'Product feedback is not retained indefinitely.'),
  ('resolved_puc_submissions', 730, 'status approved/rejected and resolved_at or updated_at older than 730 days', 'delete', 'Longer window supports catalog correction traceability.'),
  ('admin_support_access_log', 365, 'expires_at reached', 'delete', 'Administrative access audit retention.'),
  ('security_events', null, 'per-event expires_at; routine normally 90-180 days, serious incidents up to 365 days or legal hold', 'delete when expired', 'Existing security retention remains authoritative.'),
  ('core_account_and_academic_state', null, 'while account remains active', 'retain until account deletion', 'Needed to provide account, sync and academic organisation features.'),
  ('feedback_cases_and_attachments', null, 'while account remains active', 'retain until account deletion or case deletion', 'Supports the user-visible support history; attachment objects require Storage API deletion.'),
  ('support_identity', null, 'while account remains active', 'retain until account deletion', 'Pseudonymous support identifier is required for support without exposing email/student number.')
on conflict (category) do update set
  retention_days = excluded.retention_days,
  trigger_condition = excluded.trigger_condition,
  action = excluded.action,
  notes = excluded.notes,
  updated_at = now();

create or replace function private.cleanup_operational_retention()
returns table(
  push_delivery_deleted bigint,
  disabled_push_deleted bigint,
  resolved_errors_deleted bigint,
  surveys_deleted bigint,
  puc_submissions_deleted bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_push bigint := 0;
  v_disabled bigint := 0;
  v_errors bigint := 0;
  v_surveys bigint := 0;
  v_puc bigint := 0;
begin
  delete from public.push_delivery_log
  where sent_at < now() - interval '180 days';
  get diagnostics v_push = row_count;

  delete from public.push_subscriptions
  where enabled = false
    and updated_at < now() - interval '90 days';
  get diagnostics v_disabled = row_count;

  delete from public.client_error_reports
  where status = 'resolved'
    and resolved_at is not null
    and resolved_at < now() - interval '180 days';
  get diagnostics v_errors = row_count;

  delete from public.app_survey_responses
  where created_at < now() - interval '365 days';
  get diagnostics v_surveys = row_count;

  delete from public.puc_catalog_submissions
  where status in ('approved', 'rejected')
    and coalesce(resolved_at, updated_at) < now() - interval '730 days';
  get diagnostics v_puc = row_count;

  return query select v_push, v_disabled, v_errors, v_surveys, v_puc;
end;
$$;

revoke all on function private.cleanup_operational_retention() from public, anon, authenticated;
grant execute on function private.cleanup_operational_retention() to service_role;

do $$
begin
  perform cron.unschedule('academic-hub-operational-retention');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'academic-hub-operational-retention',
  '37 3 * * *',
  'select * from private.cleanup_operational_retention();'
);
