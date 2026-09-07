create table public.app_survey_responses (
  survey_id text not null check (char_length(survey_id) between 1 and 80),
  user_id uuid not null references auth.users(id) on delete cascade,
  likes_app boolean not null,
  recommends_app boolean not null,
  rating smallint not null check (rating between 1 and 5),
  app_version text not null check (char_length(app_version) between 1 and 30),
  created_at timestamptz not null default now(),
  primary key (survey_id, user_id)
);

create index app_survey_responses_survey_created_idx
  on public.app_survey_responses (survey_id, created_at desc);

alter table public.app_survey_responses enable row level security;

revoke all on table public.app_survey_responses from anon;
grant select, insert on table public.app_survey_responses to authenticated;

create policy app_survey_responses_select
  on public.app_survey_responses
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select auth.uid()) = 'b305ceaf-d8a1-49bb-9cd2-ebfe8233b85c'::uuid
  );

create policy app_survey_responses_insert
  on public.app_survey_responses
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
