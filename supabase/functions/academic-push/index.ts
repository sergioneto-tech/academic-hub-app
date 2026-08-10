import { createClient } from "supabase";
import webpush from "web-push";

type Pref = { user_id:string; deadlines_enabled:boolean; exams_enabled:boolean; uab_enabled:boolean; efinal_lead_days:number; exam_lead_days:number; uab_lead_days:number; timezone:string };
type Sub = { id:string; user_id:string; endpoint:string; p256dh:string; auth:string; enabled:boolean };
type Due = { key:string; title:string; body:string; url:string };
type UabPeriod = { id:string; label:string; open:string; close:string };
type Slot = { status:string; dateTime:string|null };
type OfficialEntry = { code:string; continuousNormal:Slot; continuousResit:Slot; examNormal:Slot; examResit:Slot };

const CORS_HEADERS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const jsonResponse=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS_HEADERS,"Content-Type":"application/json"}});
const UAB_URL="https://portal.uab.pt/calendario-letivo/";

function ymdInZone(date:Date,timeZone:string){const parts=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);const get=(t:string)=>parts.find(p=>p.type===t)?.value??"";return `${get("year")}-${get("month")}-${get("day")}`;}
function parseYmd(v:string){const[y,m,d]=v.slice(0,10).split("-").map(Number);return Date.UTC(y,m-1,d);}
function daysBetween(a:string,b:string){return Math.round((parseYmd(b)-parseYmd(a))/86400000);}
function timePart(v?:string){return v?.includes("T")?v.slice(11,16):"";}
function roundGrade(v:number){return Math.floor(v+0.5);}
function activeCourses(state:any){return (state.courses??[]).filter((c:any)=>c.isActive&&!c.isCompleted);}
function courseLabel(course:any){return course?`${course.code} — ${course.name}`:"Cadeira";}
function assessmentsFor(state:any,courseId:string){return (state.assessments??[]).filter((a:any)=>a.courseId===courseId);}
function validGrade(a:any){return typeof a?.grade==="number"&&Number.isFinite(a.grade);}
function max(a:any){return Math.max(0,Number(a?.maxPoints)||0);}
function grade(a:any){return validGrade(a)?Math.max(0,Math.min(Number(a.grade),max(a))):0;}
function total(items:any[],selector:(a:any)=>number){return items.reduce((sum,a)=>sum+selector(a),0);}

function extractUabPeriods(rows:any[]):UabPeriod[]{const periods:UabPeriod[]=[];for(const row of rows??[]){const year=row?.payload?.academicYear??row?.academic_year??"";for(const event of Array.isArray(row?.payload?.events)?row.payload.events:[]){if(event?.id!=="matriculas-1sem"&&event?.id!=="matriculas-2sem")continue;if(typeof event.startDate!=="string"||typeof event.endDate!=="string")continue;const semester=event.id==="matriculas-1sem"?"1.º":"2.º";periods.push({id:`${year}:${event.id}`,label:`Inscrições do ${semester} semestre`,open:event.startDate.slice(0,10),close:event.endDate.slice(0,10)});}}return periods;}

function buildScheduleMap(rows:any[]){const map=new Map<string,OfficialEntry>();for(const row of rows??[]){const semester=Number(row?.semester);for(const entry of row?.payload?.entries??[]){if(entry?.code)map.set(`${semester}:${String(entry.code).trim()}`,entry as OfficialEntry);}}return map;}
function officialDate(course:any,type:"exam"|"resit",schedule:Map<string,OfficialEntry>,fallback?:string){const entry=schedule.get(`${course?.semester}:${String(course?.code??"").trim()}`);if(!entry)return fallback;const examPath=course?.evaluationModel==="exam-only"||(course?.evaluationRegime==="legacy"&&course?.legacyEvaluationMode==="exam-only");const slot=type==="exam"?(examPath?entry.examNormal:entry.continuousNormal):(examPath?entry.examResit:entry.continuousResit);if(slot?.status==="scheduled"&&slot.dateTime)return slot.dateTime;return undefined;}

