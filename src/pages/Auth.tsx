import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { supabase, setRememberMe } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

function isValidStudentEmail(email: string) {
  const e = email.trim().toLowerCase();
  return e.endsWith("@estudante.uab.pt") && e.length > "@estudante.uab.pt".length;
}

function baseUrl() {
  // For HashRouter: redirect URL must include the route after "#/"
  return `${window.location.origin}${window.location.pathname}`;
}

export default function AuthPage() {
  const nav = useNavigate();
  const { user } = useAuth();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [remember, setRemember] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  const [regEmail, setRegEmail] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const alreadySignedIn = useMemo(() => !!user, [user]);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidStudentEmail(loginEmail)) {
      toast({
        title: "E-mail inválido",
        description:
          "O e-mail tem de terminar em @estudante.uab.pt. Se não tem este domínio, não é aluno da UAb.",
        variant: "destructive",
      });
      return;
    }

    setRememberMe(remember);

    setLoginLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPass,
      });
      if (error) throw error;

      toast({ title: "Sessão iniciada" });
      nav("/", { replace: true });
    } catch (err: any) {
      toast({
        title: "Falha no login",
        description: err?.message ?? "Verifique o e-mail e a senha.",
        variant: "destructive",
      });
    } finally {
      setLoginLoading(false);
    }
  }

  async function doRegister(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidStudentEmail(regEmail)) {
      toast({
        title: "E-mail inválido",
        description:
          "O e-mail tem de terminar em @estudante.uab.pt. Se não tem este domínio, não é aluno da UAb.",
        variant: "destructive",
      });
      return;
    }

    setRegLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: regEmail.trim(),
        options: {
          emailRedirectTo: `${baseUrl()}#/set-password`,
        },
      });
      if (error) throw error;

      toast({
        title: "Verifique o seu e-mail",
        description:
          "Enviámos um link de confirmação/ativação. Depois de clicar, vai poder definir a sua senha de acesso.",
      });
    } catch (err: any) {
      toast({
        title: "Falha no registo",
        description: err?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setRegLoading(false);
    }
  }

  async function doReset(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidStudentEmail(resetEmail)) {
      toast({
        title: "E-mail inválido",
        description:
          "O e-mail tem de terminar em @estudante.uab.pt. Se não tem este domínio, não é aluno da UAb.",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${baseUrl()}#/reset-password`,
      });
      if (error) throw error;

      toast({
        title: "E-mail enviado",
        description:
          "Verifique a sua caixa de correio e clique no link para definir uma nova senha.",
      });
    } catch (err: any) {
      toast({
        title: "Falha ao pedir alteração de senha",
        description: err?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  }

  async function doSignOut() {
    try {
      await supabase.auth.signOut();
      toast({ title: "Sessão terminada" });
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-to-b from-slate-50 to-white">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Academic Hub</CardTitle>
          <CardDescription>
            {alreadySignedIn ? (
              <span>
                Está autenticado como <span className="font-medium">{user?.email}</span>.
              </span>
            ) : (
              "Login, registo e alteração de senha (apenas para @estudante.uab.pt)."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alreadySignedIn ? (
            <div className="space-y-3">
              <Button onClick={() => nav("/", { replace: true })} className="w-full">
                Ir para o Dashboard
              </Button>
              <Button onClick={doSignOut} variant="outline" className="w-full">
                Sair
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="registar">Registar</TabsTrigger>
                <TabsTrigger value="senha">Alterar senha</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={doLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="loginEmail">E-mail</Label>
                    <Input
                      id="loginEmail"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="nome@estudante.uab.pt"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loginPass">Senha</Label>
                    <Input
                      id="loginPass"
                      type="password"
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                    Guardar sessão neste dispositivo
                  </label>

                  <Button type="submit" className="w-full" disabled={loginLoading}>
                    {loginLoading ? "A entrar…" : "Entrar"}
                  </Button>

                  <div className="text-xs text-muted-foreground">
                    Nota: para registo com confirmação por e-mail, use a aba “Registar”.
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="registar">
                <form onSubmit={doRegister} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="regEmail">E-mail</Label>
                    <Input
                      id="regEmail"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="nome@estudante.uab.pt"
                      autoComplete="email"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={regLoading}>
                    {regLoading ? "A enviar…" : "Enviar link de confirmação"}
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    Após clicar no link recebido, a app vai pedir para definir a senha (pode ser a mesma da UAb).
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="senha">
                <form onSubmit={doReset} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="resetEmail">E-mail</Label>
                    <Input
                      id="resetEmail"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="nome@estudante.uab.pt"
                      autoComplete="email"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={resetLoading}>
                    {resetLoading ? "A enviar…" : "Enviar link para nova senha"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
