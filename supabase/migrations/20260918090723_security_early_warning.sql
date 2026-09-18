-- Early warning layer for repeated authentication failures.
-- Three failures in 15 minutes become a low-severity observation visible to the administrator.
-- Student-facing alerts remain reserved for severity >= 2.

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
language plpgsql security definer
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
    if v_count>=3 then v_incident_type:='repeated_login_failures'; v_incident_severity:=case when v_count>=10 then 3 when v_count>=5 then 2 else 1 end; end if;
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
      v_incident_new:=true; v_should_notify:=p_user_id is not null;
    else
      update private.security_incidents set last_seen_at=v_now,event_count=greatest(event_count,v_count),severity=greatest(severity,v_incident_severity),updated_at=v_now where id=v_incident_id;
      v_should_notify:=p_user_id is not null and v_existing_notified is null;
    end if;
  end if;
  return query select v_event_id,v_incident_id,v_reference,v_incident_new,v_should_notify;
end;
$$;
revoke all on function public.security_ingest_event(text,uuid,text,text,smallint,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.security_ingest_event(text,uuid,text,text,smallint,text,text,text,text,text,jsonb) to service_role;
