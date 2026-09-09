-- Least-privilege hardening for the satisfaction survey.
alter table public.app_survey_responses force row level security;

revoke all on table public.app_survey_responses from anon, authenticated;
grant select, insert on table public.app_survey_responses to authenticated;
