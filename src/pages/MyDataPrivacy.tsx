import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileText,
  Fingerprint,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";

import PageNavigationActions from "@/components/PageNavigationActions";
import SupportIdentityBadge from "@/components/SupportIdentityBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { useAppStore } from "@/lib/AppStore";
import { getStoredSession, type AuthSession } from "@/lib/cloudSync";
import { getPublicSupabaseConfig } from "@/lib/publicSupabaseConfig";
import { openTransparencyDocument } from "@/lib/transparencyDocument";

const RETENTION = [
  ["Entregas de notificações Push", "até 180 dias"],
  ["Subscrições Push desativadas", "até 90 dias"],
  ["Erros técnicos resolvidos", "até 180 dias"],
  ["Respostas a inquéritos", "até 365 dias"],
  ["Propostas PUC já resolvidas", "até 730 dias"],
  ["Consultas administrativas de suporte", "até 365 dias"],
  ["Eventos de segurança", "normalmente 90–180 dias; até 365 dias quando necessário"],
] as const;

function formatDate(value?: string | null) {
  if (!value) return "Sem sincronização registada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
}

function downloadJson(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export default function MyDataPrivacyPage() {
  const { state, exportData } = useAppStore();
  const config = useMemo(getPublicSupabaseConfig, []);
  const [session, setSession] = useState<AuthSession | null>(() => config ? getStoredSession(config) : null);
  const [openingDocument, setOpeningDocument] = useState(false);

  useEffect(() => {
    const refresh = () => setSession(config ? getStoredSession(config) : null);
    refresh();
    window.addEventListener("academic-hub-auth-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("academic-hub-auth-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [config]);

  const cloudEnabled = Boolean(session && state.sync?.enabled);
  const openFullTransparencyDocument = async () => {
    if (!session) return;
    try {
      setOpeningDocument(true);
      await openTransparencyDocument();
    } catch (error) {
      toast({
        title: "Não foi possível abrir o documento",
        description: error instanceof Error ? error.message : "Tenta novamente dentro de alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setOpeningDocument(false);
    }
  };
  const exportMine = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`academic-hub-meus-dados-${stamp}.json`, exportData());
    toast({ title: "Os teus dados foram exportados", description: "Foi criado um ficheiro JSON local neste dispositivo." });
  };

  return (
    <div className="space-y-6">
      <PageNavigationActions />

      <section className="premium-surface overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/><h1 className="text-2xl font-semibold tracking-tight">Os meus dados e privacidade</h1></div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Consulta como a tua conta está ligada, identifica-te perante o suporte sem expor o email, exporta os teus dados e encontra num só local as opções de correção, privacidade e eliminação.</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/seguranca-transparencia">Segurança e Transparência</Link></Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="premium-card"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><UserRound className="h-4 w-4 text-primary"/>Conta Academic Hub</CardTitle></CardHeader><CardContent className="space-y-2"><div className="flex items-center gap-2 text-sm font-medium">{session ? <><CheckCircle2 className="h-4 w-4 text-emerald-600"/>Conta ligada</> : <>Conta não ligada</>}</div><p className="text-xs leading-5 text-muted-foreground">O email de autenticação não é apresentado nesta área. Para suporte é utilizado o ID Academic Hub.</p></CardContent></Card>
        <Card className="premium-card"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Fingerprint className="h-4 w-4 text-primary"/>ID de suporte</CardTitle></CardHeader><CardContent className="space-y-2">{session ? <SupportIdentityBadge showCopy /> : <p className="text-sm text-muted-foreground">Disponível depois de iniciares sessão.</p>}<p className="text-xs leading-5 text-muted-foreground">É pseudónimo e não funciona como palavra-passe nem dá acesso à conta.</p></CardContent></Card>
        <Card className="premium-card"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Cloud className="h-4 w-4 text-primary"/>Cloud</CardTitle></CardHeader><CardContent className="space-y-1"><div className="text-sm font-medium">{cloudEnabled ? "Sincronização ativa" : "Sincronização não ativa"}</div><div className="text-xs text-muted-foreground">{formatDate(state.sync?.lastSyncAt)}</div><p className="pt-1 text-xs leading-5 text-muted-foreground">A cloud só fica associada à conta quando utilizas as funções de sincronização.</p></CardContent></Card>
      </div>

      <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="h-4 w-4 text-primary"/>Que dados podem existir</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">{["Perfil e preferências da aplicação", "Licenciatura, cadeiras, datas e avaliações", "Dados de sincronização e estado da cloud", "Subscrições e registos operacionais de notificações", "Pedidos de suporte e anexos que envies", "Registos técnicos de erros e segurança necessários ao funcionamento"].map(item => <div key={item} className="rounded-xl border bg-muted/20 p-3 leading-5">{item}</div>)}</CardContent></Card>

      <Card className="premium-card border-primary/20"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><RefreshCw className="h-4 w-4 text-primary"/>Conservação e limpeza</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm leading-6 text-muted-foreground">Os dados operacionais têm prazos definidos e a limpeza é executada automaticamente. Os dados necessários à conta e ao percurso académico mantêm-se enquanto a conta estiver ativa, salvo eliminação pelo utilizador ou outra necessidade aplicável.</p><div className="grid gap-2 md:grid-cols-2">{RETENTION.map(([label, period]) => <div key={label} className="grid min-w-0 gap-1 rounded-xl border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4"><span className="min-w-0 break-words text-xs font-medium">{label}</span><span className="min-w-0 break-words text-xs text-muted-foreground sm:text-right">{period}</span></div>)}</div><p className="text-[11px] leading-5 text-muted-foreground">Os detalhes jurídicos completos, finalidades e critérios de conservação são apresentados na Política de Privacidade.</p></CardContent></Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Download className="h-4 w-4 text-primary"/>Exportar os meus dados</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm leading-6 text-muted-foreground">Cria uma cópia local em JSON dos dados académicos e preferências existentes neste dispositivo. Guarda o ficheiro num local seguro porque pode conter informação pessoal.</p><Button type="button" onClick={exportMine}><Download className="mr-2 h-4 w-4"/>Exportar dados</Button></CardContent></Card>
        <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4 text-primary"/>Corrigir os meus dados</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm leading-6 text-muted-foreground">O perfil pode ser corrigido em Conta e Perfil. Cadeiras, datas, avaliações e classificações continuam a ser alteradas nas respetivas áreas da aplicação.</p><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/conta">Conta e Perfil</Link></Button><Button asChild variant="outline"><Link to="/cadeiras">Dados académicos</Link></Button></div></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="premium-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4 text-primary"/>Pedido ou esclarecimento</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm leading-6 text-muted-foreground">Se precisares de comunicar uma incorreção, esclarecer o tratamento dos teus dados ou pedir apoio, utiliza o Suporte. Quando estás autenticado, o pedido fica associado internamente à conta e é apresentado ao administrador através do ID Academic Hub.</p><Button asChild variant="outline"><Link to="/feedback">Abrir Suporte</Link></Button></CardContent></Card>
        <Card className="premium-card border-destructive/25"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trash2 className="h-4 w-4 text-destructive"/>Eliminar conta</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm leading-6 text-muted-foreground">A eliminação é feita na área Conta e Perfil e exige confirmação explícita. A conta, os registos associados por utilizador e os anexos privados de suporte são removidos pelo procedimento de eliminação.</p><Button asChild variant="outline"><Link to="/conta">Gerir ou eliminar conta</Link></Button></CardContent></Card>
      </div>

      <Card className="premium-card"><CardContent className="p-4"><div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary"/>Documentação e transparência</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Privacidade, condições de utilização e segurança são apresentadas separadamente para ser mais claro o que cada documento explica.</p><div className="mt-3 flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link to="/privacidade">Privacidade e RGPD</Link></Button><Button asChild variant="outline" size="sm"><Link to="/termos">Termos de Utilização</Link></Button><Button asChild variant="outline" size="sm"><Link to="/seguranca-transparencia">Segurança e Transparência</Link></Button><Button asChild variant="outline" size="sm"><Link to="/transparencia">Sobre o Academic Hub</Link></Button>{session&&<Button type="button" size="sm" onClick={()=>void openFullTransparencyDocument()} disabled={openingDocument}><FileText className="mr-2 h-4 w-4"/>{openingDocument?"A abrir...":"Documento completo (PDF)"}</Button>}</div></CardContent></Card>
    </div>
  );
}
