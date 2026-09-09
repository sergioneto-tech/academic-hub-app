import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import webpush from "npm:web-push@3.6.7";

type EventType = "login_success" | "login_failed" | "password_recovery" | "rate_limited";
type Body = { eventType?: EventType; email?: string; deviceLabel?: string; appVersion?: string };
type IngestRow = { event_id?: string; incident_id?: string | null; incident_reference?: string | null; incident_new?: boolean; should_notify?: boolean };
type Subscription = { id:string; endpoint:string; p256dh:string; auth:string };
type QuickCheck = { blocking_findings?: number; checked_at?: string; [key:string]: unknown };

const allowed = new Set<EventType>(["login_success","login_failed","password_recovery","rate_limited"]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
function requestIp(req: Request) { const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(); return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || forwarded || null; }

async function loadPushConfig(db:any) {
  const { data } = await db.from("push_server_config").select("key,value").in("key",["vapid_public","vapid_private","security_manager_user_id"]);
  return Object.fromEntries((data ?? []).map((row:any)=>[row.key,row.value]));
}

async function sendUserPush(db:any, userId:string, eventKey:string, payload:Record<string,unknown>, config:any) {
  const { data: existing } = await db.from("push_delivery_log").select("id").eq("user_id",userId).eq("event_key",eventKey).limit(1);
  if (existing?.length || !config.vapid_public || !config.vapid_private) return false;
  const { data: subscriptions } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id",userId).eq("enabled",true);
  if (!subscriptions?.length) return false;
  webpush.setVapidDetails("mailto:sergioneto78@gmail.com", config.vapid_public, config.vapid_private);
  let sent=false;
  const encoded=JSON.stringify(payload);
  for(const subscription of subscriptions as Subscription[]){
    try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},encoded,{TTL:86400});sent=true;}
    catch(error:any){if(error?.statusCode===404||error?.statusCode===410)await db.from("push_subscriptions").delete().eq("id",subscription.id);else console.error("security-event push",error?.statusCode??error);}
  }
  if(sent)await db.from("push_delivery_log").insert({user_id:userId,event_key:eventKey});
  return sent;
}

async function notifyStudent(db:any,userId:string,incidentId:string,reference:string,deviceLabel:string|null,country:string|null,config:any){
  const context=[deviceLabel,country].filter(Boolean).join(" · ");
  const sent=await sendUserPush(db,userId,`security:${reference}`,{
    title:"Alerta de segurança da conta",
    body:`Foram detetadas várias tentativas de acesso à tua conta${context?` (${context})`:""}. Se não foste tu, revê a segurança da conta.`,
    url:"/#/definicoes?security=1#seguranca-conta",icon:"/academic-hub-icon-v10-192.png",badge:"/academic-hub-notification-badge.png",tag:`academic-hub-security-${reference}`,data:{kind:"security-incident",incidentReference:reference}
  },config);
  if(sent)await db.rpc("security_mark_student_notified",{p_incident_id:incidentId});
}

async function notifyManager(db:any,reference:string,quick:QuickCheck,config:any){
  const managerId=String(config.security_manager_user_id||"").trim();if(!managerId)return;
  const findings=Number(quick?.blocking_findings??0);
  const critical=findings>0;
  await sendUserPush(db,managerId,`security-admin:${reference}`,{
    title:critical?"Incidente + desvio de segurança":"Novo incidente de segurança",
    body:critical?`${reference}: a mini-vistoria encontrou ${findings} desvio(s) crítico(s). Verifica o Academic Hub.`:`${reference}: incidente registado. A mini-vistoria imediata não encontrou desvios estruturais críticos.`,
    url:"/#/definicoes?securityAdmin=1#seguranca-conta",icon:"/academic-hub-icon-v10-192.png",badge:"/academic-hub-notification-badge.png",tag:`academic-hub-security-admin-${reference}`,data:{kind:"security-admin-incident",incidentReference:reference,blockingFindings:findings}
  },config);
}

export default { async fetch(req: Request) {
  if (req.method !== "POST") return json({ error:"Method not allowed" },405);
  const origin=req.headers.get("origin");if(origin&&origin!=="https://academichub.sergioneto.pt"&&!origin.startsWith("http://localhost"))return json({error:"Forbidden"},403);
  const supabaseUrl=Deno.env.get("SUPABASE_URL"),serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!supabaseUrl||!serviceRole)return json({error:"Server configuration missing"},503);
  let body:Body;try{body=await req.json() as Body;}catch{return json({error:"Invalid body"},400);}const eventType=body.eventType;if(!eventType||!allowed.has(eventType))return json({error:"Invalid event"},400);
  const db=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false}});let userId:string|null=null;let confidence:"medium"|"high"="medium";
  const authHeader=req.headers.get("authorization")||"";const token=authHeader.toLowerCase().startsWith("bearer ")?authHeader.slice(7).trim():"";
  if(eventType==="login_success"){if(!token)return json({error:"Unauthorized"},401);const{data:userData,error:userError}=await db.auth.getUser(token);if(userError||!userData.user?.id)return json({error:"Unauthorized"},401);userId=userData.user.id;confidence="high";}else if(body.email?.trim()){const{data:target}=await db.rpc("security_resolve_user_target",{p_email:body.email.trim().toLowerCase()});const row=Array.isArray(target)?target[0]:target;userId=row?.user_id??null;}
  const ip=requestIp(req);const country=(req.headers.get("cf-ipcountry")||"").trim().toUpperCase();const ua=(req.headers.get("user-agent")||"").slice(0,512);const severity=eventType==="rate_limited"?2:1;
  const{data:ingest,error:ingestError}=await db.rpc("security_ingest_event",{p_event_type:eventType,p_user_id:userId,p_source:"academic_hub_client",p_confidence:confidence,p_severity:severity,p_ip_address:ip,p_country_code:country||null,p_user_agent:ua||null,p_device_label:body.deviceLabel?.slice(0,128)||null,p_app_version:body.appVersion?.slice(0,32)||null,p_metadata:{channel:"app-auth-telemetry"}});if(ingestError){console.error("security-event ingest",ingestError);return json({error:"Event unavailable"},503);}const row:IngestRow=(Array.isArray(ingest)?ingest[0]:ingest)??{};
  const config=await loadPushConfig(db);
  if(userId&&row.should_notify&&row.incident_id&&row.incident_reference)await notifyStudent(db,userId,row.incident_id,row.incident_reference,body.deviceLabel?.slice(0,128)||null,country||null,config);
  if(row.incident_new&&row.incident_reference){
    const{data:quickData,error:quickError}=await db.rpc("security_quick_integrity_check");
    const quick:QuickCheck=quickError?{blocking_findings:-1,error:"quick-check-unavailable"}:((quickData??{}) as QuickCheck);
    if(!quickError&&Number(quick.blocking_findings??0)>0){
      await db.rpc("security_ingest_event",{p_event_type:"security_action",p_user_id:null,p_source:"security_watch",p_confidence:"high",p_severity:4,p_ip_address:null,p_country_code:null,p_user_agent:null,p_device_label:"incident quick integrity check",p_app_version:body.appVersion?.slice(0,32)||null,p_metadata:{incident_reference:row.incident_reference,quick_check:quick}});
    }
    await notifyManager(db,row.incident_reference,quick,config);
  }
  return json({ok:true});
}};
