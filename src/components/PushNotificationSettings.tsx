import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, Send, Smartphone, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_PUSH_PREFERENCES,
  currentPushSubscription,
  disablePushOnThisDevice,
  enablePushOnThisDevice,
  isAppleMobileDevice,
  isStandalonePwa,
  loadPushPreferences,
  loadRegisteredPushDevices,
  pushSupported,
  reconcilePushOnThisDevice,
  savePushPreferences,
  sendPushTest,
  type PushPreferences,
  type RegisteredPushDevice,
} from "@/lib/pushNotifications";

const DAY_OPTIONS=[1,2,3,5,7,10,14];

export default function PushNotificationSettings(){
  const {toast}=useToast();
  const [prefs,setPrefs]=useState<PushPreferences>(DEFAULT_PUSH_PREFERENCES);
  const [subscribed,setSubscribed]=useState(false);
  const [devices,setDevices]=useState<RegisteredPushDevice[]>([]);
  const [busy,setBusy]=useState(false);
  const supported=pushSupported();
  const standalone=typeof window!=="undefined"?isStandalonePwa():false;
  const appleMobile=typeof window!=="undefined"?isAppleMobileDevice():false;

  async function refreshDevices(){
    try{setDevices(await loadRegisteredPushDevices())}catch{setDevices([])}
  }

  useEffect(()=>{void (async()=>{
    try{
      let sub=await currentPushSubscription();
      if(supported&&Notification.permission==="granted"){
        // Mesmo que a subscrição local tenha desaparecido, recria-a e volta a
        // associá-la à conta. Este é o caso que estava a falhar no iPad.
        sub=await reconcilePushOnThisDevice();
      }
      setSubscribed(Boolean(sub));
      await refreshDevices();
      const p=await loadPushPreferences();
      if(p)setPrefs(p);
    }catch{}
  })()},[]);

  async function persist(next:PushPreferences){setPrefs(next);try{await savePushPreferences(next);}catch(error){toast({title:"Não foi possível guardar",description:error instanceof Error?error.message:"Tenta novamente.",variant:"destructive"})}}
  async function enable(){setBusy(true);try{await enablePushOnThisDevice();setSubscribed(true);await refreshDevices();toast({title:"Notificações ativadas",description:"Este dispositivo já pode receber alertas do Academic Hub."});}catch(error){toast({title:"Não foi possível ativar",description:error instanceof Error?error.message:"Tenta novamente.",variant:"destructive"})}finally{setBusy(false)}}
  async function disable(){setBusy(true);try{await disablePushOnThisDevice();setSubscribed(false);await refreshDevices();toast({title:"Notificações desativadas neste dispositivo"});}finally{setBusy(false)}}
  async function test(){setBusy(true);try{const sent=await sendPushTest();await refreshDevices();toast({title:"Teste enviado",description:sent>0?`Enviado para ${sent} ${sent===1?"dispositivo ativo":"dispositivos ativos"}.`:"Não existe ainda nenhum dispositivo ativo registado."});}catch(error){toast({title:"Falha no teste",description:error instanceof Error?error.message:"Tenta novamente.",variant:"destructive"})}finally{setBusy(false)}}

  return <Card className="premium-card border-primary/25"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-primary"/>Notificações no dispositivo</CardTitle></CardHeader><CardContent className="space-y-4">
    {!supported?<div className="flex gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0"/><div>Este navegador não disponibiliza Web Push.</div></div>:(!standalone&&appleMobile)?<div className="flex gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs"><Smartphone className="mt-0.5 h-4 w-4 shrink-0"/><div>No iPhone/iPad, adiciona primeiro o Academic Hub ao ecrã principal e abre-o como aplicação para ativar notificações.</div></div>:null}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><div className="flex items-center gap-2 text-sm font-medium">{subscribed?<CheckCircle2 className="h-4 w-4 text-emerald-500"/>:<Smartphone className="h-4 w-4"/>}{subscribed?"Ativas neste dispositivo":"Ativar neste dispositivo"}</div><div className="mt-1 text-xs text-muted-foreground">Os alertas podem aparecer mesmo com o ecrã bloqueado, conforme as permissões do sistema.</div>{devices.length>0&&<div className="mt-2 text-[11px] text-muted-foreground">Registados na conta: {devices.map((d,i)=><span key={`${d.device_label}-${d.updated_at}-${i}`} className="mr-2 inline-flex rounded-full border px-2 py-0.5">{d.device_label||"Dispositivo"}</span>)}</div>}</div><div className="flex gap-2">{subscribed&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void test()}><Send className="mr-2 h-3.5 w-3.5"/>Teste em todos</Button>}<Button size="sm" variant={subscribed?"secondary":"default"} disabled={busy||!supported} onClick={()=>void (subscribed?disable():enable())}>{subscribed?"Desativar":"Ativar notificações"}</Button></div></div>
    <SettingRow title="E-fólios" description="Aviso quando começam, antes do fim e no último dia." checked={prefs.deadlines_enabled} onChange={v=>void persist({...prefs,deadlines_enabled:v})} days={prefs.efinal_lead_days} onDays={v=>void persist({...prefs,efinal_lead_days:v})}/>
    <SettingRow title="Exames e recursos" description="Aviso com antecedência e no próprio dia; mostra a hora quando estiver registada." checked={prefs.exams_enabled} onChange={v=>void persist({...prefs,exams_enabled:v})} days={prefs.exam_lead_days} onDays={v=>void persist({...prefs,exam_lead_days:v})}/>
    <SettingRow title="Prazos oficiais da UAb" description="Abertura e fecho das inscrições/matrículas, com ligação ao calendário oficial." checked={prefs.uab_enabled} onChange={v=>void persist({...prefs,uab_enabled:v})} days={prefs.uab_lead_days} onDays={v=>void persist({...prefs,uab_lead_days:v})}/>
  </CardContent></Card>
}

function SettingRow({title,description,checked,onChange,days,onDays}:{title:string;description:string;checked:boolean;onChange:(v:boolean)=>void;days:number;onDays:(v:number)=>void}){return <div className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[1fr_auto] sm:items-center"><div className="flex items-start gap-3"><Switch checked={checked} onCheckedChange={onChange}/><div><div className="text-sm font-medium">{title}</div><div className="mt-0.5 text-xs text-muted-foreground">{description}</div></div></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Avisar</span><Select value={String(days)} onValueChange={v=>onDays(Number(v))} disabled={!checked}><SelectTrigger className="h-8 w-[94px]"><SelectValue/></SelectTrigger><SelectContent>{DAY_OPTIONS.map(d=><SelectItem key={d} value={String(d)}>{d} {d===1?"dia":"dias"}</SelectItem>)}</SelectContent></Select><span>antes</span></div></div>}
