insert into public.push_server_config (key, value)
values ('survey_function_url', 'https://apgoyzfzuukkpmuxiqvy.supabase.co/functions/v1/survey-push')
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

create or replace function private.dispatch_survey_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  function_url text;
  cron_secret text;
begin
  select value into function_url from public.push_server_config where key = 'survey_function_url';
  select value into cron_secret from public.push_server_config where key = 'cron_secret';
  if function_url is null or cron_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object(
      'survey_id', new.survey_id,
      'user_id', new.user_id
    ),
    timeout_milliseconds := 10000
  );
  return new;
end;
$$;
revoke execute on function private.dispatch_survey_push() from public, anon, authenticated;

drop trigger if exists app_survey_push_after_insert on public.app_survey_responses;
create trigger app_survey_push_after_insert
after insert on public.app_survey_responses
for each row execute function private.dispatch_survey_push();
