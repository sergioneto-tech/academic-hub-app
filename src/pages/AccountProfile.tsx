import { useEffect, useState } from "react";
import { Check, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import CloudAccountPanel from "@/components/CloudAccountPanel";
import PageNavigationActions from "@/components/PageNavigationActions";
import { ProfileAvatar } from "@/components/ProfileAvatarEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/AppStore";
import { getDegreeAccent } from "@/lib/degreeTheme";

export default function AccountProfilePage() {
  const { state, setProfile } = useAppStore();
  const [displayName, setDisplayName] = useState(state.profile?.displayName ?? "");
  const accent = getDegreeAccent(state.degree);

  useEffect(() => setDisplayName(state.profile?.displayName ?? ""), [state.profile?.displayName]);

  const saveDisplayName = () => {
    const normalized = displayName.trim();
    setProfile({ displayName: normalized || undefined });
  };

  return (
    <div className="space-y-6">
      <PageNavigationActions />
      <section className="premium-surface overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary"/><h1 className="text-2xl font-semibold tracking-tight">Conta e Perfil</h1></div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Identificação do aluno, fotografia, conta UAb, sincronização e segurança dos dados num espaço próprio.</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/definicoes">Abrir Definições</Link></Button>
        </div>
      </section>

      <Card className="premium-card">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4 text-primary"/>Perfil do aluno</CardTitle></CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex justify-center"><ProfileAvatar className="h-28 w-28 text-2xl" editable /></div>
          <div className="space-y-4">
            <div className="rounded-2xl border bg-muted/25 p-4">
              <div className="font-semibold">{state.profile?.displayName || "Aluno"}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent.color }}/><span>{state.degree?.name || "Licenciatura não selecionada"}</span></div>
              <div className="mt-2 text-[11px] text-muted-foreground">O aro da fotografia utiliza automaticamente a cor associada à licenciatura.</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-display-name">Nome apresentado</Label>
              <div className="flex gap-2"><Input id="account-display-name" value={displayName} onChange={e=>setDisplayName(e.target.value)} onBlur={saveDisplayName} onKeyDown={e=>{if(e.key==="Enter"){saveDisplayName();e.currentTarget.blur();}}} placeholder="O teu nome"/><Button type="button" variant="secondary" size="icon" onClick={saveDisplayName} aria-label="Guardar nome"><Check className="h-4 w-4"/></Button></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400"/><div><h2 className="text-lg font-semibold">Conta Academic Hub</h2><p className="text-xs text-muted-foreground">Criação de conta, entrada, email institucional UAb, cloud, backup, sincronização e eliminação da conta.</p></div></div>
        <CloudAccountPanel />
      </section>
    </div>
  );
}
