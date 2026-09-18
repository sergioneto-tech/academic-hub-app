-- Mirrors the production migration history entry created for the survey deferral lookup index.
create index if not exists app_survey_deferrals_user_id_idx on public.app_survey_deferrals(user_id);
