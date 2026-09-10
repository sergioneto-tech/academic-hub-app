-- Native Supabase log correlation for Academic Hub security incidents.
-- Raw logs remain in Supabase; only security evidence required for an incident is retained privately.
alter table private.security_events add column if not exists source_event_key text;
create unique index if not exists security_events_source_event_key_uidx on private.security_events(source_event_key) where source_event_key is not null;

create table if not exists private.security_auth_hints(
  id uuid primary key default gen_random_uuid(), occurred_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check(event_type in('login_failed','rate_limited','password_recovery')),
  ip_hash text not null, metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default(now()+interval '48 hours'));
alter table private.security_auth_hints enable row level security;
alter table private.security_auth_hints force row level security;
revoke all on private.security_auth_hints from public,anon,authenticated;
create index if not exists security_auth_hints_ip_time_idx on private.security_auth_hints(ip_hash,occurred_at desc);
create index if not exists security_auth_hints_user_time_idx on private.security_auth_hints(user_id,occurred_at desc);
create index if not exists security_auth_hints_expiry_idx on private.security_auth_hints(expires_at);

create table if not exists private.security_auth_audit_processed(audit_id uuid primary key,processed_at timestamptz not null default now());
alter table private.security_auth_audit_processed enable row level security;
alter table private.security_auth_audit_processed force row level security;
revoke all on private.security_auth_audit_processed from public,anon,authenticated;

alter table private.security_incidents drop constraint if exists security_incidents_incident_type_check;
alter table private.security_incidents add constraint security_incidents_incident_type_check check(incident_type in('repeated_login_failures','failed_then_successful_login','unauthorized_api_activity','rate_limit_abuse','auth_abuse_unattributed','other'));

