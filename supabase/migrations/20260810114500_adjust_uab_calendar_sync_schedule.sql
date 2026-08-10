do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'academic-hub-uab-calendar-sync' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule(
    'academic-hub-uab-calendar-sync',
    '20 6 * * 1',
    'select private.dispatch_uab_calendar_sync();'
  );
end $$;
