create table public.app_survey_deferrals (
  survey_id text not null check (char_length(survey_id) between 1 and 80),
  user_id uuid not null references auth.users(id) on delete cascade,
  deferral_no smallint not null check (deferral_no between 1 and 2),
  deferred_at timestamptz not null default now(),
  primary key (survey_id, user_id, deferral_no)
);

create index app_survey_deferrals_user_latest_idx
  on public.app_survey_deferrals (survey_id, user_id, deferred_at desc);

alter table public.app_survey_deferrals enable row level security;
alter table public.app_survey_deferrals force row level security;

revoke all on table public.app_survey_deferrals from anon, authenticated;
grant select, insert on table public.app_survey_deferrals to authenticated;

create policy app_survey_deferrals_select_own
  on public.app_survey_deferrals
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy app_survey_deferrals_insert_own
  on public.app_survey_deferrals
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and deferred_at >= now() - interval '5 minutes'
    and deferred_at <= now() + interval '5 minutes'
  );
