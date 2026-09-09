insert into public.push_server_config (key, value)
values ('release_function_url', 'https://apgoyzfzuukkpmuxiqvy.supabase.co/functions/v1/release-push')
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

create or replace function private.dispatch_release_update_push()
returns void
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  function_url text;
  cron_secret text;
begin
  select value into function_url
  from public.push_server_config
  where key = 'release_function_url';

  select value into cron_secret
  from public.push_server_config
  where key = 'cron_secret';

  if function_url is null or cron_secret is null then
    return;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

revoke execute on function private.dispatch_release_update_push() from public, anon, authenticated;
grant execute on function private.dispatch_release_update_push() to postgres, service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'academic-hub-release-push-check') then
    perform cron.unschedule('academic-hub-release-push-check');
  end if;
end $$;

select cron.schedule(
  'academic-hub-release-push-check',
  '17 * * * *',
  'select private.dispatch_release_update_push();'
);
