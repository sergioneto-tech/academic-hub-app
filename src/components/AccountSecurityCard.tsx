import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStoredSession, type CloudConfig } from "@/lib/cloudSync";

type ActivityItem = {
  occurred_at: string;
  event_type: "login_success" | "login_failed" | "password_recovery" | "unauthorized_api" | "rate_limited" | "session_revoked" | "security_action";
  severity: number;
  country_code?: string | null;
  device_label?: string | null;
  app_version?: string | null;
  incident_reference?: string | null;
  incident_status?: string | null;
};

const SECURITY_ACTIVITY_TIMEOUT_MS = 8000;

function cloudConfig(): CloudConfig | null {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

function labelFor(type: ActivityItem["event_type"]) {
  switch (type) {
    case "login_success": return "Sessão iniciada";
    case "login_failed": return "Tentativa de acesso falhada";
    case "password_recovery": return "Recuperação de palavra-passe";
    case "rate_limited": return "Tentativas limitadas por segurança";
    case "unauthorized_api": return "Acesso não autorizado bloqueado";
    case "session_revoked": return "Sessão revogada";
    default: return "Evento de segurança";
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-PT", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }).format(date);
}

export default function AccountSecurityCard() {
  const [activity,setActivity]=useState<ActivityItem[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(false);
  const [hasSession,setHasSession]=useState(false);

  const load=useCallback(async()=>{
    const cfg=cloudConfig();
    if(!cfg){setHasSession(false);setLoading(false);return;}
    const session=getStoredSession(cfg);
    if(!session?.access_token){setHasSession(false);setActivity([]);setLoading(false);return;}
    setHasSession(true);setLoading(true);setError(false);
    const controller=new AbortController();
    const timer=window.setTimeout(()=>controller.abort(),SECURITY_ACTIVITY_TIMEOUT_MS);
    try{
      const response=await fetch(`${cfg.supabaseUrl.replace(/\/$/,"")}/functions/v1/security-activity`,{
        method:"GET",cache:"no-store",signal:controller.signal,headers:{apikey:cfg.supabaseAnonKey,Authorization:`Bearer ${session.access_token}`}
      });
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const payload=await response.json() as {activity?:ActivityItem[]};
      setActivity(Array.isArray(payload.activity)?payload.activity:[]);
    }catch{setError(true);}finally{window.clearTimeout(timer);setLoading(false);}
  },[]);

  useEffect(()=>{void load();const handler=()=>void load();window.addEventListener("academic-hub-auth-changed",handler);return()=>window.removeEventListener("academic-hub-auth-changed",handler)},[load]);

  const needsAttention=useMemo(()=>activity.some(item=>item.severity>=2||Boolean(item.incident_reference&&item.incident_status!=="resolved"&&item.incident_status!=="false_positive")),[activity]);
  const recent=activity.slice(0,5);

  return <Card id="seguranca-conta" className="premium-card">
    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary"/>Segurança da conta</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {!hasSession?<div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">Liga a conta do Academic Hub para consultar a atividade de segurança associada ao teu acesso.</div>:<>
        <div className={`flex items-start gap-3 rounded-xl border p-3 ${needsAttention?"border-amber-500/35 bg-amber-500/7":"border-emerald-500/30 bg-emerald-500/5"}`}>
          {needsAttention?<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"/>:<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"/>}
          <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{needsAttention?"Atividade que requer atenção":"Nenhuma atividade suspeita detetada"}</div><div className="mt-1 text-xs text-muted-foreground">O Academic Hub regista eventos técnicos de autenticação e segurança sem guardar palavras-passe ou tokens. O IP completo não é mostrado nesta área.</div></div>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={()=>void load()} disabled={loading} aria-label="Atualizar atividade de segurança"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/></Button>
        </div>
        {error?<div className="text-xs text-amber-700 dark:text-amber-300">Não foi possível obter a atividade neste momento. O cartão foi libertado para poderes tentar novamente.</div>:recent.length===0?<div className="text-xs text-muted-foreground">Ainda não existem eventos de segurança registados para esta conta.</div>:<div className="space-y-2">{recent.map((item,index)=><div key={`${item.occurred_at}-${item.event_type}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border bg-card p-3"><div className="min-w-0"><div className="text-sm font-medium">{labelFor(item.event_type)}</div><div className="mt-0.5 text-xs text-muted-foreground">{[item.device_label,item.country_code,item.app_version?`v${item.app_version}`:null].filter(Boolean).join(" · ")||"Contexto técnico protegido"}</div>{item.incident_reference&&<div className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">Incidente {item.incident_reference}</div>}</div><div className="shrink-0 text-right text-[10px] text-muted-foreground">{formatDate(item.occurred_at)}</div></div>)}</div>}
      </>}
    </CardContent>
  </Card>;
}
