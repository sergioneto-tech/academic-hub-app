import { createClient } from "supabase";
import webpush from "web-push";

type Pref = { user_id:string; deadlines_enabled:boolean; exams_enabled:boolean; uab_enabled:boolean; efinal_lead_days:number; exam_lead_days:number; uab_lead_days:number; timezone:string };
type Sub = { id:string; user_id:string; endpoint:string; p256dh:string; auth:string; enabled:boolean };
type Due = { key:string; title:string; body:string; url:string };

const UAB_URL = "https://portal.uab.pt/calendario-letivo/";
const UAB_PERIODS = [
  { id:"2026-s1", label:"Inscrições do 1.º semestre", open:"2026-08-18", close:"2026-09-01" },
  { id:"2026-s2", label:"Inscrições do 2.º semestre", open:"2026-11-17", close:"2026-12-01" },
];

function ymdInZone(date:Date, timeZone:string){
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(date);
  const get=(t:string)=>parts.find(p=>p.type===t)?.value??"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function parseYmd(v:string){ const [y,m,d]=v.slice(0,10).split("-").map(Number); return Date.UTC(y,m-1,d); }
function daysBetween(a:string,b:string){ return Math.round((parseYmd(b)-parseYmd(a))/86400000); }
function timePart(v?:string){ return v?.includes("T") ? v.slice(11,16) : ""; }
function courseLabel(state:any, courseId:string){ const c=(state.courses??[]).find((x:any)=>x.id===courseId); return c?`${c.code} — ${c.name}`:"Cadeira"; }
function activeIds(state:any){ return new Set((state.courses??[]).filter((c:any)=>c.isActive&&!c.isCompleted).map((c:any)=>c.id)); }

function buildDue(state:any,pref:Pref,now:Date):Due[]{
  const today=ymdInZone(now,pref.timezone||"Europe/Lisbon"), due:Due[]=[];
  const active=activeIds(state);
  for(const a of state.assessments??[]){
    if(!active.has(a.courseId)) continue;
    const course=courseLabel(state,a.courseId);
    if(a.type==="efolio" && pref.deadlines_enabled){
      if(a.startDate?.slice(0,10)===today) due.push({key:`efolio:${a.id}:start:${today}`,title:`${a.name} começa hoje`,body:course,url:"/#/calendario"});
      if(a.endDate){
        const end=a.endDate.slice(0,10), left=daysBetween(today,end);
        if(left===pref.efinal_lead_days) due.push({key:`efolio:${a.id}:end-lead:${end}:${left}`,title:`${a.name}: faltam ${left} dias`,body:`Prazo de entrega · ${course}`,url:"/#/calendario"});
        if(left===0) due.push({key:`efolio:${a.id}:end:${end}`,title:`${a.name} termina hoje`,body:`Último dia para entrega · ${course}`,url:"/#/calendario"});
      }
    }
    if((a.type==="exam"||a.type==="resit") && pref.exams_enabled && a.date){
      const day=a.date.slice(0,10), left=daysBetween(today,day), hour=timePart(a.date), label=a.type==="resit"?"Recurso":"Exame";
      if(left===pref.exam_lead_days) due.push({key:`${a.type}:${a.id}:lead:${day}:${left}`,title:`${label} daqui a ${left} dias`,body:`${course}${hour?` · ${hour}`:""}`,url:"/#/calendario"});
      if(left===0) due.push({key:`${a.type}:${a.id}:day:${day}`,title:`${label} hoje${hour?` às ${hour}`:""}`,body:course,url:"/#/calendario"});
    }
  }
  if(pref.uab_enabled){
    for(const p of UAB_PERIODS){
      const openLeft=daysBetween(today,p.open), closeLeft=daysBetween(today,p.close);
      if(openLeft===pref.uab_lead_days) due.push({key:`uab:${p.id}:open-lead:${openLeft}`,title:`${p.label} abrem em ${openLeft} dias`,body:"Universidade Aberta",url:UAB_URL});
      if(openLeft===0) due.push({key:`uab:${p.id}:open`,title:`${p.label} abrem hoje`,body:"Consulta o calendário oficial da UAb.",url:UAB_URL});
      if(closeLeft===pref.uab_lead_days) due.push({key:`uab:${p.id}:close-lead:${closeLeft}`,title:`${p.label}: faltam ${closeLeft} dias`,body:"Prazo de inscrição a terminar.",url:UAB_URL});
      if(closeLeft===0) due.push({key:`uab:${p.id}:close`,title:`Último dia — ${p.label}`,body:"Confirma a inscrição no portal da UAb.",url:UAB_URL});
    }
  }
  return due;
}

export default {
  async fetch(req:Request){
    const url=Deno.env.get("SUPABASE_URL")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db=createClient(url,service,{auth:{persistSession:false}});
    const {data:cfg}=await db.from("push_server_config").select("key,value").in("key",["vapid_public","vapid_private","cron_secret"]);
    const config=Object.fromEntries((cfg??[]).map((r:any)=>[r.key,r.value]));
    if(!config.vapid_public||!config.vapid_private) return new Response("Push not configured",{status:503});
    webpush.setVapidDetails("mailto:sergioneto78@gmail.com",config.vapid_public,config.vapid_private);
    const cronOk=req.headers.get("x-cron-secret")===config.cron_secret;
    const auth=req.headers.get("authorization")??"";
    let onlyUser:string|null=null;
    if(!cronOk){
      if(!auth.startsWith("Bearer ")) return new Response("Unauthorized",{status:401});
      const token=auth.slice(7); const {data}=await db.auth.getUser(token); onlyUser=data.user?.id??null;
      if(!onlyUser) return new Response("Unauthorized",{status:401});
    }
    const body=await req.json().catch(()=>({}));
    let prefQ=db.from("push_preferences").select("*"); if(onlyUser) prefQ=prefQ.eq("user_id",onlyUser);
    const {data:prefs}=await prefQ; if(!prefs?.length) return Response.json({sent:0});
    const ids=prefs.map((p:any)=>p.user_id);
    const [{data:states},{data:subs},{data:logs}]=await Promise.all([
      db.from("user_state").select("user_id,state").in("user_id",ids),
      db.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth,enabled").in("user_id",ids).eq("enabled",true),
      db.from("push_delivery_log").select("user_id,event_key").in("user_id",ids),
    ]);
    const stateMap=new Map((states??[]).map((r:any)=>[r.user_id,r.state]));
    const sentKeys=new Set((logs??[]).map((r:any)=>`${r.user_id}|${r.event_key}`));
    let sent=0;
    for(const pref of prefs as Pref[]){
      const userSubs=(subs??[]).filter((s:any)=>s.user_id===pref.user_id) as Sub[]; if(!userSubs.length) continue;
      const events=body.mode==="test"&&onlyUser===pref.user_id ? [{key:`test:${Date.now()}`,title:"Academic Hub",body:"Notificações ativadas com sucesso neste dispositivo.",url:"/#/definicoes"}] : buildDue(stateMap.get(pref.user_id)??{},pref,new Date());
      for(const event of events){
        if(body.mode!=="test" && sentKeys.has(`${pref.user_id}|${event.key}`)) continue;
        let ok=false;
        const payload=JSON.stringify({title:event.title,body:event.body,url:event.url,icon:"/academic-hub-icon-v10-192.png",badge:"/academic-hub-icon-v10-192.png"});
        for(const s of userSubs){
          try{ await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload,{TTL:86400}); ok=true; sent++; }
          catch(err:any){ if(err?.statusCode===404||err?.statusCode===410) await db.from("push_subscriptions").delete().eq("id",s.id); else console.error("push",err?.statusCode??err); }
        }
        if(ok && body.mode!=="test") await db.from("push_delivery_log").insert({user_id:pref.user_id,event_key:event.key});
      }
    }
    return Response.json({sent});
  }
};
