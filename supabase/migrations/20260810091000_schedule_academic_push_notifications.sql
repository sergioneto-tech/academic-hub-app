do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'academic-push-daily'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'academic-push-daily',
    '0 8 * * *',
    $cron$select private.dispatch_academic_push_notifications();$cron$
  );
end
$$;
