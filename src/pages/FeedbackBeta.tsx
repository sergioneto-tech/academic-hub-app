import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bug, CheckCircle2, ClipboardList, FileImage, Lightbulb, MessageSquareText, Send, ShieldCheck, Sparkles, Volume2, VolumeX } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { APP_VERSION } from "@/lib/version";
import {
  FEEDBACK_BETA_EVENT,
  FEEDBACK_STATUS_LABELS,
  addFeedbackMessage,
  createFeedback,
  currentFeedbackUserId,
  isFeedbackBetaEnabled,
  isFeedbackBetaManager,
  loadFeedbackStore,
  markFeedbackRead,
  notificationSoundEnabled,
  playAcademicHubNotificationSound,
  setFeedbackStatus,
  setNotificationSoundEnabled,
  type FeedbackEntry,
  type FeedbackKind,
  type FeedbackStatus,
} from "@/lib/feedbackBeta";

const IMPROVEMENT_OPTIONS = [
  "Experiência no telemóvel/tablet",
  "Calendário, exames e datas UAb",
  "Alertas e notificações",
  "Gestão das cadeiras e notas",
  "Sincronização entre dispositivos",
  "Apoio ao estudo",
];
const STATUS_ORDER: FeedbackStatus[] = ["new","reviewing","waiting_user","planned","in_development","completed","not_planned","archived"];
const KIND_LABELS: Record<FeedbackKind,string> = { opinion:"Opinião", suggestion:"Sugestão", bug:"Problema" };

function formatDate(value:string){return new Date(value).toLocaleString("pt-PT",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}
function deviceSummary(){const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);return `${mobile?"Dispositivo móvel":"Computador"} · ${navigator.platform||"plataforma não identificada"}`;}
function statusClass(status:FeedbackStatus){if(status==="completed")return "border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";if(status==="new")return "border-red-500/35 bg-red-500/10 text-red-600 dark:text-red-400";if(status==="in_development")return "border-blue-500/35 bg-blue-500/10 text-blue-600 dark:text-blue-400";if(status==="planned")return "border-violet-500/35 bg-violet-500/10 text-violet-600 dark:text-violet-400";return "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300"}

