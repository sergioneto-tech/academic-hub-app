import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bug, CheckCircle2, ClipboardList, FileImage, Lightbulb, MessageSquareText, Send, ShieldCheck, X } from "lucide-react";
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
  playAcademicHubAppSound,
  setFeedbackStatus,
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
  "Outra funcionalidade",
];

const STATUS_ORDER: FeedbackStatus[] = ["new", "reviewing", "waiting_user", "planned", "in_development", "completed", "not_planned", "archived"];
const KIND_LABELS: Record<FeedbackKind, string> = { opinion: "Opinião", suggestion: "Sugestão", bug: "Problema" };

const KIND_STYLES: Record<FeedbackKind, { idle: string; selected: string; icon: string; list: string }> = {
  opinion: {
    idle: "border-blue-500/55 bg-blue-500/[0.04] hover:bg-blue-500/10",
    selected: "border-blue-400 bg-blue-500/15 ring-1 ring-blue-400/30",
    icon: "text-blue-400",
    list: "border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-500/[0.07] to-transparent",
  },
  suggestion: {
    idle: "border-green-500/55 bg-green-500/[0.04] hover:bg-green-500/10",
    selected: "border-green-400 bg-green-500/15 ring-1 ring-green-400/30",
    icon: "text-green-400",
    list: "border-l-4 border-l-green-500 bg-gradient-to-r from-green-500/[0.07] to-transparent",
  },
  bug: {
    idle: "border-red-500/55 bg-red-500/[0.04] hover:bg-red-500/10",
    selected: "border-red-400 bg-red-500/15 ring-1 ring-red-400/30",
    icon: "text-red-400",
    list: "border-l-4 border-l-red-500 bg-gradient-to-r from-red-500/[0.07] to-transparent",
  },
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function deviceSummary() {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return `${mobile ? "Dispositivo móvel" : "Computador"} · ${navigator.platform || "plataforma não identificada"}`;
}

function statusClass(status: FeedbackStatus) {
  if (status === "completed") return "border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (status === "new") return "border-red-500/35 bg-red-500/10 text-red-600 dark:text-red-400";
  if (status === "in_development") return "border-blue-500/35 bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (status === "planned") return "border-violet-500/35 bg-violet-500/10 text-violet-600 dark:text-violet-400";
  return "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

export default function FeedbackPage() {
  const { toast } = useToast();
  const [refresh, setRefresh] = useState(0);
  const [kind, setKind] = useState<FeedbackKind>("suggestion");
  const [area, setArea] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | FeedbackKind>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | FeedbackStatus>("all");
  const [pendingStatus, setPendingStatus] = useState<FeedbackStatus>("new");
  const [reply, setReply] = useState("");
  const [resolution, setResolution] = useState("");
  const [resolvedVersion, setResolvedVersion] = useState("");

  const enabled = isFeedbackBetaEnabled();
  const manager = isFeedbackBetaManager();
  const userId = currentFeedbackUserId();

  useEffect(() => {
    const handler = () => setRefresh((value) => value + 1);
    window.addEventListener(FEEDBACK_BETA_EVENT, handler);
    return () => window.removeEventListener(FEEDBACK_BETA_EVENT, handler);
  }, []);

  const entries = useMemo(() => loadFeedbackStore().entries, [refresh]);
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;
  const counts = useMemo(
    () => Object.fromEntries(STATUS_ORDER.map((status) => [status, entries.filter((entry) => entry.status === status).length])) as Record<FeedbackStatus, number>,
    [entries],
  );
  const filteredEntries = useMemo(
    () => entries.filter((entry) => (typeFilter === "all" || entry.kind === typeFilter) && (statusFilter === "all" || entry.status === statusFilter)),
    [entries, typeFilter, statusFilter],
  );

  useEffect(() => {
    if (!selected) return;
    setPendingStatus(selected.status);
    setReply("");
    setResolution("");
    setResolvedVersion("");
  }, [selected?.id, selected?.status]);

  if (!enabled) {
    return <div className="mx-auto max-w-2xl"><Card className="premium-card"><CardHeader><CardTitle>Feedback Academic Hub</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Esta área ainda não está disponível nesta conta.</CardContent></Card></div>;
  }

  function closeSelected() {
    setSelectedId(null);
    setReply("");
    setResolution("");
    setResolvedVersion("");
  }

  function submit() {
    if (!userId) return toast({ title: "É necessário iniciar sessão", description: "Entra na conta Academic Hub antes de enviares feedback.", variant: "destructive" });
    if (title.trim().length < 3) return toast({ title: "Indica um título curto", variant: "destructive" });
    if (kind === "bug" && (!steps.trim() || !body.trim() || !expected.trim() || files.length === 0)) {
      return toast({ title: "Completa o relatório do problema", description: "Descreve o percurso, o erro, o resultado esperado e anexa pelo menos uma captura.", variant: "destructive" });
    }

    const entry = createFeedback({
      userId,
      kind,
      area: area || undefined,
      title: title.trim(),
      body: body.trim(),
      steps: steps.trim() || undefined,
      expected: expected.trim() || undefined,
      appVersion: APP_VERSION,
      device: deviceSummary(),
      attachments: files.map((file) => ({ id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size })),
    });

    setArea("");
    setTitle("");
    setBody("");
    setSteps("");
    setExpected("");
    setFiles([]);
    closeSelected();
    playAcademicHubAppSound("confirm");
    toast({ title: "Feedback recebido", description: `${entry.reference} · registado no Academic Hub.` });
  }

  function openEntry(entry: FeedbackEntry) {
    const opening = selectedId !== entry.id;
    if (!opening) {
      closeSelected();
      return;
    }
    setSelectedId(entry.id);
    if (manager && !entry.readAt) markFeedbackRead(entry.id);
  }

  function saveStatus() {
    if (!selected) return;
    if (pendingStatus === selected.status && !resolution.trim() && !resolvedVersion.trim()) {
      return toast({ title: "Sem alterações para guardar" });
    }
    setFeedbackStatus(selected.id, pendingStatus, resolution.trim() || undefined, resolvedVersion.trim() || undefined);
    playAcademicHubAppSound("confirm");
    toast({ title: `Estado: ${FEEDBACK_STATUS_LABELS[pendingStatus]}` });
    closeSelected();
  }

  function sendReply() {
    if (!selected || !reply.trim()) return;
    addFeedbackMessage(selected.id, reply, "academic_hub");
    playAcademicHubAppSound("notification");
    toast({ title: "Resposta AH registada", description: "A mensagem ficou identificada como Academic Hub." });
    closeSelected();
  }

  return <div className="space-y-5">
    <div><Button asChild variant="ghost" size="sm"><Link to="/ajuda"><ArrowLeft className="mr-2 h-4 w-4" />Voltar a Ajuda & Guia</Link></Button></div>

    <section className="premium-surface overflow-hidden p-5 sm:p-7">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Opinião, sugestões e problemas</h1>
        <p className="mt-2 text-sm text-muted-foreground">Partilha uma opinião, propõe uma melhoria ou reporta um problema. Cada pedido mantém referência, estado e histórico de acompanhamento.</p>
      </div>
    </section>

    {manager && <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[["new", "Novos"], ["reviewing", "Em análise"], ["in_development", "Em desenvolvimento"], ["completed", "Concluídos"]].map(([status, label]) =>
        <Card key={status} className="premium-card min-w-0"><CardContent className="p-3 sm:p-4"><div className="text-[11px] leading-tight text-muted-foreground sm:text-xs">{label}</div><div className="mt-1 text-2xl font-semibold">{counts[status as FeedbackStatus]}</div></CardContent></Card>,
      )}
    </div>}

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
      <Card className="premium-card border-[hsl(var(--gold)/0.35)]">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquareText className="h-5 w-5 text-[hsl(var(--gold))]" />Enviar feedback</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {([{ value: "opinion", label: "Opinião", icon: MessageSquareText }, { value: "suggestion", label: "Sugestão", icon: Lightbulb }, { value: "bug", label: "Problema", icon: Bug }] as const).map((item) => {
                const Icon = item.icon;
                const style = KIND_STYLES[item.value];
                return <button key={item.value} type="button" onClick={() => setKind(item.value)} className={`rounded-xl border p-3 text-left transition ${kind === item.value ? style.selected : style.idle}`}>
                  <Icon className={`mb-2 h-4 w-4 ${style.icon}`} />
                  <div className="text-sm font-semibold">{item.label}</div>
                </button>;
              })}
            </div>
          </div>

          {kind === "suggestion" && <div className="grid gap-2"><Label>Área sugerida</Label><Select value={area} onValueChange={setArea}><SelectTrigger><SelectValue placeholder="Escolhe uma área ou escreve livremente abaixo" /></SelectTrigger><SelectContent>{IMPROVEMENT_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>}

          <div className="grid gap-2"><Label>Título</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "bug" ? "Ex.: Erro ao guardar a nota" : "Resume a tua opinião ou sugestão"} /></div>
          {kind === "bug" && <div className="grid gap-2"><Label>1. O que estavas a fazer?</Label><Textarea value={steps} onChange={(event) => setSteps(event.target.value)} rows={4} placeholder="Indica o percurso até ao erro, passo a passo." /></div>}
          <div className="grid gap-2"><Label>{kind === "bug" ? "2. O que aconteceu?" : "Descrição"}</Label><Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} placeholder="Explica de forma objetiva o que observaste ou gostarias de melhorar." /></div>

          {kind === "bug" && <>
            <div className="grid gap-2"><Label>3. O que esperavas que acontecesse?</Label><Textarea value={expected} onChange={(event) => setExpected(event.target.value)} rows={3} /></div>
            <div className="grid gap-2"><Label>4. Capturas de ecrã</Label><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/25 px-4 py-5 text-sm text-muted-foreground hover:bg-muted/45"><FileImage className="h-5 w-5" />Anexar 1 a 3 imagens<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 3))} /></label>{files.length > 0 && <div className="grid gap-2 text-xs text-muted-foreground">{files.map((file) => <div key={`${file.name}-${file.size}`} className="rounded-lg border px-3 py-2">{file.name} · {(file.size / 1024).toFixed(0)} KB</div>)}</div>}</div>
          </>}

          <div className="rounded-xl border bg-muted/25 p-3 text-xs text-muted-foreground"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />O Academic Hub associa automaticamente a versão da app e informação técnica básica do dispositivo. Não anexes passwords nem dados sensíveis.</div>
          <Button onClick={submit}><Send className="mr-2 h-4 w-4" />Enviar para o Academic Hub</Button>
        </CardContent>
      </Card>

      <Card className="premium-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-5 w-5 text-primary" />{manager ? "Caixa de feedback" : "Os meus envios"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1"><Label className="text-xs">Tipo</Label><Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | FeedbackKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os tipos ({entries.length})</SelectItem><SelectItem value="opinion">Opiniões ({entries.filter((entry) => entry.kind === "opinion").length})</SelectItem><SelectItem value="suggestion">Sugestões ({entries.filter((entry) => entry.kind === "suggestion").length})</SelectItem><SelectItem value="bug">Problemas ({entries.filter((entry) => entry.kind === "bug").length})</SelectItem></SelectContent></Select></div>
            <div className="grid gap-1"><Label className="text-xs">Estado</Label><Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | FeedbackStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os estados</SelectItem>{STATUS_ORDER.map((status) => <SelectItem key={status} value={status}>{FEEDBACK_STATUS_LABELS[status]}</SelectItem>)}</SelectContent></Select></div>
          </div>

          {filteredEntries.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Não existem registos para os filtros selecionados.</div> : filteredEntries.map((entry) =>
            <button key={entry.id} type="button" onClick={() => openEntry(entry)} className={`w-full rounded-xl border p-3 text-left transition hover:bg-accent ${KIND_STYLES[entry.kind].list} ${selectedId === entry.id ? "ring-1 ring-primary/40" : ""}`}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`text-xs font-semibold ${KIND_STYLES[entry.kind].icon}`}>{entry.reference} · {KIND_LABELS[entry.kind]}</span>{manager && !entry.readAt && <span className="h-2 w-2 rounded-full bg-red-500" />}</div><div className="mt-1 truncate text-sm font-semibold">{entry.title}</div><div className="mt-1 text-xs text-muted-foreground">{formatDate(entry.createdAt)}</div></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusClass(entry.status)}`}>{FEEDBACK_STATUS_LABELS[entry.status]}</span></div>
            </button>,
          )}
        </CardContent>
      </Card>
    </div>

    {selected && <Card className={`premium-card overflow-hidden ${KIND_STYLES[selected.kind].list}`}>
      <CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className={`text-xs font-semibold ${KIND_STYLES[selected.kind].icon}`}>{selected.reference} · {KIND_LABELS[selected.kind]}</div><CardTitle className="mt-1 text-lg">{selected.title}</CardTitle><div className="mt-1 text-xs text-muted-foreground">Recebido em {formatDate(selected.createdAt)} · AH v{selected.appVersion}</div></div><div className="flex flex-wrap items-center gap-2"><span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(selected.status)}`}>{FEEDBACK_STATUS_LABELS[selected.status]}</span><Button type="button" variant="ghost" size="sm" onClick={closeSelected}><X className="mr-1 h-4 w-4" />Fechar</Button></div></div></CardHeader>
      <CardContent className="space-y-5">
        {selected.area && <Detail title="Área" text={selected.area} />}
        {selected.steps && <Detail title="O que estava a fazer" text={selected.steps} />}
        <Detail title={selected.kind === "bug" ? "O que aconteceu" : "Descrição"} text={selected.body || "—"} />
        {selected.expected && <Detail title="Resultado esperado" text={selected.expected} />}

        <div className="grid gap-2 rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground"><div><strong className="text-foreground">Informação técnica</strong></div><div>{selected.device}</div><div>Versão Academic Hub: {selected.appVersion}</div>{selected.attachments.length > 0 && <div>Capturas anexadas: {selected.attachments.map((item) => item.name).join(", ")} <span className="italic">(nesta fase de validação ainda não são enviadas para a cloud)</span></div>}</div>

        <div><div className="mb-2 text-sm font-semibold">Histórico</div><div className="space-y-2 border-l pl-4">{selected.history.map((item) => <div key={item.id} className="relative text-xs"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" /><div className="font-semibold">{FEEDBACK_STATUS_LABELS[item.status]}</div><div className="text-muted-foreground">{formatDate(item.createdAt)}{item.note ? ` · ${item.note}` : ""}</div></div>)}</div></div>

        {selected.messages.length > 0 && <div><div className="mb-2 text-sm font-semibold">Mensagens</div><div className="space-y-2">{selected.messages.map((message) => <div key={message.id} className={`rounded-xl border p-3 text-sm ${message.author === "academic_hub" ? "border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold-soft)/0.4)]" : "bg-card"}`}><div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{message.author === "academic_hub" ? "Academic Hub" : "Aluno"} · {formatDate(message.createdAt)}</div>{message.body}</div>)}</div></div>}

        {manager && <div className="grid gap-4 rounded-2xl border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold-soft)/0.2)] p-4 lg:grid-cols-2">
          <div className="space-y-3"><div className="text-sm font-semibold">Gestão do estado</div><Select value={pendingStatus} onValueChange={(value) => setPendingStatus(value as FeedbackStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_ORDER.map((status) => <SelectItem key={status} value={status}>{FEEDBACK_STATUS_LABELS[status]}</SelectItem>)}</SelectContent></Select><Textarea value={resolution} onChange={(event) => setResolution(event.target.value)} rows={3} placeholder="Nota de resolução ou contexto (opcional)" /><Input value={resolvedVersion} onChange={(event) => setResolvedVersion(event.target.value)} placeholder="Versão, ex.: 1.4.1" /><Button type="button" variant="secondary" onClick={saveStatus}>Guardar estado</Button></div>
          <div className="space-y-3"><div className="text-sm font-semibold">Responder como Academic Hub</div><Textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={5} placeholder="A resposta será identificada sempre com a marca Academic Hub." /><Button onClick={sendReply} disabled={!reply.trim()}><Send className="mr-2 h-4 w-4" />Registar resposta AH</Button></div>
        </div>}

        {selected.status === "completed" && <div className="flex gap-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><div className="font-semibold">Concluído pelo Academic Hub</div><div className="mt-1 text-sm text-muted-foreground">{selected.resolutionNote || "Este pedido foi concluído."}{selected.resolvedVersion ? ` · Disponível na versão ${selected.resolvedVersion}.` : ""}</div></div></div>}
      </CardContent>
    </Card>}
  </div>;
}

function Detail({ title, text }: { title: string; text: string }) {
  return <div><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div><div className="whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm leading-6">{text}</div></div>;
}
