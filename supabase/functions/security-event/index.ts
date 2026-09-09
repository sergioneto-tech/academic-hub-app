import { createClient } from "npm:@supabase/supabase-js@2.95.3";
import webpush from "npm:web-push@3.6.7";

type EventType = "login_success" | "login_failed" | "password_recovery" | "rate_limited";
type Body = { eventType?: EventType; email?: string; deviceLabel?: string; appVersion?: string };
type IngestRow = { event_id?: string; incident_id?: string | null; incident_reference?: string | null; incident_new?: boolean; should_notify?: boolean };
type Subscription = { id:string; endpoint:string; p256dh:string; auth:string };

const allowed = new Set<EventType>(["login_success","login_failed","password_recovery","rate_limited"]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
function requestIp(req: Request) { const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(); return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || forwarded || null; }

async function notifyStudent(db:any, userId:string, incidentId:string, reference:string, deviceLabel:string|null, country:string|null) {
  const eventKey = `security:${reference}`;
  const { data: existing } = await db.from("push_delivery_log").select("id").eq("user_id",userId).eq("event_key",eventKey).limit(1);
  if (existing?.length) return;
  const { data: cfg } = await db.from("push_server_config").select("key,value").in("key",["vapid_public","vapid_private"]);
  const config = Object.fromEntries((cfg ?? []).map((row:any)=>[row.key,row.value]));
  if (!config.vapid_public || !config.vapid_private) return;
  const { data: subscriptions } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id",userId).eq("enabled",true);
  if (!subscriptions?.length) return;
  webpush.setVapidDetails("mailto:sergioneto78@gmail.com", config.vapid_public, config.vapid_private);
  const context = [deviceLabel, country].filter(Boolean).join(" · ");
  const payload = JSON.stringify({ title:"Alerta de segurança da conta", body:`Foram detetadas várias tentativas de acesso à tua conta${context ? ` (${context})` : ""}. Se não foste tu, revê a segurança da conta.`, url:"/#/definicoes?security=1#seguranca-conta", icon:"/academic-hub-icon-v10-192.png", badge:"/academic-hub-notification-badge.png", tag:`academic-hub-security-${reference}`, data:{kind:"security-incident",incidentReference:reference} });
  let sent=false;
  for(const subscription of subscriptions as Subscription[]){try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},payload,{TTL:86400});sent=true;}catch(error:any){if(error?.statusCode===404||error?.statusCode===410)await db.from("push_subscriptions").delete().eq("id",subscription.id);else console.error("security-event push",error?.statusCode??error);}}
  if(sent){await db.from("push_delivery_log").insert({user_id:userId,event_key:eventKey});await db.rpc("security_mark_student_notified",{p_incident_id:incidentId});}
}

export default { async fetch(req: Request) {
  if (req.method !== "POST") return json({ error:"Method not allowed" },405);
  const origin=req.headers.get("origin"); if(origin&&origin!=="https://academichub.sergioneto.pt"&&!origin.startsWith("http://localhost"))return json({error:"Forbidden"},403);
  const supabaseUrl=Deno.env.get("SUPABASE_URL"),serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if(!supabaseUrl||!serviceRole)return json({error:"Server configuration missing"},503);
  let body:Body; try{body=await req.json() as Body;}catch{return json({error:"Invalid body"},400);} const eventType=body.eventType;if(!eventType||!allowed.has(eventType))return json({error:"Invalid event"},400);
  const db=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false}});let userId:string|null=null;let confidence:"medium"|"high"="medium";
  const authHeader=req.headers.get("authorization")||"";const token=authHeader.toLowerCase().startsWith("bearer ")?authHeader.slice(7).trim():"";
  if(eventType==="login_success"){if(!token)return json({error:"Unauthorized"},401);const{data:userData,error:userError}=await db.auth.getUser(token);if(userError||!userData.user?.id)return json({error:"Unauthorized"},401);userId=userData.user.id;confidence="high";}else if(body.email?.trim()){const{data:target}=await db.rpc("security_resolve_user_target",{p_email:body.email.trim().toLowerCase()});const row=Array.isArray(target)?target[0]:target;userId=row?.user_id??null;}
  const ip=requestIp(req);const country=(req.headers.get("cf-ipcountry")||"").trim().toUpperCase();const ua=(req.headers.get("user-agent")||"").slice(0,512);const severity=eventType==="rate_limited"?2:1;
  const{data:ingest,error:ingestError}=await db.rpc("security_ingest_event",{p_event_type:eventType,p_user_id:userId,p_source:"academic_hub_client",p_confidence:confidence,p_severity:severity,p_ip_address:ip,p_country_code:country||null,p_user_agent:ua||null,p_device_label:body.deviceLabel?.slice(0,128)||null,p_app_version:body.appVersion?.slice(0,32)||null,p_metadata:{channel:"app-auth-telemetry"}});if(ingestError){console.error("security-event ingest",ingestError);return json({error:"Event unavailable"},503);}const row:IngestRow=(Array.isArray(ingest)?ingest[0]:ingest)??{};
  if(userId&&row.should_notify&&row.incident_id&&row.incident_reference)await notifyStudent(db,userId,row.incident_id,row.incident_reference,body.deviceLabel?.slice(0,128)||null,country||null);
  return json({ok:true});
}};