create or replace function public.security_record_auth_hint(p_user_id uuid,p_event_type text,p_ip_address text,p_metadata jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare v_ip inet;v_hash text;v_ip_count int;v_user_count int;
begin
 if p_user_id is null or p_event_type not in('login_failed','rate_limited','password_recovery') then return false;end if;
 begin v_ip:=nullif(trim(coalesce(p_ip_address,'')),'')::inet;exception when others then return false;end;
 if v_ip is null then return false;end if;v_hash:=encode(extensions.digest(host(v_ip),'sha256'),'hex');
 select count(*) into v_ip_count from private.security_auth_hints where ip_hash=v_hash and occurred_at>=now()-interval '1 minute';
 select count(*) into v_user_count from private.security_auth_hints where user_id=p_user_id and occurred_at>=now()-interval '1 minute';
 if v_ip_count>=30 or v_user_count>=20 then return false;end if;
 insert into private.security_auth_hints(user_id,event_type,ip_hash,metadata) values(p_user_id,p_event_type,v_hash,coalesce(p_metadata,'{}'::jsonb));return true;
end$$;
revoke all on function public.security_record_auth_hint(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.security_record_auth_hint(uuid,text,text,jsonb) to service_role;

create or replace function public.security_ingest_native_signal(p_signal_key text,p_kind text,p_ip_address text,p_country_code text,p_path text,p_status integer,p_hits integer,p_first_seen timestamptz,p_last_seen timestamptz,p_client_info text default null)
returns table(processed boolean,incident_id uuid,incident_reference text,incident_new boolean,matched_user_id uuid,severity smallint)
language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare v_ip inet;v_hash text;v_user uuid;v_users int;v_event text;v_source text;v_type text;v_threshold int;v_sev smallint;v_event_id uuid;v_auto uuid;v_existing uuid;v_ref text;v_old_count int;v_inc uuid;v_new boolean:=false;v_now timestamptz:=now();
begin
 if p_signal_key is null or length(p_signal_key)<16 or length(p_signal_key)>160 then raise exception 'invalid signal key';end if;
 if p_kind not in('auth_failure','auth_rate_limited','unauthorized_api','api_rate_limited') then raise exception 'invalid native signal kind';end if;
 if p_hits is null or p_hits<1 or p_hits>100000 or p_first_seen is null or p_last_seen is null or p_last_seen<p_first_seen then raise exception 'invalid signal';end if;
 if exists(select 1 from private.security_events where source_event_key=p_signal_key) then return query select false,null::uuid,null::text,false,null::uuid,1::smallint;return;end if;
 begin v_ip:=nullif(trim(coalesce(p_ip_address,'')),'')::inet;exception when others then v_ip:=null;end;if v_ip is not null then v_hash:=encode(extensions.digest(host(v_ip),'sha256'),'hex');end if;
 if p_kind in('auth_failure','auth_rate_limited') and v_hash is not null then select count(distinct user_id),min(user_id::text)::uuid into v_users,v_user from private.security_auth_hints where ip_hash=v_hash and occurred_at between p_first_seen-interval '5 minutes' and p_last_seen+interval '5 minutes' and event_type in('login_failed','rate_limited');if coalesce(v_users,0)<>1 then v_user:=null;end if;end if;
 if p_kind='auth_failure' then v_event:='login_failed';v_source:='supabase_auth';v_type:=case when v_user is null then 'auth_abuse_unattributed' else 'repeated_login_failures' end;v_threshold:=5;v_sev:=case when p_hits>=15 then 3 else 2 end;
 elsif p_kind='auth_rate_limited' then v_event:='rate_limited';v_source:='supabase_auth';v_type:=case when v_user is null then 'auth_abuse_unattributed' else 'rate_limit_abuse' end;v_threshold:=1;v_sev:=case when p_hits>=5 then 3 else 2 end;
 elsif p_kind='unauthorized_api' then v_event:='unauthorized_api';v_source:='supabase_api';v_type:='unauthorized_api_activity';v_threshold:=8;v_sev:=case when p_hits>=20 then 4 else 3 end;
 else v_event:='rate_limited';v_source:='supabase_api';v_type:='rate_limit_abuse';v_threshold:=3;v_sev:=case when p_hits>=10 then 3 else 2 end;end if;
 if p_hits<v_threshold then return query select false,null::uuid,null::text,false,v_user,v_sev;return;end if;
 select id,reference,event_count into v_existing,v_ref,v_old_count from private.security_incidents where status in('open','reviewing') and incident_type=v_type and user_id is not distinct from v_user and source_ip_hash is not distinct from v_hash and last_seen_at>=v_now-interval '24 hours' order by last_seen_at desc limit 1 for update;
 select x.event_id,x.incident_id into v_event_id,v_auto from public.security_ingest_event(p_event_type=>v_event,p_user_id=>v_user,p_source=>v_source,p_confidence=>'high',p_severity=>v_sev,p_ip_address=>case when v_ip is null then null else host(v_ip) end,p_country_code=>nullif(upper(left(trim(coalesce(p_country_code,'')),2)),''),p_user_agent=>null,p_device_label=>nullif(left(trim(coalesce(p_client_info,'')),128),''),p_app_version=>null,p_metadata=>jsonb_build_object('channel','supabase-native-log-watch','signal_key',p_signal_key,'path',left(coalesce(p_path,''),256),'status',p_status,'hits',p_hits,'first_seen',p_first_seen,'last_seen',p_last_seen)) x;
 update private.security_events set source_event_key=p_signal_key where id=v_event_id;
 if v_existing is not null then v_inc:=v_existing;update private.security_incidents set last_seen_at=greatest(last_seen_at,p_last_seen),event_count=coalesce(v_old_count,0)+p_hits,severity=greatest(severity,v_sev),confidence='high',updated_at=v_now where id=v_existing;
 elsif v_auto is not null then v_inc:=v_auto;select reference into v_ref from private.security_incidents where id=v_inc;update private.security_incidents set first_seen_at=least(first_seen_at,p_first_seen),last_seen_at=greatest(last_seen_at,p_last_seen),event_count=p_hits,severity=greatest(severity,v_sev),confidence='high',updated_at=v_now where id=v_inc;v_new:=true;
 else v_inc:=gen_random_uuid();v_ref:='AH-SEC-'||to_char(v_now,'YYYYMMDD')||'-'||upper(substr(replace(v_inc::text,'-',''),1,6));insert into private.security_incidents(id,reference,user_id,incident_type,status,severity,confidence,first_seen_at,last_seen_at,event_count,source_ip_hash,expires_at) values(v_inc,v_ref,v_user,v_type,'open',v_sev,'high',p_first_seen,p_last_seen,p_hits,v_hash,v_now+interval '365 days');v_new:=true;end if;
 return query select true,v_inc,v_ref,v_new,v_user,v_sev;
end$$;
revoke all on function public.security_ingest_native_signal(text,text,text,text,text,integer,integer,timestamptz,timestamptz,text) from public,anon,authenticated;
grant execute on function public.security_ingest_native_signal(text,text,text,text,text,integer,integer,timestamptz,timestamptz,text) to service_role;

create or replace function public.security_incident_notification_payload(p_incident_id uuid) returns table(incident_id uuid,reference text,user_id uuid,incident_type text,severity smallint,confidence text,first_seen_at timestamptz,last_seen_at timestamptz,event_count integer,student_notified_at timestamptz,admin_notified_at timestamptz) language sql security definer set search_path=pg_catalog,private as $$select id,reference,user_id,incident_type,severity,confidence,first_seen_at,last_seen_at,event_count,student_notified_at,admin_notified_at from private.security_incidents where id=p_incident_id$$;
revoke all on function public.security_incident_notification_payload(uuid) from public,anon,authenticated;grant execute on function public.security_incident_notification_payload(uuid) to service_role;
create or replace function public.security_mark_admin_notified(p_incident_id uuid) returns void language sql security definer set search_path=pg_catalog,private as $$update private.security_incidents set admin_notified_at=coalesce(admin_notified_at,now()),updated_at=now() where id=p_incident_id$$;
revoke all on function public.security_mark_admin_notified(uuid) from public,anon,authenticated;grant execute on function public.security_mark_admin_notified(uuid) to service_role;

create or replace function private.dispatch_security_incident_push() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private,net as $$declare s text;begin select value into s from public.push_server_config where key='cron_secret';if s is null then return new;end if;begin perform net.http_post(url:='https://apgoyzfzuukkpmuxiqvy.supabase.co/functions/v1/security-incident-push',headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',s),body:=jsonb_build_object('incidentId',new.id),timeout_milliseconds:=10000);exception when others then raise warning 'security incident push dispatch failed: %',sqlerrm;end;return new;end$$;
revoke execute on function private.dispatch_security_incident_push() from public,anon,authenticated;
drop trigger if exists dispatch_security_incident_push on private.security_incidents;create trigger dispatch_security_incident_push after insert on private.security_incidents for each row execute function private.dispatch_security_incident_push();

create or replace function public.security_import_auth_audit_logs() returns integer language plpgsql security definer set search_path=pg_catalog,public,private,auth,extensions as $$declare r record;a text;u uuid;ip text;h text;e text;eid uuid;n int;done int:=0;begin for r in select x.id,x.payload,x.created_at,x.ip_address from auth.audit_log_entries x left join private.security_auth_audit_processed p on p.audit_id=x.id where p.audit_id is null and x.created_at>=now()-interval '2 days' order by x.created_at limit 200 loop a:=coalesce(r.payload->>'action','');u:=null;begin if coalesce(r.payload->>'user_id',r.payload->>'actor_id','')~*'^[0-9a-f-]{36}$' then u:=coalesce(r.payload->>'user_id',r.payload->>'actor_id')::uuid;end if;exception when others then u:=null;end;ip:=nullif(trim(coalesce(r.ip_address,'')),'');h:=null;if ip is not null then begin h:=encode(extensions.digest(host(ip::inet),'sha256'),'hex');exception when others then h:=null;end;end if;e:=case when a='login' then 'login_success' when a='user_recovery_requested' then 'password_recovery' when a='token_revoked' then 'session_revoked' else null end;if e is not null and u is not null then if e='login_success' then select count(*) into n from private.security_events where user_id=u and event_type='login_success' and occurred_at between r.created_at-interval '2 minutes' and r.created_at+interval '2 minutes' and(h is null or ip_hash=h);else n:=0;end if;if n=0 then select x.event_id into eid from public.security_ingest_event(p_event_type=>e,p_user_id=>u,p_source=>'supabase_auth',p_confidence=>'high',p_severity=>1,p_ip_address=>ip,p_country_code=>null,p_user_agent=>null,p_device_label=>'Supabase Auth',p_app_version=>null,p_metadata=>jsonb_build_object('channel','supabase-auth-audit','action',a,'audit_id',r.id)) x;update private.security_events set source_event_key='auth-audit:'||r.id::text where id=eid;end if;end if;insert into private.security_auth_audit_processed(audit_id) values(r.id) on conflict do nothing;done:=done+1;end loop;return done;end$$;
revoke all on function public.security_import_auth_audit_logs() from public,anon,authenticated,service_role;
create or replace function public.security_cleanup_native_monitor() returns void language plpgsql security definer set search_path=pg_catalog,private as $$begin delete from private.security_auth_hints where expires_at<now();delete from private.security_auth_audit_processed where processed_at<now()-interval '30 days';end$$;
revoke all on function public.security_cleanup_native_monitor() from public,anon,authenticated,service_role;
select cron.unschedule(jobid) from cron.job where jobname='academic-hub-auth-audit-import';select cron.schedule('academic-hub-auth-audit-import','*/5 * * * *',$$select public.security_import_auth_audit_logs();$$);
select cron.unschedule(jobid) from cron.job where jobname='academic-hub-security-native-cleanup';select cron.schedule('academic-hub-security-native-cleanup','41 3 * * *',$$select public.security_cleanup_native_monitor();$$);
