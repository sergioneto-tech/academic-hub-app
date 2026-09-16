insert into public.push_server_config (key, value, updated_at)
select
  'puc_update_function_url',
  regexp_replace(value, '/academic-push$', '/puc-update-push'),
  now()
from public.push_server_config
where key = 'function_url'
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

create or replace function private.dispatch_puc_update_push()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  function_url text;
  cron_secret text;
  submission_kind text;
begin
  if new.approved_from_submission_id is null then
    return new;
  end if;

  select kind into submission_kind
  from public.puc_catalog_submissions
  where id = new.approved_from_submission_id;

  if submission_kind is distinct from 'correction' then
    return new;
  end if;

  select value into function_url
  from public.push_server_config
  where key = 'puc_update_function_url';

  select value into cron_secret
  from public.push_server_config
  where key = 'cron_secret';

  if function_url is null or cron_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object('catalog_id', new.id),
    timeout_milliseconds := 10000
  );

  return new;
end;
$$;

revoke all on function private.dispatch_puc_update_push() from public, anon, authenticated;

drop trigger if exists puc_catalog_entries_dispatch_update_push on public.puc_catalog_entries;
create trigger puc_catalog_entries_dispatch_update_push
after insert on public.puc_catalog_entries
for each row execute function private.dispatch_puc_update_push();
