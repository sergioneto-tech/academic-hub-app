import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Download,
  LogIn,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Upload,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/lib/AppStore";
import type { AppState } from "@/lib/types";
import {
  type AccountMigrationStatus,
  type AuthSession,
  type CloudConfig,
  UAB_STUDENT_EMAIL_DOMAIN,
  deleteUserAccount,
  fetchRemoteState,
  getOrCreateAccountMigrationStatus,
  getStoredSession,
  isUabStudentEmail,
  refreshSession,
  requestAccountEmailChange,
  signIn,
  signUp,
  storeSession,
  upsertRemoteState,
} from "@/lib/cloudSync";
import { APP_VERSION } from "@/lib/version";

type AuthMode = "overview" | "signup" | "signin" | "confirmation";
type PendingCloudAction = "upload" | "download" | "enable" | null;

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
}

function downloadBackup(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export default function CloudAccountPanel() {
  const { state, setSync, exportData, replaceState, resetData } = useAppStore();

  const cloudConfig: CloudConfig | null = useMemo(() => {
    const u = (import.meta.env.VITE_SUPABASE_URL || "").trim();
    const k = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
    if (!u || !k) return null;
    return { supabaseUrl: u, supabaseAnonKey: k };
  }, []);

  const [session, setSession] = useState<AuthSession | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("overview");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const [migrationStatus, setMigrationStatus] = useState<AccountMigrationStatus | null>(null);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationEmail, setMigrationEmail] = useState("");
  const [migrationRequestedEmail, setMigrationRequestedEmail] = useState("");
  const [pendingCloudAction, setPendingCloudAction] = useState<PendingCloudAction>(null);

  const [cloudBusy, setCloudBusy] = useState<"upload" | "download" | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);

  const isLegacyAccount = Boolean(session && !isUabStudentEmail(session.user.email));
  const deadlineExpired = Boolean(
    migrationStatus?.deadline && new Date(migrationStatus.deadline).getTime() <= Date.now(),
  );

  const loadMigrationStatus = async (current: AuthSession) => {
    if (!cloudConfig || isUabStudentEmail(current.user.email)) {
      setMigrationStatus(null);
      return null;
    }

    try {
      const status = await getOrCreateAccountMigrationStatus(cloudConfig, current);
      setMigrationStatus(status);
      return status;
    } catch (error) {
      console.warn("[CloudAccount] Não foi possível carregar o estado de regularização:", error);
      return null;
    }
  };

  useEffect(() => {
    if (!cloudConfig) {
      setSession(null);
      return;
    }

    const stored = getStoredSession(cloudConfig);
    setSession(stored);
    if (stored) {
      setSigninEmail(stored.user.email ?? "");
      void loadMigrationStatus(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudConfig]);

  const ensureFreshSession = async () => {
    if (!cloudConfig || !session) throw new Error("Sem sessão.");
    try {
      const fresh = await refreshSession(cloudConfig, session);
      storeSession(cloudConfig, fresh);
      setSession(fresh);
      await loadMigrationStatus(fresh);
      return fresh;
    } catch {
      return session;
    }
  };

  const saveLocalBackup = () => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadBackup(`academic-hub-backup-${stamp}.json`, exportData());
    toast({ title: "Backup criado", description: "Os dados locais foram exportados em formato JSON." });
  };

  const handleSignUp = async () => {
    if (!cloudConfig) return;
    try {
      setAuthBusy(true);
      const result = await signUp(cloudConfig, signupEmail, signupPassword);
      const email = signupEmail.trim().toLowerCase();

      if (result.confirmationRequired) {
        setConfirmationEmail(email);
        setAuthMode("confirmation");
        setSignupPassword("");
        return;
      }

      if (result.session) {
        storeSession(cloudConfig, result.session);
        setSession(result.session);
        setAuthMode("overview");
        setSignupPassword("");
        toast({ title: "Conta criada", description: "A conta UAb foi criada e a sessão está ativa." });
      }
    } catch (error) {
      toast({
        title: "Não foi possível criar a conta",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignIn = async () => {
    if (!cloudConfig) return;
    try {
      setAuthBusy(true);
      const next = await signIn(cloudConfig, signinEmail, signinPassword);
      storeSession(cloudConfig, next);
      setSession(next);
      setSigninPassword("");
      setAuthMode("overview");
      const status = await loadMigrationStatus(next);

      if (!isUabStudentEmail(next.user.email)) {
        toast({
          title: "Conta em regularização",
          description: status?.deadline
            ? `Atualiza o email para @${UAB_STUDENT_EMAIL_DOMAIN} até ${formatDate(status.deadline)}.`
            : `Atualiza o email para @${UAB_STUDENT_EMAIL_DOMAIN} para manter o acesso à cloud.`,
        });
      } else {
        toast({ title: "Sessão iniciada", description: "Conta institucional UAb verificada." });
      }
    } catch (error) {
      toast({
        title: "Falha ao entrar",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = () => {
    if (!cloudConfig) return;
    storeSession(cloudConfig, null);
    setSession(null);
    setMigrationStatus(null);
    setMigrationEmail("");
    setMigrationRequestedEmail("");
    setPendingCloudAction(null);
    setSync({ enabled: false });
    setAuthMode("overview");
    toast({ title: "Sessão terminada" });
  };

  const resendConfirmation = async () => {
    if (!confirmationEmail) return;
    try {
      setAuthBusy(true);
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: confirmationEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast({ title: "Email reenviado", description: "Consulta novamente a caixa de entrada e o spam." });
    } catch (error) {
      toast({
        title: "Não foi possível reenviar",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = signinEmail.trim();
    if (!email) {
      toast({ title: "Indica o email", description: "Escreve primeiro o endereço associado à conta." });
      return;
    }

    try {
      setResetBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) console.warn("[ForgotPassword]", error);
      toast({
        title: "Pedido enviado",
        description: "Se existir uma conta com este email, receberás uma mensagem para definir uma nova password.",
      });
    } finally {
      setResetBusy(false);
    }
  };

  const requestMigration = async () => {
    if (!cloudConfig || !session) return;
    try {
      setMigrationBusy(true);
      const fresh = await ensureFreshSession();
      await requestAccountEmailChange(cloudConfig, fresh, migrationEmail);
      const normalized = migrationEmail.trim().toLowerCase();
      setMigrationRequestedEmail(normalized);
      setMigrationEmail("");
      toast({
        title: "Alteração de email iniciada",
        description: "Consulta as mensagens de confirmação enviadas pelo Supabase e conclui o processo.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível alterar o email",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setMigrationBusy(false);
    }
  };

  const verifyMigration = async () => {
    if (!cloudConfig || !session) return;
    try {
      setMigrationBusy(true);
      const fresh = await refreshSession(cloudConfig, session);
      storeSession(cloudConfig, fresh);
      setSession(fresh);

      if (isUabStudentEmail(fresh.user.email)) {
        setMigrationStatus(null);
        setMigrationRequestedEmail("");
        setPendingCloudAction(null);
        toast({ title: "Conta regularizada", description: "O email institucional UAb está agora associado à tua conta." });
      } else {
        await loadMigrationStatus(fresh);
        toast({
          title: "Confirmação ainda pendente",
          description: "O email institucional ainda não aparece confirmado. Verifica as mensagens recebidas e tenta novamente.",
        });
      }
    } catch (error) {
      toast({
        title: "Não foi possível verificar",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setMigrationBusy(false);
    }
  };

  const getLatestStateForCloud = (syncedAt: string): AppState => {
    const raw = JSON.parse(exportData()) as AppState;
    return {
      ...raw,
      meta: { ...(raw.meta ?? {}), appVersion: APP_VERSION },
      sync: { ...(raw.sync ?? { enabled: true }), enabled: true, lastSyncAt: syncedAt },
    };
  };

  const executeCloudAction = async (action: Exclude<PendingCloudAction, null>) => {
    if (!cloudConfig || !session) return;

    if (action === "enable") {
      setSync({ enabled: true });
      toast({
        title: isLegacyAccount ? "Sincronização manual disponível" : "Sincronização ativada",
        description: isLegacyAccount
          ? "A sincronização automática fica pausada até regularizares o email. Durante o prazo podes usar upload/download manualmente."
          : "A sincronização automática está ativa.",
      });
      return;
    }

    try {
      setCloudBusy(action);
      const fresh = await ensureFreshSession();

      if (action === "upload") {
        const syncedAt = new Date().toISOString();
        const stateForCloud = getLatestStateForCloud(syncedAt);
        await upsertRemoteState(cloudConfig, fresh, stateForCloud);
        replaceState(stateForCloud);
        toast({ title: "Upload concluído", description: `Dados guardados na cloud em ${new Date(syncedAt).toLocaleString("pt-PT")}.` });
      } else {
        const remote = await fetchRemoteState(cloudConfig, fresh);
        if (!remote?.state) {
          toast({ title: "Sem dados na cloud", description: "Ainda não existem dados guardados para esta conta." });
          return;
        }

        const downloadedAt = new Date().toISOString();
        const remoteState = remote.state as AppState;
        replaceState({
          ...remoteState,
          meta: { ...(remoteState.meta ?? {}), appVersion: APP_VERSION },
          sync: { ...(remoteState.sync ?? { enabled: true }), enabled: true, lastSyncAt: downloadedAt },
        });
        toast({ title: "Download concluído", description: "Os dados da cloud foram aplicados neste dispositivo." });
      }
    } catch (error) {
      toast({
        title: action === "upload" ? "Falha no upload" : "Falha no download",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setCloudBusy(null);
    }
  };

  const requestCloudAction = async (action: Exclude<PendingCloudAction, null>) => {
    if (!session) {
      setAuthMode("signin");
      toast({ title: "Inicia sessão primeiro", description: "É necessária uma conta para utilizar a cloud." });
      return;
    }

    if (!isUabStudentEmail(session.user.email)) {
      await loadMigrationStatus(session);
      setPendingCloudAction(action);
      return;
    }

    await executeCloudAction(action);
  };

  const continueLegacyAction = async () => {
    if (!pendingCloudAction || deadlineExpired) return;
    const action = pendingCloudAction;
    setPendingCloudAction(null);
    await executeCloudAction(action);
  };

  const handleSyncToggle = async (checked: boolean) => {
    if (!checked) {
      setSync({ enabled: false });
      return;
    }
    await requestCloudAction("enable");
  };

  const handleDeleteAccount = async () => {
    if (!cloudConfig || !session || deleteConfirmation !== "apagar") return;
    try {
      setDeleting(true);
      const fresh = await ensureFreshSession();
      await deleteUserAccount(cloudConfig, fresh);
      storeSession(cloudConfig, null);
      setSession(null);
      resetData();
      setDeleteMode(false);
      setDeleteConfirmation("");
      toast({ title: "Conta eliminada", description: "A conta e os dados associados foram eliminados." });
    } catch (error) {
      toast({
        title: "Falha ao eliminar conta",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!cloudConfig) {
    return (
      <Card className="premium-card border-destructive/35">
        <CardHeader><CardTitle className="text-base">Conta e sincronização</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Sincronização indisponível: falta configuração do servidor.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="premium-card overflow-hidden">
      <CardHeader className="border-b bg-muted/20">
        <CardTitle className="flex items-center gap-2 text-base">
          <Cloud className="h-4 w-4 text-primary" />
          Conta e sincronização
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 p-4 sm:p-5">
        {!session && authMode === "overview" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="space-y-1.5">
                  <div className="font-semibold">Conta Academic Hub</div>
                  <p className="text-sm text-muted-foreground">
                    A conta permite guardar os teus dados na cloud e utilizá-los em vários dispositivos. O registo é exclusivo para estudantes da Universidade Aberta.
                  </p>
                  <div className="inline-flex rounded-lg border bg-background px-2.5 py-1.5 text-xs font-semibold">
                    Email aceite: @{UAB_STUDENT_EMAIL_DOMAIN}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setAuthMode("signup")}>
                <UserPlus className="mr-2 h-4 w-4" />
                Criar conta
              </Button>
              <Button variant="outline" onClick={() => setAuthMode("signin")}>
                <LogIn className="mr-2 h-4 w-4" />
                Já tenho conta / Entrar
              </Button>
            </div>
          </div>
        )}

        {!session && authMode === "signup" && (
          <div className="space-y-4">
            <div>
              <div className="font-semibold">Criar conta de estudante</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Utiliza o endereço institucional @{UAB_STUDENT_EMAIL_DOMAIN}. A password mantém o padrão atual: mínimo de 8 caracteres.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="uab-signup-email">Email institucional</Label>
                <Input id="uab-signup-email" type="email" value={signupEmail} onChange={(event) => setSignupEmail(event.target.value)} placeholder={`aluno@${UAB_STUDENT_EMAIL_DOMAIN}`} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="uab-signup-password">Password</Label>
                <Input id="uab-signup-password" type="password" value={signupPassword} onChange={(event) => setSignupPassword(event.target.value)} placeholder="Mínimo 8 caracteres" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSignUp} disabled={authBusy}>{authBusy ? "A criar..." : "Criar conta"}</Button>
              <Button variant="outline" onClick={() => { setAuthMode("overview"); setSignupPassword(""); }} disabled={authBusy}>Cancelar</Button>
            </div>
          </div>
        )}

        {!session && authMode === "confirmation" && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-start gap-3">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0 space-y-3">
                <div>
                  <div className="font-semibold">Confirma o teu email</div>
                  <p className="mt-1 text-sm text-muted-foreground">Enviámos uma mensagem de confirmação para:</p>
                  <div className="mt-1 break-all text-sm font-semibold">{confirmationEmail}</div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Abre o email institucional e seleciona o link de confirmação para concluir o registo. Verifica também a pasta de spam/lixo eletrónico.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={resendConfirmation} disabled={authBusy}>{authBusy ? "A reenviar..." : "Reenviar email"}</Button>
                  <Button variant="outline" onClick={() => { setSignupEmail(confirmationEmail); setAuthMode("signup"); }}>Utilizar outro endereço</Button>
                  <Button variant="ghost" onClick={() => { setSigninEmail(confirmationEmail); setAuthMode("signin"); }}>Já confirmei / Entrar</Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!session && authMode === "signin" && (
          <div className="space-y-4">
            <div>
              <div className="font-semibold">Entrar na conta</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Contas antigas com outros domínios continuam a poder entrar para regularizar o endereço sem perder dados.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="cloud-signin-email">Email</Label>
                <Input id="cloud-signin-email" type="email" value={signinEmail} onChange={(event) => setSigninEmail(event.target.value)} placeholder="teu@email.com" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cloud-signin-password">Password</Label>
                <Input id="cloud-signin-password" type="password" value={signinPassword} onChange={(event) => setSigninPassword(event.target.value)} placeholder="••••••••" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSignIn} disabled={authBusy}>{authBusy ? "A entrar..." : "Entrar"}</Button>
              <Button variant="outline" onClick={() => { setAuthMode("overview"); setSigninPassword(""); }} disabled={authBusy}>Cancelar</Button>
              <Button variant="link" className="h-auto px-1 text-xs" onClick={handleForgotPassword} disabled={resetBusy || !signinEmail.trim()}>
                {resetBusy ? "A enviar..." : "Esqueci-me da password"}
              </Button>
            </div>
          </div>
        )}

        {session && (
          <>
            <div className="flex flex-col gap-3 rounded-xl border bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Conta ligada</div>
                <div className="break-all text-sm font-semibold">{session.user.email || "Email não disponível"}</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {isLegacyAccount ? (
                    <span className="font-medium text-amber-700 dark:text-amber-300">Regularização necessária</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Email UAb verificado</span>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>Sair</Button>
            </div>

            {isLegacyAccount && (
              <div className={`rounded-xl border p-4 ${deadlineExpired ? "border-destructive/45 bg-destructive/10" : "border-amber-500/40 bg-amber-500/10"}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${deadlineExpired ? "text-destructive" : "text-amber-700 dark:text-amber-300"}`} />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <div className="font-semibold">{deadlineExpired ? "Acesso à cloud suspenso" : "A tua conta necessita de regularização"}</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Esta conta foi criada com um endereço que não pertence à Universidade Aberta. Associa o teu email institucional @{UAB_STUDENT_EMAIL_DOMAIN} para manteres a sincronização.
                      </p>
                      {migrationStatus?.deadline && (
                        <p className={`mt-2 text-sm font-semibold ${deadlineExpired ? "text-destructive" : "text-amber-800 dark:text-amber-200"}`}>
                          {deadlineExpired
                            ? `O prazo terminou em ${formatDate(migrationStatus.deadline)}.`
                            : `Prazo para regularização: ${formatDate(migrationStatus.deadline)}.`}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Os teus dados locais não são eliminados. Depois do prazo, upload e download ficam suspensos até o email institucional ser confirmado.
                      </p>
                    </div>

                    {migrationRequestedEmail ? (
                      <div className="rounded-lg border bg-background/70 p-3">
                        <div className="text-sm font-medium">Alteração pedida para {migrationRequestedEmail}</div>
                        <p className="mt-1 text-xs text-muted-foreground">Conclui as confirmações recebidas por email e depois verifica o estado.</p>
                        <Button className="mt-3" size="sm" variant="secondary" onClick={verifyMigration} disabled={migrationBusy}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {migrationBusy ? "A verificar..." : "Já confirmei — verificar"}
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                        <div className="grid gap-1.5">
                          <Label htmlFor="migration-uab-email">Novo email institucional</Label>
                          <Input id="migration-uab-email" type="email" value={migrationEmail} onChange={(event) => setMigrationEmail(event.target.value)} placeholder={`aluno@${UAB_STUDENT_EMAIL_DOMAIN}`} />
                        </div>
                        <Button onClick={requestMigration} disabled={migrationBusy || !migrationEmail.trim()}>
                          {migrationBusy ? "A iniciar..." : "Atualizar para email UAb"}
                        </Button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={saveLocalBackup}>
                        <Download className="mr-2 h-4 w-4" />
                        Criar backup
                      </Button>
                      {pendingCloudAction && !deadlineExpired && (
                        <Button variant="secondary" onClick={continueLegacyAction}>
                          Continuar desta vez
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Sincronização</div>
                  <div className="text-xs text-muted-foreground">
                    {isLegacyAccount
                      ? "A sincronização automática fica pausada enquanto a conta não for regularizada."
                      : "Mantém os dados atualizados automaticamente após alterações."}
                  </div>
                </div>
                <Switch checked={Boolean(state.sync?.enabled)} onCheckedChange={handleSyncToggle} />
              </div>

              {state.sync?.lastSyncAt && (
                <div className="text-xs text-muted-foreground">Última sincronização: {new Date(state.sync.lastSyncAt).toLocaleString("pt-PT")}</div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void requestCloudAction("upload")} disabled={cloudBusy !== null}>
                  <Upload className="mr-2 h-4 w-4" />
                  {cloudBusy === "upload" ? "A guardar..." : "Guardar na cloud"}
                </Button>
                <Button variant="outline" onClick={() => void requestCloudAction("download")} disabled={cloudBusy !== null}>
                  <Download className="mr-2 h-4 w-4" />
                  {cloudBusy === "download" ? "A carregar..." : "Carregar da cloud"}
                </Button>
                <Button variant="ghost" onClick={saveLocalBackup}>Backup local</Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-destructive">Zona de perigo</div>
                <p className="mt-1 text-xs text-muted-foreground">Eliminar permanentemente a conta e os dados cloud associados.</p>
              </div>
              {!deleteMode ? (
                <Button variant="destructive" onClick={() => setDeleteMode(true)}>Eliminar conta</Button>
              ) : (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <Label htmlFor="delete-cloud-account">Escreve “apagar” para confirmar:</Label>
                  <Input id="delete-cloud-account" className="mt-2" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="apagar" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleteConfirmation !== "apagar" || deleting}>
                      {deleting ? "A eliminar..." : "Eliminar permanentemente"}
                    </Button>
                    <Button variant="outline" onClick={() => { setDeleteMode(false); setDeleteConfirmation(""); }} disabled={deleting}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
