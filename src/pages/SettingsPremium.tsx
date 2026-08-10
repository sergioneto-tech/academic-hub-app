import { Bell, BookOpenCheck, Check, ExternalLink, Monitor, Moon, Palette, Sun, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import PushNotificationSettings from "@/components/PushNotificationSettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/AppStore";
import { applyTheme, storeTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";
import SettingsPage from "@/pages/Settings";

const REGULATION_URL = "https://portal.uab.pt/avaliacao/";
const THEMES: Array<{ value: ThemeMode; label: string; description: string; icon: typeof Sun }> = [
  { value: "light", label: "Claro", description: "Cinza suave e cartões claros", icon: Sun },
  { value: "dark", label: "Escuro", description: "Azul-noite e detalhes dourados", icon: Moon },
  { value: "system", label: "Sistema", description: "Segue o dispositivo", icon: Monitor },
];

export default function SettingsPremium() {
  const { state, setAppearance, setNotifications } = useAppStore();
  const theme = state.appearance?.theme ?? "system";
  const notifications = state.notifications ?? { deadlines: true, exams: true, grades: true };
  const changeTheme = (next: ThemeMode) => { setAppearance({ theme: next }); storeTheme(next); applyTheme(next); };

  return <div className="settings-premium space-y-6">
    <section className="premium-surface overflow-hidden"><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">Definições</h1><span className="rounded-full border bg-muted/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">v{APP_VERSION}</span></div><p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">Preferências da aplicação, aparência, alertas e configuração académica.</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link to="/conta"><UserRound className="mr-2 h-4 w-4"/>Conta e Perfil</Link></Button><Button asChild variant="outline" size="sm"><Link to="/ajuda"><BookOpenCheck className="mr-2 h-4 w-4"/>Ajuda & Guia</Link></Button></div></div></section>

    <PushNotificationSettings />

    <section className="grid gap-4 lg:grid-cols-2">
      <Card className="premium-card"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-[hsl(var(--gold))]"/>Aparência</CardTitle></CardHeader><CardContent className="space-y-3">{THEMES.map(option=>{const Icon=option.icon,selected=theme===option.value;return <button key={option.value} type="button" onClick={()=>changeTheme(option.value)} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",selected?"border-primary bg-primary/10":"bg-card hover:bg-muted/45")}><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl",selected?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground")}><Icon className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{option.label}</span><span className="block text-xs text-muted-foreground">{option.description}</span></span>{selected&&<Check className="h-4 w-4 text-primary"/>}</button>})}</CardContent></Card>
      <Card className="premium-card"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-primary"/>Alertas dentro da aplicação</CardTitle></CardHeader><CardContent className="space-y-3"><NotificationRow title="Prazos e entregas" description="Avisos visíveis enquanto utilizas o Academic Hub." checked={notifications.deadlines} onCheckedChange={checked=>setNotifications({deadlines:checked})}/><NotificationRow title="Exames e recursos" description="Datas e proximidade das provas dentro da aplicação." checked={notifications.exams} onCheckedChange={checked=>setNotifications({exams:checked})}/><NotificationRow title="Publicação de notas" description="Datas previstas para resultados." checked={notifications.grades} onCheckedChange={checked=>setNotifications({grades:checked})}/></CardContent></Card>
    </section>

    <Card className="premium-card border-[hsl(var(--gold)/0.35)]"><CardContent className="flex items-center gap-3 p-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--gold-soft))] text-[hsl(var(--gold))]"><BookOpenCheck className="h-5 w-5"/></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold">Regulamento de avaliação em vigor</div><div className="mt-0.5 text-xs text-muted-foreground">Consulta sempre a informação oficial da UAb e o PUC de cada unidade curricular.</div></div><Button asChild variant="ghost" size="icon"><a href={REGULATION_URL} target="_blank" rel="noopener noreferrer" aria-label="Abrir informação oficial de avaliação da UAb"><ExternalLink className="h-4 w-4"/></a></Button></CardContent></Card>

    <section><div className="mb-4"><h2 className="text-lg font-semibold">Dados académicos</h2><p className="text-xs text-muted-foreground">Licenciatura, plano automático, backups locais e catálogo de cadeiras.</p></div><div className="settings-legacy [&>div>div:first-child]:hidden"><SettingsPage/></div></section>
  </div>;
}

function NotificationRow({title,description,checked,onCheckedChange}:{title:string;description:string;checked:boolean;onCheckedChange:(checked:boolean)=>void}){return <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3"><div className="min-w-0"><div className="text-sm font-medium">{title}</div><div className="mt-0.5 text-xs text-muted-foreground">{description}</div></div><Switch checked={checked} onCheckedChange={onCheckedChange}/></div>}
