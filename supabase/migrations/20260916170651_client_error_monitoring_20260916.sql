create table if not exists public.client_error_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  error_code text not null check (char_length(error_code) between 3 and 64),
  summary text not null check (char_length(summary) between 1 and 500),
  route text null,
  app_version text not null,
  fingerprint text not null,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  notified_at timestamptz null,
  status text not null default 'open' check (status in ('open','reviewing','resolved','ignored')),
  resolved_at timestamptz null
);

create index if not exists client_error_reports_user_time_idx
  on public.client_error_reports (user_id, last_seen_at desc);
create index if not exists client_error_reports_status_time_idx
  on public.client_error_reports (status, last_seen_at desc);
create index if not exists client_error_reports_fingerprint_idx
  on public.client_error_reports (fingerprint, last_seen_at desc);

alter table public.client_error_reports enable row level security;
alter table public.client_error_reports force row level security;

revoke all on table public.client_error_reports from public, anon, authenticated;
grant all on table public.client_error_reports to service_role;

comment on table public.client_error_reports is
  'Private operational error telemetry for Academic Hub. Stores only bounded technical summaries; no passwords, tokens or raw URLs with query/hash data.';