function needsOfficialResit(state:any,course:any){
  const items=assessmentsFor(state,course.id);const resource=items.find((a:any)=>a.type==="resit");if(resource&&validGrade(resource))return false;
  if(course.evaluationRegime==="regulation-2026"){
    const model=course.evaluationModel??"custom";if(model==="custom")return false;
    const required=items.filter((a:any)=>a.type!=="resit"&&a.type!=="special"&&a.required!==false);if(!required.length||required.some((a:any)=>!validGrade(a)))return false;
    if(model==="exam-only"){const exam=required.find((a:any)=>a.type==="exam");return Boolean(exam)&&roundGrade(grade(exam))<10;}
    const raw=total(required,grade);if(model==="type1"||model==="type4"){
      const async=required.filter((a:any)=>a.mode==="asynchronous"),sync=required.filter((a:any)=>a.mode==="synchronous");const am=total(async,max),sm=total(sync,max);if(am<=0||sm<=0)return false;const asyncMet=(total(async,grade)/am)*100>=50;const syncMet=(total(sync,grade)/sm)*100>=50;return !(asyncMet&&syncMet&&roundGrade(raw)>=10);
    }
    if(model==="type2"){
      const met=required.filter((a:any)=>max(a)>0&&(grade(a)/max(a))*100>=40).length;
      const oralMet=required.filter((a:any)=>a.mode==="synchronous").every((a:any)=>max(a)>0&&(grade(a)/max(a))*100>=(Number(a.minimumPercent)||50));
      return !(met>=Math.max(0,required.length-1)&&oralMet&&roundGrade(raw)>=10);
    }
    if(model==="type3"){const met=required.filter((a:any)=>max(a)>0&&(grade(a)/max(a))*100>=40).length;return !(met>=Math.max(0,required.length-1)&&roundGrade(raw)>=10);}
    return false;
  }
  const exam=items.find((a:any)=>a.type==="exam");if(!exam||!validGrade(exam))return false;const efolios=items.filter((a:any)=>a.type==="efolio");const ef=total(efolios,grade);const rules=(state.rules??[]).find((r:any)=>r.courseId===course.id)??{};return ef<(rules.minAptoExame??3.5)||grade(exam)<(rules.minExame??5.5)||roundGrade(ef+grade(exam))<10;
}

function buildDue(state:any,pref:Pref,now:Date,uabPeriods:UabPeriod[],schedule:Map<string,OfficialEntry>):Due[]{
  const today=ymdInZone(now,pref.timezone||"Europe/Lisbon"),due:Due[]=[];const courses=activeCourses(state),courseMap=new Map(courses.map((c:any)=>[c.id,c]));
  for(const a of state.assessments??[]){const course=courseMap.get(a.courseId);if(!course)continue;const label=courseLabel(course);
    if(a.type==="efolio"&&pref.deadlines_enabled){if(a.startDate?.slice(0,10)===today)due.push({key:`efolio:${a.id}:start:${today}`,title:`${a.name} começa hoje`,body:label,url:"/#/calendario"});if(a.endDate){const end=a.endDate.slice(0,10),left=daysBetween(today,end);if(left===pref.efinal_lead_days)due.push({key:`efolio:${a.id}:end-lead:${end}:${left}`,title:`${a.name}: faltam ${left} dias`,body:`Prazo de entrega · ${label}`,url:"/#/calendario"});if(left===0)due.push({key:`efolio:${a.id}:end:${end}`,title:`${a.name} termina hoje`,body:`Último dia para entrega · ${label}`,url:"/#/calendario"});}}
    if((a.type==="exam"||a.type==="resit")&&pref.exams_enabled){if(a.type==="resit"&&!needsOfficialResit(state,course))continue;const date=officialDate(course,a.type,schedule,a.date);if(!date)continue;const day=date.slice(0,10),left=daysBetween(today,day),hour=timePart(date),kind=a.type==="resit"?"Recurso":"Prova";if(left===pref.exam_lead_days)due.push({key:`${a.type}:${course.code}:lead:${day}:${left}`,title:`${kind} daqui a ${left} dias`,body:`${label}${hour?` · ${hour}`:""}`,url:"/#/calendario"});if(left===0)due.push({key:`${a.type}:${course.code}:day:${day}`,title:`${kind} hoje${hour?` às ${hour}`:""}`,body:label,url:"/#/calendario"});}
  }
  if(pref.uab_enabled){for(const p of uabPeriods){const openLeft=daysBetween(today,p.open),closeLeft=daysBetween(today,p.close);if(openLeft===pref.uab_lead_days)due.push({key:`uab:${p.id}:open-lead:${openLeft}`,title:`${p.label} abrem em ${openLeft} dias`,body:"Universidade Aberta",url:UAB_URL});if(openLeft===0)due.push({key:`uab:${p.id}:open`,title:`${p.label} abrem hoje`,body:"Consulta o calendário oficial da UAb.",url:UAB_URL});if(closeLeft===pref.uab_lead_days)due.push({key:`uab:${p.id}:close-lead:${closeLeft}`,title:`${p.label}: faltam ${closeLeft} dias`,body:"Prazo de inscrição a terminar.",url:UAB_URL});if(closeLeft===0)due.push({key:`uab:${p.id}:close`,title:`Último dia — ${p.label}`,body:"Confirma a inscrição no portal da UAb.",url:UAB_URL});}}
  return due;
}