export default function FeedbackBeta(){
  const {toast}=useToast();
  const [refresh,setRefresh]=useState(0);
  const [kind,setKind]=useState<FeedbackKind>("suggestion");
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [steps,setSteps]=useState("");
  const [expected,setExpected]=useState("");
  const [files,setFiles]=useState<File[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [reply,setReply]=useState("");
  const [resolution,setResolution]=useState("");
  const [resolvedVersion,setResolvedVersion]=useState("");
  const [sound,setSound]=useState(()=>notificationSoundEnabled());
  const enabled=isFeedbackBetaEnabled(),manager=isFeedbackBetaManager(),userId=currentFeedbackUserId();
  useEffect(()=>{const handler=()=>setRefresh(v=>v+1);window.addEventListener(FEEDBACK_BETA_EVENT,handler);return()=>window.removeEventListener(FEEDBACK_BETA_EVENT,handler)},[]);
  const entries=useMemo(()=>loadFeedbackStore().entries,[refresh]);
  const selected=entries.find(entry=>entry.id===selectedId)??null;
  const counts=useMemo(()=>Object.fromEntries(STATUS_ORDER.map(status=>[status,entries.filter(entry=>entry.status===status).length])) as Record<FeedbackStatus,number>,[entries]);

  if(!enabled)return <div className="mx-auto max-w-2xl"><Card className="premium-card"><CardHeader><CardTitle>Feedback Academic Hub</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Esta área está em fase de teste interno e ainda não se encontra disponível nesta conta.</CardContent></Card></div>;

  function submit(){
    if(!userId)return toast({title:"É necessário iniciar sessão",description:"Entra na conta Academic Hub antes de enviares feedback.",variant:"destructive"});
    if(title.trim().length<3)return toast({title:"Indica um título curto",variant:"destructive"});
    if(kind==="bug"&&(!steps.trim()||!body.trim()||!expected.trim()||files.length===0))return toast({title:"Completa o relatório do problema",description:"Para problemas, descreve o percurso, o erro, o resultado esperado e anexa pelo menos uma captura.",variant:"destructive"});
    const entry=createFeedback({userId,kind,title:title.trim(),body:body.trim(),steps:steps.trim()||undefined,expected:expected.trim()||undefined,appVersion:APP_VERSION,device:deviceSummary(),attachments:files.map(file=>({id:crypto.randomUUID(),name:file.name,type:file.type,size:file.size}))});
    setTitle("");setBody("");setSteps("");setExpected("");setFiles([]);setSelectedId(entry.id);playAcademicHubNotificationSound();
    toast({title:"Feedback recebido",description:`${entry.reference} · guardado na área de teste do Academic Hub.`});
  }

  function openEntry(entry:FeedbackEntry){setSelectedId(entry.id);if(manager&&!entry.readAt)markFeedbackRead(entry.id)}
  function changeStatus(status:FeedbackStatus){if(!selected)return;setFeedbackStatus(selected.id,status,resolution.trim()||undefined,resolvedVersion.trim()||undefined);setResolution("");setResolvedVersion("");playAcademicHubNotificationSound();toast({title:`Estado: ${FEEDBACK_STATUS_LABELS[status]}`})}
  function sendReply(){if(!selected||!reply.trim())return;addFeedbackMessage(selected.id,reply,"academic_hub");setReply("");playAcademicHubNotificationSound();toast({title:"Resposta AH registada",description:"A mensagem mantém a marca Academic Hub no histórico."})}
  function toggleSound(){const next=!sound;setSound(next);setNotificationSoundEnabled(next);if(next)playAcademicHubNotificationSound()}

  return <div className="space-y-5">
    <div><Button asChild variant="ghost" size="sm"><Link to="/ajuda"><ArrowLeft className="mr-2 h-4 w-4"/>Voltar a Ajuda & Guia</Link></Button></div>
    <section className="premium-surface overflow-hidden p-5 sm:p-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-3xl"><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--gold)/0.45)] bg-[hsl(var(--gold-soft)/0.55)] px-3 py-1 text-xs font-semibold text-[hsl(var(--gold))]"><Sparkles className="h-3.5 w-3.5"/>Beta de feedback</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Opinião, sugestões e problemas</h1><p className="mt-2 text-sm text-muted-foreground">Um canal académico permanente para melhorar o Academic Hub. Nesta fase, tudo fica isolado nesta conta de teste para validação visual e funcional.</p></div><button type="button" onClick={toggleSound} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-medium">{sound?<Volume2 className="h-4 w-4 text-primary"/>:<VolumeX className="h-4 w-4"/>}Som interno {sound?"ativo":"desativado"}</button></div></section>

    {manager&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["new","Novos"],["reviewing","Em análise"],["in_development","Em desenvolvimento"],["completed","Concluídos"]].map(([status,label])=><Card key={status} className="premium-card"><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{counts[status as FeedbackStatus]}</div></CardContent></Card>)}</div>}

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
      <Card className="premium-card border-[hsl(var(--gold)/0.35)]"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquareText className="h-5 w-5 text-[hsl(var(--gold))]"/>Enviar feedback</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-2"><Label>Tipo</Label><div className="grid gap-2 sm:grid-cols-3">{([{value:"opinion",label:"Opinião",icon:MessageSquareText},{value:"suggestion",label:"Sugestão",icon:Lightbulb},{value:"bug",label:"Problema",icon:Bug}] as const).map(item=>{const Icon=item.icon;return <button key={item.value} type="button" onClick={()=>setKind(item.value)} className={`rounded-xl border p-3 text-left transition ${kind===item.value?"border-primary bg-primary/10":"bg-card hover:bg-accent"}`}><Icon className="mb-2 h-4 w-4 text-primary"/><div className="text-sm font-semibold">{item.label}</div></button>})}</div></div>
        {kind==="suggestion"&&<div className="grid gap-2"><Label>Área sugerida</Label><Select onValueChange={value=>{setTitle(value);if(!body)setBody(`Gostaria de ver melhorias em: ${value}.`)}}><SelectTrigger><SelectValue placeholder="Escolhe uma área ou escreve livremente abaixo"/></SelectTrigger><SelectContent>{IMPROVEMENT_OPTIONS.map(option=><SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>}
        <div className="grid gap-2"><Label>Título</Label><Input value={title} onChange={event=>setTitle(event.target.value)} placeholder={kind==="bug"?"Ex.: Erro ao guardar a nota":"Resume a tua opinião ou sugestão"}/></div>
        {kind==="bug"&&<div className="grid gap-2"><Label>1. O que estavas a fazer?</Label><Textarea value={steps} onChange={event=>setSteps(event.target.value)} rows={4} placeholder="Indica o percurso até ao erro, passo a passo."/></div>}
        <div className="grid gap-2"><Label>{kind==="bug"?"2. O que aconteceu?":"Descrição"}</Label><Textarea value={body} onChange={event=>setBody(event.target.value)} rows={5} placeholder="Explica de forma objetiva o que observaste ou gostarias de melhorar."/></div>
        {kind==="bug"&&<><div className="grid gap-2"><Label>3. O que esperavas que acontecesse?</Label><Textarea value={expected} onChange={event=>setExpected(event.target.value)} rows={3}/></div><div className="grid gap-2"><Label>4. Capturas de ecrã</Label><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/25 px-4 py-5 text-sm text-muted-foreground hover:bg-muted/45"><FileImage className="h-5 w-5"/>Anexar 1 a 3 imagens<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event=>setFiles(Array.from(event.target.files??[]).slice(0,3))}/></label>{files.length>0&&<div className="grid gap-2 text-xs text-muted-foreground">{files.map(file=><div key={`${file.name}-${file.size}`} className="rounded-lg border px-3 py-2">{file.name} · {(file.size/1024).toFixed(0)} KB</div>)}</div>}</div></>}
        <div className="rounded-xl border bg-muted/25 p-3 text-xs text-muted-foreground"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary"/>O Academic Hub junta automaticamente a versão da app e informação técnica básica do dispositivo. Não anexes passwords ou dados sensíveis.</div>
        <Button onClick={submit}><Send className="mr-2 h-4 w-4"/>Enviar para o Academic Hub</Button>
      </CardContent></Card>

      <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-5 w-5 text-primary"/>{manager?"Caixa de feedback":"Os meus envios"}</CardTitle></CardHeader><CardContent className="space-y-2">{entries.length===0?<div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Ainda não existem registos nesta fase de teste.</div>:entries.map(entry=><button key={entry.id} type="button" onClick={()=>openEntry(entry)} className={`w-full rounded-xl border p-3 text-left transition hover:bg-accent ${selectedId===entry.id?"border-primary bg-primary/5":"bg-card"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-xs font-semibold text-[hsl(var(--gold))]">{entry.reference}</span>{manager&&!entry.readAt&&<span className="h-2 w-2 rounded-full bg-red-500"/>}</div><div className="mt-1 truncate text-sm font-semibold">{entry.title}</div><div className="mt-1 text-xs text-muted-foreground">{KIND_LABELS[entry.kind]} · {formatDate(entry.createdAt)}</div></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(entry.status)}`}>{FEEDBACK_STATUS_LABELS[entry.status]}</span></div></button>)}</CardContent></Card>
    </div>

    {selected&&<Card className="premium-card border-primary/25"><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-xs font-semibold text-[hsl(var(--gold))]">{selected.reference} · {KIND_LABELS[selected.kind]}</div><CardTitle className="mt-1 text-lg">{selected.title}</CardTitle><div className="mt-1 text-xs text-muted-foreground">Recebido em {formatDate(selected.createdAt)} · AH v{selected.appVersion}</div></div><span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(selected.status)}`}>{FEEDBACK_STATUS_LABELS[selected.status]}</span></div></CardHeader><CardContent className="space-y-5">
      {selected.steps&&<Detail title="O que estava a fazer" text={selected.steps}/>}<Detail title={selected.kind==="bug"?"O que aconteceu":"Descrição"} text={selected.body||"—"}/>{selected.expected&&<Detail title="Resultado esperado" text={selected.expected}/>}<div className="grid gap-2 rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground"><div><strong className="text-foreground">Informação técnica</strong></div><div>{selected.device}</div><div>Versão Academic Hub: {selected.appVersion}</div>{selected.attachments.length>0&&<div>Capturas anexadas: {selected.attachments.map(item=>item.name).join(", ")} <span className="italic">(na beta visual ainda não são enviadas para a cloud)</span></div>}</div>
      <div><div className="mb-2 text-sm font-semibold">Histórico</div><div className="space-y-2 border-l pl-4">{selected.history.map(item=><div key={item.id} className="relative text-xs"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"/><div className="font-semibold">{FEEDBACK_STATUS_LABELS[item.status]}</div><div className="text-muted-foreground">{formatDate(item.createdAt)}{item.note?` · ${item.note}`:""}</div></div>)}</div></div>
      {selected.messages.length>0&&<div><div className="mb-2 text-sm font-semibold">Mensagens</div><div className="space-y-2">{selected.messages.map(message=><div key={message.id} className={`rounded-xl border p-3 text-sm ${message.author==="academic_hub"?"border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold-soft)/0.4)]":"bg-card"}`}><div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{message.author==="academic_hub"?"Academic Hub":"Aluno"} · {formatDate(message.createdAt)}</div>{message.body}</div>)}</div></div>}
      {manager&&<div className="grid gap-4 rounded-2xl border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold-soft)/0.2)] p-4 lg:grid-cols-2"><div className="space-y-3"><div className="text-sm font-semibold">Gestão do estado</div><Select value={selected.status} onValueChange={value=>changeStatus(value as FeedbackStatus)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{STATUS_ORDER.map(status=><SelectItem key={status} value={status}>{FEEDBACK_STATUS_LABELS[status]}</SelectItem>)}</SelectContent></Select><Textarea value={resolution} onChange={event=>setResolution(event.target.value)} rows={3} placeholder="Nota de resolução ou contexto (opcional)"/><Input value={resolvedVersion} onChange={event=>setResolvedVersion(event.target.value)} placeholder="Versão, ex.: 1.3.2"/><p className="text-[11px] text-muted-foreground">Preenche a nota/versão antes de escolher o novo estado para que fiquem registadas no histórico.</p></div><div className="space-y-3"><div className="text-sm font-semibold">Responder como Academic Hub</div><Textarea value={reply} onChange={event=>setReply(event.target.value)} rows={5} placeholder="A resposta será identificada sempre com a marca Academic Hub."/><Button onClick={sendReply} disabled={!reply.trim()}><Send className="mr-2 h-4 w-4"/>Registar resposta AH</Button></div></div>}
      {selected.status==="completed"&&<div className="flex gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"/><div><div className="font-semibold">Concluído pelo Academic Hub</div><div className="mt-1 text-sm text-muted-foreground">{selected.resolutionNote||"Este pedido foi concluído."}{selected.resolvedVersion?` · Disponível na versão ${selected.resolvedVersion}.`:""}</div></div></div>}
    </CardContent></Card>}
  </div>;
}

function Detail({title,text}:{title:string;text:string}){return <div><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div><div className="whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm leading-6">{text}</div></div>}
