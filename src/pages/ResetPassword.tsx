import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [ready, setReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // 1) Eventos (o link de recovery emite PASSWORD_RECOVERY)
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") {
        setHasRecoverySession(true);
      }
      if (session) {
        // Nalguns cenários a sessão já existe quando a página carrega
        setHasRecoverySession(true);
      }
      setReady(true);
    });

    // 2) Fallback: verificar sessão diretamente
    supabase.auth
      .getSession()
      .then(({ data: s }) => {
        if (cancelled) return;
        if (s?.session) setHasRecoverySession(true);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setReady(true);
      });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const canSubmit = useMemo(() => {
    return pw1.length >= 8 && pw1 === pw2;
  }, [pw1, pw2]);

  const onSave = async () => {
    if (!hasRecoverySession) {
      toast({
        title: "Link inválido",
        description: "Abre novamente o link de recuperação enviado para o teu email.",
        variant: "destructive",
      });
      return;
    }

    if (!canSubmit) {
      toast({
        title: "Verifica a password",
        description: "A password deve ter pelo menos 8 caracteres e as duas caixas devem coincidir.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;

      toast({
        title: "Password atualizada",
        description: "Já podes entrar novamente com a nova password.",
      });

      // Opcional: terminar sessão gerada pelo link de recovery
      await supabase.auth.signOut();

      navigate("/definicoes", { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast({ title: "Falha ao atualizar password", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Recuperar password</h1>
        <p className="text-xs text-muted-foreground">
          Define uma nova password para a tua conta de sincronização.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!ready ? (
            <div className="text-sm text-muted-foreground">A verificar link de recuperação...</div>
          ) : !hasRecoverySession ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                Este link não parece válido/ativo. Abre novamente o link enviado para o teu email.
              </div>
              <Button variant="secondary" onClick={() => navigate("/definicoes", { replace: true })}>
                Voltar às definições
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <Label>Nova password</Label>
                <Input value={pw1} onChange={(e) => setPw1(e.target.value)} type="password" placeholder="Mínimo 8 caracteres" />
              </div>

              <div className="grid gap-2">
                <Label>Confirmar password</Label>
                <Input value={pw2} onChange={(e) => setPw2(e.target.value)} type="password" placeholder="Repetir" />
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button onClick={onSave} disabled={!canSubmit || saving}>
                  {saving ? "A guardar..." : "Guardar nova password"}
                </Button>
                <Button variant="outline" onClick={() => navigate("/definicoes", { replace: true })}>
                  Cancelar
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                Dica: depois de alterar a password, volta ao separador Definições e faz login para reativar a sincronização neste dispositivo.
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
