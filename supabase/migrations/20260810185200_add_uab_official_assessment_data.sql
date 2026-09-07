create table if not exists public.uab_evaluation_regulations (
  academic_year text primary key,
  source_url text not null,
  source_hash text not null,
  uc_codes jsonb not null default '[]'::jsonb,
  is_valid boolean not null default true,
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text
);

alter table public.uab_evaluation_regulations enable row level security;
alter table public.uab_evaluation_regulations force row level security;
revoke all on public.uab_evaluation_regulations from anon, authenticated;

create table if not exists public.uab_exam_schedules (
  academic_year text not null,
  semester smallint not null check (semester in (1,2)),
  source_url text not null,
  source_hash text not null,
  payload jsonb not null,
  is_valid boolean not null default true,
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text,
  primary key (academic_year, semester)
);

alter table public.uab_exam_schedules enable row level security;
alter table public.uab_exam_schedules force row level security;
revoke all on public.uab_exam_schedules from anon, authenticated;

insert into public.push_server_config(key,value)
values ('uab_assessment_function_url','https://apgoyzfzuukkpmuxiqvy.supabase.co/functions/v1/uab-assessment-sync')
on conflict (key) do update set value=excluded.value;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.dispatch_uab_assessment_sync()
returns void
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  function_url text;
  cron_secret text;
begin
  select value into function_url from public.push_server_config where key = 'uab_assessment_function_url';
  select value into cron_secret from public.push_server_config where key = 'cron_secret';
  if function_url is null or cron_secret is null then return; end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',cron_secret),
    body := '{"mode":"refresh"}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke execute on function private.dispatch_uab_assessment_sync() from public, anon, authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'academic-hub-uab-assessment-sync' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'academic-hub-uab-assessment-sync',
    '35 6 * * *',
    'select private.dispatch_uab_assessment_sync();'
  );
end $$;
