import { useEffect, useState } from "react";
import {
  Bell,
  BookOpenCheck,
  Check,
  Cloud,
  ExternalLink,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";

import { ProfileAvatar } from "@/components/ProfileAvatarEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/AppStore";
import { getDegreeAccent } from "@/lib/degreeTheme";
import { applyTheme, storeTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";
import SettingsPage from "@/pages/Settings";

const REGULATION_URL = "https://diariodarepublica.pt/dr/detalhe/despacho/9792-2026-925963049";

const THEMES: Array<{ value: ThemeMode; label: string; description: string; icon: typeof Sun }> = [
  { value: "light", label: "Claro", description: "Cinza suave e cartões claros", icon: Sun },
  { value: "dark", label: "Escuro", description: "Azul-noite e detalhes dourados", icon: Moon },
  { value: "system", label: "Sistema", description: "Segue o dispositivo", icon: Monitor },
];

export default function SettingsPremium() {
  const {
    state,
    setProfile,
    setAppearance,
    setNotifications,
  } = useAppStore();

  const [displayName, setDisplayName] = useState(state.profile?.displayName ?? "");
  const accent = getDegreeAccent(state.degree);
  const theme = state.appearance?.theme ?? "system";
  const notifications = state.notifications ?? { deadlines: true, exams: true, grades: true };

  useEffect(() => {
    setDisplayName(state.profile?.displayName ?? "");
  }, [state.profile?.displayName]);

  const changeTheme = (next: ThemeMode) => {
    setAppearance({ theme: next });
    storeTheme(next);
    applyTheme(next);
  };

  const saveDisplayName = () => {
    const normalized = displayName.trim();
    setProfile({ displayName: normalized || undefined });
  };

  return (
    <div className="settings-premium space-y-6">
      <section className="premium-surface overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Definições</h1>
              <span className="rounded-full border bg-muted/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                v{APP_VERSION}
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              Personaliza o perfil e a aparência, gere os alertas e mantém todas as opções académicas, backups e sincronização num único local.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/ajuda">
              <BookOpenCheck className="mr-2 h-4 w-4" />
              Ajuda & Guia
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_1fr_1fr]">
        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4 text-primary" />
              Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 rounded-2xl border bg-muted/25 p-4">
              <ProfileAvatar className="h-20 w-20 text-xl" editable />
              <div className="min-w-0">
                <div className="font-semibold">{state.profile?.displayName || "Aluno"}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent.color }} />
                  <span className="truncate">{state.degree?.name || "Licenciatura não selecionada"}</span>
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Clica na fotografia para escolher, ajustar ou remover.
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-display-name">Nome apresentado</Label>
              <div className="flex gap-2">
                <Input
                  id="profile-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  onBlur={saveDisplayName}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      saveDisplayName();
                      event.currentTarget.blur();
                    }
                  }}
                  placeholder="O teu nome"
                />
                <Button type="button" variant="secondary" size="icon" onClick={saveDisplayName} aria-label="Guardar nome">
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-xl border px-3 py-2.5 text-xs text-muted-foreground">
              O aro da fotografia usa automaticamente a cor associada à licenciatura.
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4 text-[hsl(var(--gold))]" />
              Aparência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {THEMES.map((option) => {
              const Icon = option.icon;
              const selected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => changeTheme(option.value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    selected ? "border-primary bg-primary/10" : "bg-card hover:bg-muted/45",
                  )}
                >
                  <span className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.description}</span>
                  </span>
                  {selected && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="premium-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <NotificationRow
              title="Prazos e entregas"
              description="Avisos sobre e-fólios e outras atividades."
              checked={notifications.deadlines}
              onCheckedChange={(checked) => setNotifications({ deadlines: checked })}
            />
            <NotificationRow
              title="Exames e recursos"
              description="Datas e proximidade das provas."
              checked={notifications.exams}
              onCheckedChange={(checked) => setNotifications({ exams: checked })}
            />
            <NotificationRow
              title="Publicação de notas"
              description="Datas previstas para resultados."
              checked={notifications.grades}
              onCheckedChange={(checked) => setNotifications({ grades: checked })}
            />

            <div className="mt-4 rounded-xl border bg-muted/25 p-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="text-xs text-muted-foreground">
                  Estas preferências controlam os alertas da aplicação e acompanham os backups e a sincronização.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="premium-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Cloud className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Estado dos dados</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {state.sync?.enabled
                  ? `Sincronização ativa${state.sync.lastSyncAt ? ` · ${new Date(state.sync.lastSyncAt).toLocaleString("pt-PT")}` : ""}`
                  : "Dados guardados localmente; a sincronização é opcional."}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="premium-card border-[hsl(var(--gold)/0.35)]">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--gold-soft))] text-[hsl(var(--gold))]">
              <BookOpenCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Novo regulamento de avaliação</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Consulta o Despacho n.º 9792/2026 no Diário da República.</div>
            </div>
            <Button asChild variant="ghost" size="icon">
              <a href={REGULATION_URL} target="_blank" rel="noopener noreferrer" aria-label="Abrir Despacho n.º 9792/2026">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Dados académicos e sincronização</h2>
          <p className="text-xs text-muted-foreground">
            Licenciatura, plano automático, backups, conta cloud e catálogo completo de cadeiras.
          </p>
        </div>
        <div className="settings-legacy [&>div>div:first-child]:hidden">
          <SettingsPage />
        </div>
      </section>
    </div>
  );
}

function NotificationRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
