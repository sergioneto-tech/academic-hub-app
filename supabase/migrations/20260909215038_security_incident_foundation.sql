create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.security_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('login_success','login_failed','password_recovery','unauthorized_api','rate_limited','session_revoked','security_action')),
  severity smallint not null default 1 check (severity between 1 and 4),
  source text not null check (source in ('academic_hub_client','supabase_auth','supabase_api','security_watch','administrator')),
  confidence text not null default 'high' check (confidence in ('low','medium','high')),
  ip_address inet null,
  ip_hash text null,
  country_code text null check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  user_agent text null,
  device_label text null,
  app_version text null,
  request_id uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  previous_hash text null,
  event_hash text not null,
  legal_hold boolean not null default false,
  expires_at timestamptz not null
);

create table if not exists private.security_incidents (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid null references auth.users(id) on delete set null,
  incident_type text not null check (incident_type in ('repeated_login_failures','failed_then_successful_login','unauthorized_api_activity','rate_limit_abuse','other')),
  status text not null default 'open' check (status in ('open','reviewing','resolved','false_positive')),
  severity smallint not null default 2 check (severity between 1 and 4),
  confidence text not null default 'medium' check (confidence in ('low','medium','high')),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  event_count integer not null default 1 check (event_count >= 1),
  source_ip_hash text null,
  student_notified_at timestamptz null,
  admin_notified_at timestamptz null,
  investigation_started_at timestamptz null,
  resolution_note text null,
  legal_hold boolean not null default false,
  expires_at timestamptz not null default (now() + interval '365 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.security_events enable row level security;
alter table private.security_events force row level security;
alter table private.security_incidents enable row level security;
alter table private.security_incidents force row level security;

revoke all on private.security_events from public, anon, authenticated;
revoke all on private.security_incidents from public, anon, authenticated;

create index if not exists security_events_user_time_idx on private.security_events(user_id, occurred_at desc);
create index if not exists security_events_type_time_idx on private.security_events(event_type, occurred_at desc);
create index if not exists security_events_ip_time_idx on private.security_events(ip_hash, occurred_at desc);
create index if not exists security_events_expiry_idx on private.security_events(expires_at) where legal_hold = false;
create index if not exists security_incidents_user_status_idx on private.security_incidents(user_id, status, last_seen_at desc);
create index if not exists security_incidents_expiry_idx on private.security_incidents(expires_at) where legal_hold = false;

create or replace function public.security_ingest_event(
  p_event_type text,
  p_user_id uuid default null,
  p_source text default 'academic_hub_client',
  p_confidence text default 'high',
  p_severity smallint default 1,
  p_ip_address text default null,
  p_country_code text default null,
  p_user_agent text default null,
  p_device_label text default null,
  p_app_version text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(event_id uuid, incident_id uuid, incident_reference text, incident_new boolean, should_notify boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_event_id uuid := gen_random_uuid();
  v_request_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_ip inet := null;
  v_ip_hash text := null;
  v_previous_hash text := null;
  v_event_hash text;
  v_expires timestamptz;
  v_count integer := 0;
  v_incident_id uuid := null;
  v_reference text := null;
  v_incident_new boolean := false;
  v_should_notify boolean := false;
  v_incident_type text := null;
  v_incident_severity smallint := 2;
  v_existing_notified timestamptz := null;
begin
  if p_event_type not in ('login_success','login_failed','password_recovery','unauthorized_api','rate_limited','session_revoked','security_action') then raise exception 'invalid security event type'; end if;
  if p_source not in ('academic_hub_client','supabase_auth','supabase_api','security_watch','administrator') then raise exception 'invalid security event source'; end if;
  if p_confidence not in ('low','medium','high') then raise exception 'invalid confidence'; end if;
  if p_severity < 1 or p_severity > 4 then raise exception 'invalid severity'; end if;
  if nullif(trim(coalesce(p_ip_address,'')), '') is not null then begin v_ip := trim(p_ip_address)::inet; v_ip_hash := encode(extensions.digest(host(v_ip), 'sha256'), 'hex'); exception when others then v_ip := null; v_ip_hash := null; end; end if;
  v_expires := v_now + case when p_severity <= 1 then interval '90 days' when p_severity = 2 then interval '180 days' else interval '365 days' end;
  perform pg_advisory_xact_lock(hashtext('academic-hub-security-event-chain'));
  select e.event_hash into v_previous_hash from private.security_events e order by e.occurred_at desc, e.id desc limit 1;
  v_event_hash := encode(extensions.digest(concat_ws('|',v_event_id::text,v_now::text,coalesce(p_user_id::text,''),p_event_type,p_source,p_confidence,p_severity::text,coalesce(host(v_ip),''),coalesce(upper(left(p_country_code,2)),''),coalesce(left(p_device_label,128),''),coalesce(left(p_app_version,32),''),coalesce(v_previous_hash,'')), 'sha256'), 'hex');
  insert into private.security_events(id,occurred_at,user_id,event_type,severity,source,confidence,ip_address,ip_hash,country_code,user_agent,device_label,app_version,request_id,metadata,previous_hash,event_hash,expires_at)
  values(v_event_id,v_now,p_user_id,p_event_type,p_severity,p_source,p_confidence,v_ip,v_ip_hash,nullif(upper(left(trim(coalesce(p_country_code,'')),2)),''),nullif(left(p_user_agent,512),''),nullif(left(p_device_label,128),''),nullif(left(p_app_version,32),''),v_request_id,coalesce(p_metadata,'{}'::jsonb),v_previous_hash,v_event_hash,v_expires);
  if p_user_id is not null and p_event_type = 'login_failed' then
    select count(*) into v_count from private.security_events e where e.user_id=p_user_id and e.event_type='login_failed' and e.occurred_at>=v_now-interval '15 minutes' and (v_ip_hash is null or e.ip_hash=v_ip_hash);
    if v_count>=5 then v_incident_type:='repeated_login_failures'; v_incident_severity:=case when v_count>=10 then 3 else 2 end; end if;
  elsif p_user_id is not null and p_event_type='login_success' and v_ip_hash is not null then
    select count(*) into v_count from private.security_events e where e.user_id=p_user_id and e.event_type='login_failed' and e.ip_hash=v_ip_hash and e.occurred_at>=v_now-interval '30 minutes';
    if v_count>=3 then v_incident_type:='failed_then_successful_login'; v_incident_severity:=3; end if;
  elsif p_event_type='unauthorized_api' then
    select count(*) into v_count from private.security_events e where e.event_type='unauthorized_api' and e.occurred_at>=v_now-interval '15 minutes' and (v_ip_hash is null or e.ip_hash=v_ip_hash);
    if v_count>=5 then v_incident_type:='unauthorized_api_activity'; v_incident_severity:=case when v_count>=15 then 4 else 3 end; end if;
  elsif p_event_type='rate_limited' then
    select count(*) into v_count from private.security_events e where e.event_type='rate_limited' and e.occurred_at>=v_now-interval '15 minutes' and (v_ip_hash is null or e.ip_hash=v_ip_hash);
    if v_count>=3 then v_incident_type:='rate_limit_abuse'; v_incident_severity:=2; end if;
  end if;
  if v_incident_type is not null then
    select i.id,i.reference,i.student_notified_at into v_incident_id,v_reference,v_existing_notified from private.security_incidents i where i.status in ('open','reviewing') and i.incident_type=v_incident_type and i.user_id is not distinct from p_user_id and i.source_ip_hash is not distinct from v_ip_hash and i.last_seen_at>=v_now-interval '24 hours' order by i.last_seen_at desc limit 1 for update;
    if v_incident_id is null then
      v_incident_id:=gen_random_uuid(); v_reference:='AH-SEC-'||to_char(v_now,'YYYYMMDD')||'-'||upper(substr(replace(v_incident_id::text,'-',''),1,6));
      insert into private.security_incidents(id,reference,user_id,incident_type,severity,confidence,first_seen_at,last_seen_at,event_count,source_ip_hash,expires_at) values(v_incident_id,v_reference,p_user_id,v_incident_type,v_incident_severity,case when p_confidence='high' then 'high' else 'medium' end,v_now,v_now,greatest(v_count,1),v_ip_hash,v_now+interval '365 days');
      v_incident_new:=true; v_should_notify:=p_user_id is not null and v_incident_severity>=2;
    else
      update private.security_incidents set last_seen_at=v_now,event_count=greatest(event_count,v_count),severity=greatest(severity,v_incident_severity),updated_at=v_now where id=v_incident_id;
      v_should_notify:=p_user_id is not null and v_existing_notified is null and v_incident_severity>=2;
    end if;
  end if;
  return query select v_event_id,v_incident_id,v_reference,v_incident_new,v_should_notify;
end;
$$;
revoke all on function public.security_ingest_event(text,uuid,text,text,smallint,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.security_ingest_event(text,uuid,text,text,smallint,text,text,text,text,text,jsonb) to service_role;

create or replace function public.security_mark_student_notified(p_incident_id uuid) returns void language sql security definer set search_path=pg_catalog,public,private as $$ update private.security_incidents set student_notified_at=coalesce(student_notified_at,now()),updated_at=now() where id=p_incident_id; $$;
revoke all on function public.security_mark_student_notified(uuid) from public, anon, authenticated;
grant execute on function public.security_mark_student_notified(uuid) to service_role;

create or replace function public.security_user_activity(p_user_id uuid, p_limit integer default 20)
returns table(occurred_at timestamptz,event_type text,severity smallint,country_code text,device_label text,app_version text,incident_reference text,incident_status text)
language sql security definer set search_path=pg_catalog,public,private as $$
  select e.occurred_at,e.event_type,e.severity,e.country_code,e.device_label,e.app_version,i.reference,i.status
  from private.security_events e left join private.security_incidents i on i.user_id=e.user_id and e.occurred_at between i.first_seen_at-interval '1 minute' and i.last_seen_at+interval '1 minute'
  where e.user_id=p_user_id order by e.occurred_at desc limit greatest(1,least(coalesce(p_limit,20),50));
$$;
revoke all on function public.security_user_activity(uuid,integer) from public, anon, authenticated;
grant execute on function public.security_user_activity(uuid,integer) to service_role;

create or replace function public.security_cleanup_expired() returns table(events_deleted bigint,incidents_deleted bigint) language plpgsql security definer set search_path=pg_catalog,private as $$ declare v_events bigint;v_incidents bigint;begin delete from private.security_events where legal_hold=false and expires_at<now();get diagnostics v_events=row_count;delete from private.security_incidents where legal_hold=false and expires_at<now() and status in ('resolved','false_positive');get diagnostics v_incidents=row_count;return query select v_events,v_incidents;end;$$;
revoke all on function public.security_cleanup_expired() from public, anon, authenticated, service_role;
select cron.unschedule(jobid) from cron.job where jobname='academic-hub-security-retention';
select cron.schedule('academic-hub-security-retention','23 3 * * *',$$select public.security_cleanup_expired();$$);

comment on table private.security_events is 'Academic Hub security evidence. Private, least-privilege, time-limited retention; never stores passwords or tokens.';
comment on table private.security_incidents is 'Academic Hub grouped security incidents used for investigation and user/admin alerts.';