export default{async fetch(req:Request){
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS_HEADERS});if(req.method!=="POST")return jsonResponse({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,db=createClient(url,service,{auth:{persistSession:false}});const{data:cfg}=await db.from("push_server_config").select("key,value").in("key",["vapid_public","vapid_private","cron_secret"]);const config=Object.fromEntries((cfg??[]).map((r:any)=>[r.key,r.value]));if(!config.vapid_public||!config.vapid_private)return jsonResponse({error:"Push not configured"},503);webpush.setVapidDetails("mailto:sergioneto78@gmail.com",config.vapid_public,config.vapid_private);
  const cronOk=req.headers.get("x-cron-secret")===config.cron_secret,auth=req.headers.get("authorization")??"";let onlyUser:string|null=null;if(!cronOk){if(!auth.startsWith("Bearer "))return jsonResponse({error:"Unauthorized"},401);const{data}=await db.auth.getUser(auth.slice(7));onlyUser=data.user?.id??null;if(!onlyUser)return jsonResponse({error:"Unauthorized"},401);}
  const body=await req.json().catch(()=>({})),targetEndpoint=body.mode==="test"&&typeof body.targetEndpoint==="string"?body.targetEndpoint:null;let prefQ=db.from("push_preferences").select("*");if(onlyUser)prefQ=prefQ.eq("user_id",onlyUser);const{data:prefs}=await prefQ;if(!prefs?.length)return jsonResponse({sent:0});const ids=prefs.map((p:any)=>p.user_id);
  const[{data:states},{data:subs},{data:logs},{data:calendarRows},{data:examRows}]=await Promise.all([db.from("user_state").select("user_id,state").in("user_id",ids),db.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth,enabled").in("user_id",ids).eq("enabled",true),db.from("push_delivery_log").select("user_id,event_key").in("user_id",ids),db.from("uab_academic_calendars").select("academic_year,payload").eq("is_valid",true).order("academic_year",{ascending:false}).limit(2),db.from("uab_exam_schedules").select("semester,payload").eq("academic_year","2026/2027").eq("is_valid",true)]);
  const stateMap=new Map((states??[]).map((r:any)=>[r.user_id,r.state])),sentKeys=new Set((logs??[]).map((r:any)=>`${r.user_id}|${r.event_key}`)),uabPeriods=extractUabPeriods(calendarRows??[]),schedule=buildScheduleMap(examRows??[]);let sent=0;
  for(const pref of prefs as Pref[]){let userSubs=(subs??[]).filter((s:any)=>s.user_id===pref.user_id)as Sub[];if(body.mode==="test"&&onlyUser===pref.user_id&&targetEndpoint)userSubs=userSubs.filter(s=>s.endpoint===targetEndpoint);if(!userSubs.length)continue;const events=body.mode==="test"&&onlyUser===pref.user_id?[{key:`test:${Date.now()}`,title:"Academic Hub",body:"Notificações ativadas com sucesso neste dispositivo.",url:"/#/definicoes"}]:buildDue(stateMap.get(pref.user_id)??{},pref,new Date(),uabPeriods,schedule);for(const event of events){if(body.mode!=="test"&&sentKeys.has(`${pref.user_id}|${event.key}`))continue;let ok=false;const payload=JSON.stringify({title:event.title,body:event.body,url:event.url,icon:"/academic-hub-icon-v10-192.png",badge:"/academic-hub-notification-badge.png"});for(const s of userSubs){try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload,{TTL:86400});ok=true;sent++;}catch(err:any){if(err?.statusCode===404||err?.statusCode===410)await db.from("push_subscriptions").delete().eq("id",s.id);else console.error("push",err?.statusCode??err);}}if(ok&&body.mode!=="test")await db.from("push_delivery_log").insert({user_id:pref.user_id,event_key:event.key});}}
  return jsonResponse({sent});
}};
