import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";

export default function SetPasswordPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();

    if (p1.length < 8) {
      toast({
        title: "Senha fraca",
        description: "Use pelo menos 8 caracteres.",
        variant: "destructive",
      });
      return;
    }
    if (p1 !== p2) {
      toast({
        title: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) throw error;

      toast({ title: "Senha definida com sucesso" });
      nav("/", { replace: true });
    } catch (err: any) {
      toast({
        title: "Falha ao definir a senha",
        description: err?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4 bg-gradient-to-b from-slate-50 to-white">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Definir senha</CardTitle>
          <CardDescription>
            {loading ? "A verificar sessão…" : user ? `Conta: ${user.email}` : "Abra este ecrã a partir do link recebido por e-mail."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!user ? (
            <div className="text-sm text-muted-foreground space-y-3">
              <p>
                Para definir a senha, tem de abrir este ecrã através do link de confirmação enviado para o seu e‑mail.
              </p>
              <Button variant="outline" onClick={() => nav("/auth", { replace: true })}>
                Voltar ao Login
              </Button>
            </div>
          ) : (
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="p1">Nova senha</Label>
                <Input id="p1" type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p2">Confirmar senha</Label>
                <Input id="p2" type="password" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "A guardar…" : "Guardar senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
