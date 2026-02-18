import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAppStore } from "@/lib/AppStore";
import { DEGREE_OPTIONS, getDegreeOptionById, getPlanCoursesForDegree, getCourseEcts, getCourseArea, type PlanCourseSeed } from "@/lib/uabPlan";
import type { Course } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  type CloudConfig,
  type AuthSession,
  fetchRemoteState,
  getStoredSession,
  refreshSession,
  signIn,
  signUp,
  storeSession,
  upsertRemoteState,
  deleteUserAccount,
} from "@/lib/cloudSync";

// Input numérico com estado local - só grava no blur
function NumericInput({
  value,
  min,
  max,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (v: number) => void;
}) {
  const [txt, setTxt] = useState(String(value));

  useEffect(() => {
    setTxt(String(value));
  }, [value]);

  const handleBlur = useCallback(() => {
    const num = parseInt(txt, 10);
    if (isNaN(num) || num < min || num > max) {
      // Revert to original value
      setTxt(String(value));
    } else if (num !== value) {
      onCommit(num);
    }
  }, [txt, min, max, value, onCommit]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-12 h-7 px-1.5 py-0.5 text-xs"
    />
  );
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function pluralCadeiras(n: number) {
  return n === 1 ? "cadeira" : "cadeiras";
}

function SemesterPanel({
  title,
  courses,
  orderMap,
  planCourses,
  onUpdate,
  onRemove,
}: {
  title: string;
  courses: Course[];
  orderMap: Map<string, number>;
  planCourses: PlanCourseSeed[];
  onUpdate: (courseId: string, patch: Partial<Course>) => void;
  onRemove: (courseId: string) => void;
}) {
  const sorted = useMemo(() => {
    const copy = [...courses];
    copy.sort((a, b) => {
      const ia = orderMap.get((a.code || "").trim());
      const ib = orderMap.get((b.code || "").trim());
      if (ia !== undefined && ib !== undefined && ia !== ib) return ia - ib;
      if (ia !== undefined && ib === undefined) return -1;
      if (ia === undefined && ib !== undefined) return 1;
      return (a.code || "").localeCompare(b.code || "", "pt-PT");
    });
    return copy;
  }, [courses, orderMap]);

  return (
    <div className="rounded-lg border">
      <div className="border-b bg-muted/30 px-3 py-1.5 text-xs font-semibold">{title}</div>

      <div className="space-y-2 p-2">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Sem cadeiras neste semestre.
          </div>
        ) : (
          sorted.map((c) => {
            const completed = Boolean(c.isCompleted);
            return (
              <div
                key={c.id}
                className={[
                  "rounded-lg border p-2.5",
                  completed
                    ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-700/50 dark:bg-emerald-900/25 dark:ring-1 dark:ring-emerald-700/15"
                    : "bg-card",
                ].join(" ")}
              >
                <div className="flex flex-col gap-1.5">
                  {/* Row 1: Code + Name */}
                  <div className="flex gap-2">
                    <div className="w-20 shrink-0">
                      <Input className="h-7 px-1.5 py-0.5 text-xs" value={c.code} onChange={(e) => onUpdate(c.id, { code: e.target.value })} placeholder="Código" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Input className="h-7 px-1.5 py-0.5 text-xs" value={c.name} onChange={(e) => onUpdate(c.id, { name: e.target.value })} placeholder="Nome" />
                    </div>
                  </div>

                  {/* Row 2: Year, Sem, ECTS, Area, toggles, remove */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Ano</span>
                      <NumericInput value={c.year ?? 1} min={1} max={6} onCommit={(v) => onUpdate(c.id, { year: v })} />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Sem</span>
                      <NumericInput value={c.semester ?? 1} min={1} max={2} onCommit={(v) => onUpdate(c.id, { semester: v })} />
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">{getCourseEcts(planCourses, c.code)} ECTS</span>
                    {getCourseArea(planCourses, c.code) && (
                      <span className="text-[10px] italic text-muted-foreground">{getCourseArea(planCourses, c.code)}</span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <Switch className="scale-75" checked={Boolean(c.isActive)} onCheckedChange={(v) => onUpdate(c.id, { isActive: v })} />
                      <span className="text-[10px] font-medium">Ativa</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Switch
                        className="scale-75"
                        checked={Boolean(c.isCompleted)}
                        onCheckedChange={(v) =>
                          onUpdate(c.id, {
                            isCompleted: v,
                            completedAt: v ? (c.completedAt ?? new Date().toISOString()) : undefined,
                            isActive: v ? false : c.isActive,
                          })
                        }
                      />
                      <span className="text-[10px] font-medium">Concluída</span>
                    </div>

                    {completed && (
                      <span className="text-[10px] text-muted-foreground">
                        {c.completedAt ? new Date(c.completedAt).toLocaleDateString("pt-PT") : ""}
                      </span>
                    )}

                    <Button variant="destructive" size="sm" className="h-6 px-2 text-[10px] ml-auto" onClick={() => onRemove(c.id)}>
                      ✕
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function YearBlock({
  year,
  sem1,
  sem2,
  orderMap,
  planCourses,
  onUpdate,
  onRemove,
}: {
  year: number;
  sem1: Course[];
  sem2: Course[];
  orderMap: Map<string, number>;
  planCourses: PlanCourseSeed[];
  onUpdate: (courseId: string, patch: Partial<Course>) => void;
  onRemove: (courseId: string) => void;
}) {
  const totalYear = sem1.length + sem2.length;

  return (
    <div className="rounded-xl border p-3 md:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-base font-semibold">{year}º Ano</div>
        <div className="text-xs text-muted-foreground">
          {totalYear} {pluralCadeiras(totalYear)}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <SemesterPanel title="1º Semestre" courses={sem1} orderMap={orderMap} planCourses={planCourses} onUpdate={onUpdate} onRemove={onRemove} />
        <SemesterPanel title="2º Semestre" courses={sem2} orderMap={orderMap} planCourses={planCourses} onUpdate={onUpdate} onRemove={onRemove} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const { state, setDegree, mergePlanCourses, addCourse, updateCourse, removeCourse, exportData, importData, replaceState, resetData, setSync } =
    useAppStore();

  const currentDegreeId = state.degree?.id ?? "";

  const NONE = "__none__";
  const [selectedDegreeId, setSelectedDegreeId] = useState<string>(currentDegreeId || NONE);

  useEffect(() => {
    setSelectedDegreeId(currentDegreeId || NONE);
  }, [currentDegreeId]);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const exchangedCodeRef = useRef<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // --- Sincronização (opcional) ---
  const [syncEnabledLocal, setSyncEnabledLocal] = useState<boolean>(() => Boolean(state.sync?.enabled));
  const [cloudEmail, setCloudEmail] = useState<string>("");
  const [cloudPass, setCloudPass] = useState<string>("");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [resetBusy, setResetBusy] = useState<boolean>(false);

  // --- Recuperação de password (Supabase Auth) ---
  const [recoveryMode, setRecoveryMode] = useState<boolean>(false);
  const [recoveryReady, setRecoveryReady] = useState<boolean>(true);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean>(false);
  const [newPw1, setNewPw1] = useState<string>("");
  const [newPw2, setNewPw2] = useState<string>("");
  const [savingRecovery, setSavingRecovery] = useState<boolean>(false);

  // --- Exclusao de conta ---
  const [deleteAccountMode, setDeleteAccountMode] = useState<boolean>(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string>("");
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);

  useEffect(() => {
    setSyncEnabledLocal(Boolean(state.sync?.enabled));
  }, [state.sync?.enabled]);

  // Configuração do servidor (centralizada). Para escalar para outros estudantes,
  // o backend deve ser único e controlado pelo administrador da app.
  const cloudConfig: CloudConfig | null = useMemo(() => {
    const u = (import.meta.env.VITE_SUPABASE_URL || "").trim();
    const k = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
    if (!u || !k) return null;
    return { supabaseUrl: u, supabaseAnonKey: k };
  }, []);

  // Carregar sessão guardada (se existir)
  useEffect(() => {
    if (!cloudConfig) {
      setSession(null);
      return;
    }
    setSession(getStoredSession(cloudConfig));
  }, [cloudConfig]);

  // Se o link de recuperação cair no Dashboard (/) ou noutro separador,
  // o Layout redireciona para /definicoes?recovery=1 e esta secção trata do resto.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const wantsRecovery = params.get("recovery") === "1" || window.location.hash.includes("type=recovery");

    if (!wantsRecovery) {
      setRecoveryMode(false);
      setHasRecoverySession(false);
      setRecoveryReady(true);
      return;
    }

    setRecoveryMode(true);
    setRecoveryReady(false);

    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") setHasRecoverySession(true);
      if (s) setHasRecoverySession(true);
    });

    (async () => {
      // PKCE: por vezes chega com ?code=...
      try {
        const code = params.get("code");
        if (code && exchangedCodeRef.current !== code) {
          exchangedCodeRef.current = code;
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.warn("[PasswordRecovery][exchangeCodeForSession]", error);
        }
      } catch (e) {
        console.warn("[PasswordRecovery][exchangeCodeForSession]", e);
      }

      // Fallback: verificar sessão
      try {
        const { data } = await supabase.auth.getSession();
        if (!cancelled && data?.session) setHasRecoverySession(true);
      } catch {
        // ignore
      }

      if (!cancelled) setRecoveryReady(true);
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [location.search, location.hash]);

  const canSaveRecovery = useMemo(() => newPw1.length >= 8 && newPw1 === newPw2, [newPw1, newPw2]);

  const clearRecoveryUrl = () => {
    navigate({ pathname: "/definicoes", search: "", hash: "" }, { replace: true });
  };

  const onSaveNewPassword = async () => {
    if (!hasRecoverySession) {
      toast({
        title: "Link inválido",
        description: "Abre novamente o link de recuperação enviado para o teu email.",
        variant: "destructive",
      });
      return;
    }

    if (!canSaveRecovery) {
      toast({
        title: "Verifica a password",
        description: "A password deve ter pelo menos 8 caracteres e as duas caixas devem coincidir.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingRecovery(true);
      const { error } = await supabase.auth.updateUser({ password: newPw1 });
      if (error) throw error;

      toast({
        title: "Password atualizada",
        description: "Já podes entrar novamente com a nova password.",
      });

      // Terminar sessão criada pelo link e limpar a sessão local da sincronização
      await supabase.auth.signOut();
      if (cloudConfig) storeSession(cloudConfig, null);
      setSession(null);

      setNewPw1("");
      setNewPw2("");
      clearRecoveryUrl();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast({ title: "Falha ao atualizar password", description: msg, variant: "destructive" });
    } finally {
      setSavingRecovery(false);
    }
  };

  const selectedOpt = useMemo(() => getDegreeOptionById(selectedDegreeId), [selectedDegreeId]);

  const planSeeds = useMemo(() => (state.degree ? getPlanCoursesForDegree(state.degree) : []), [state.degree]);
  const orderMap = useMemo(() => {
    const m = new Map<string, number>();
    planSeeds.forEach((s, idx) => {
      const code = (s.code || "").trim();
      if (!code) return;
      if (!m.has(code)) m.set(code, idx);
    });
    return m;
  }, [planSeeds]);

  const canAutoLoadPlan = useMemo(() => !!state.degree && planSeeds.length > 0, [state.degree, planSeeds.length]);

  const grouped = useMemo(() => {
    return state.courses.reduce((acc, c) => {
      const y = Number(c.year) || 0;
      const s = c.semester === 2 ? 2 : 1;
      if (!acc[y]) acc[y] = { 1: [], 2: [] };
      acc[y][s].push(c);
      return acc;
    }, {} as Record<number, { 1: Course[]; 2: Course[] }>);
  }, [state.courses]);

  const years = useMemo(() => {
    return Object.keys(grouped)
      .map(Number)
      .filter((y) => y > 0)
      .sort((a, b) => a - b);
  }, [grouped]);

  const applyDegree = () => {
    if (!selectedOpt) return;
    setDegree({ id: selectedOpt.id, name: selectedOpt.name });
  };

  const importPlan = () => {
    // If degree not saved yet, save it first
    if (selectedOpt && (!state.degree || state.degree.id !== selectedOpt.id)) {
      setDegree({ id: selectedOpt.id, name: selectedOpt.name });
    }
    const deg = selectedOpt ? { id: selectedOpt.id, name: selectedOpt.name } : state.degree;
    if (!deg) return;
    const seeds = getPlanCoursesForDegree(deg);
    if (seeds.length === 0) return;
    mergePlanCourses(seeds);
  };

  const clearDegree = () => {
    setDegree(null);
    setSelectedDegreeId(NONE);
  };

  const onExport = () => {
    const json = exportData();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadText(`academic-hub-backup-${stamp}.json`, json);
  };

  const onImportClick = () => fileRef.current?.click();

  const onImportFile = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const res = importData(text);
      if (!res.ok) setImportError("error" in res ? res.error : "Erro desconhecido");
    } catch {
      setImportError("Não foi possível ler o ficheiro.");
    }
  };

  const saveCloudSettings = () => {
    setSync({ enabled: syncEnabledLocal });
    toast({ title: "Definições guardadas", description: "Sincronização atualizada." });
  };

  const ensureFreshSession = async () => {
    if (!cloudConfig || !session) throw new Error("Sem sessão.");
    // Refresh simples (útil quando o token expira).
    try {
      const next = await refreshSession(cloudConfig, session);
      storeSession(cloudConfig, next);
      setSession(next);
      return next;
    } catch {
      return session;
    }
  };

  const onSignUp = async () => {
    if (!cloudConfig) {
      toast({ title: "Sincronização indisponível", description: "Falta configuração do servidor (Supabase).", variant: "destructive" });
      return;
    }
    try {
      const result = await signUp(cloudConfig, cloudEmail.trim(), cloudPass);
      if (result.confirmationRequired) {
        toast({
          title: "Verifica o teu email",
          description: "Foi enviado um link de confirmação para o teu email. Clica nele e depois volta aqui para fazer login.",
        });
        return;
      }
      if (result.session) {
        storeSession(cloudConfig, result.session);
        setSession(result.session);
        toast({ title: "Conta criada", description: "Conta criada e sessão iniciada." });
      }
    } catch (e) {
      toast({ title: "Falha ao criar conta", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    }
  };

  const onSignIn = async () => {
    if (!cloudConfig) {
      toast({ title: "Sincronização indisponível", description: "Falta configuração do servidor (Supabase).", variant: "destructive" });
      return;
    }
    try {
      const s = await signIn(cloudConfig, cloudEmail.trim(), cloudPass);
      storeSession(cloudConfig, s);
      setSession(s);
      toast({ title: "Sessão iniciada", description: "Login efetuado." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      const isUnconfirmed = msg.toLowerCase().includes("email not confirmed") || msg.toLowerCase().includes("email_not_confirmed");
      if (isUnconfirmed) {
        toast({
          title: "Email não confirmado",
          description: "Precisas de clicar no link de confirmação enviado para o teu email antes de poderes entrar.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Falha ao entrar", description: msg, variant: "destructive" });
      }
    }
  };

  const onSignOut = () => {
    if (!cloudConfig) return;
    storeSession(cloudConfig, null);
    setSession(null);
    toast({ title: "Sessão terminada" });
  };

  const onForgotPassword = async () => {
    if (!cloudConfig) {
      toast({ title: "Sincronização indisponível", description: "Falta configuração do servidor (Supabase).", variant: "destructive" });
      return;
    }
    const email = cloudEmail.trim();
    if (!email) {
      toast({ title: "Indica o email", description: "Escreve o teu email e volta a tentar.", variant: "destructive" });
      return;
    }

    try {
      setResetBusy(true);
      // Nota: mesmo que o Supabase ignore o redirect (URL não autorizada), o link vem com type=recovery
      // e o Layout vai redirecionar para este separador automaticamente.
      // O redirect aponta para a raiz — o main.tsx intercepta os tokens do hash
      // e redireciona automaticamente para #/definicoes?recovery=1
      const redirectTo = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      // Não revelar se o email existe (evita enumeração de contas)
      if (error) {
        console.warn("[ForgotPassword]", error);
      }

      toast({
        title: "Email enviado (se existir conta)",
        description: "Se existir uma conta com este email, vais receber uma mensagem para definires uma nova password (verifica também o spam).",
      });
    } catch (e) {
      // Mantém resposta genérica
      toast({
        title: "Pedido enviado (se existir conta)",
        description: "Se existir uma conta com este email, vais receber uma mensagem para definires uma nova password.",
      });
    } finally {
      setResetBusy(false);
    }
  };

  const onUploadToCloud = async () => {
    if (!cloudConfig || !session) {
      toast({ title: "Sem sessão", description: "Faz login primeiro.", variant: "destructive" });
      return;
    }
    try {
      const fresh = await ensureFreshSession();
      await upsertRemoteState(cloudConfig, fresh, state);
      setSync({ lastSyncAt: new Date().toISOString() });
      toast({ title: "Upload concluído", description: "Dados locais guardados na cloud." });
    } catch (e) {
      toast({ title: "Falha no upload", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    }
  };

  const onDownloadFromCloud = async () => {
    if (!cloudConfig || !session) {
      toast({ title: "Sem sessão", description: "Faz login primeiro.", variant: "destructive" });
      return;
    }
    try {
      const fresh = await ensureFreshSession();
      const remote = await fetchRemoteState(cloudConfig, fresh);
      if (!remote?.state) {
        toast({ title: "Sem dados na cloud", description: "Ainda não há dados guardados para esta conta." });
        return;
      }
      // Merge sync timestamp into the cloud data before replacing state
      // (avoids race condition between replaceState and setSync)
      const rawWithSync = {
        ...(remote.state as Record<string, unknown>),
        sync: {
          ...((remote.state as Record<string, unknown>)?.sync as Record<string, unknown> ?? {}),
          enabled: true,
          lastSyncAt: new Date().toISOString(),
        },
      };
      replaceState(rawWithSync);
      toast({ title: "Download concluído", description: "Dados da cloud aplicados neste dispositivo." });
    } catch (e) {
      toast({ title: "Falha no download", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    }
  };

  const onDeleteAccount = async () => {
    if (!cloudConfig || !session) {
      toast({ title: "Sem sessao", description: "Faz login primeiro.", variant: "destructive" });
      return;
    }

    if (deleteConfirmation !== "apagar") {
      toast({ title: "Confirmacao invalida", description: "Escreve 'apagar' para confirmar.", variant: "destructive" });
      return;
    }

    try {
      setDeletingAccount(true);
      const fresh = await ensureFreshSession();
      await deleteUserAccount(cloudConfig, fresh);

      storeSession(cloudConfig, null);
      setSession(null);
      resetData();
      setDeleteAccountMode(false);
      setDeleteConfirmation("");

      toast({
        title: "Conta eliminada",
        description: "A tua conta e todos os dados associados foram eliminados permanentemente.",
      });

      setTimeout(() => navigate("/"), 2000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast({ title: "Falha ao eliminar conta", description: msg, variant: "destructive" });
    } finally {
      setDeletingAccount(false);
    }
  };

  const onAddCourse = () => {
    addCourse({ code: "", name: "", year: 1, semester: 1 });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Definições</h1>
            <p className="text-xs text-muted-foreground">
              Licenciatura, catálogo de cadeiras, backups e preferências. <span className="ml-1">v{APP_VERSION}</span>
            </p>
          </div>
        </div>
      </div>

      {recoveryMode && (
        <Card>
          <CardHeader>
            <CardTitle>Recuperar password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!recoveryReady ? (
              <div className="text-sm text-muted-foreground">A verificar link de recuperação...</div>
            ) : !hasRecoverySession ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  Este link não parece válido/ativo. Abre novamente o link enviado para o teu email.
                </div>
                <Button variant="secondary" onClick={clearRecoveryUrl}>
                  Fechar
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label>Nova password</Label>
                  <Input value={newPw1} onChange={(e) => setNewPw1(e.target.value)} type="password" placeholder="Mínimo 8 caracteres" />
                </div>

                <div className="grid gap-2">
                  <Label>Confirmar password</Label>
                  <Input value={newPw2} onChange={(e) => setNewPw2(e.target.value)} type="password" placeholder="Repetir" />
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button onClick={onSaveNewPassword} disabled={!canSaveRecovery || savingRecovery}>
                    {savingRecovery ? "A guardar..." : "Guardar nova password"}
                  </Button>
                  <Button variant="outline" onClick={clearRecoveryUrl}>
                    Cancelar
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  Depois de alterar a password, faz login novamente abaixo para reativar a sincronização neste dispositivo.
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Licenciatura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Selecionada</Label>
            <Select value={selectedDegreeId} onValueChange={setSelectedDegreeId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleciona..." />
              </SelectTrigger>
              <SelectContent>
                {DEGREE_OPTIONS.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap gap-2">
              <Button onClick={applyDegree} variant="default" disabled={!selectedOpt}>
                Guardar
              </Button>
              <Button onClick={importPlan} variant="secondary" disabled={!selectedOpt}>
                Carregar cadeiras (plano automático)
              </Button>
              <Button onClick={clearDegree} variant="outline" disabled={!state.degree}>
                Limpar licenciatura
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Fonte: <a href="https://guiadoscursos.uab.pt/" target="_blank" rel="noopener noreferrer" className="underline">Guia dos Cursos UAb</a>. As cadeiras são carregadas a partir dos dados incluídos na aplicação.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={onExport} variant="secondary">
              Exportar dados (JSON)
            </Button>

            <Button onClick={onImportClick} variant="outline">
              Importar dados (JSON)
            </Button>

            <Button onClick={resetData} variant="destructive">
              Repor dados
            </Button>

            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.currentTarget.value = "";
              }}
            />
          </div>

          {importError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
              {importError}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Dica: a aplicação guarda dados localmente no teu dispositivo. Exportar serve como salvaguarda (ex.: antes de atualizar ou trocar de computador/telemóvel).
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conta e sincronização (opcional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
            Para que os teus dados sobrevivam a limpezas do browser e fiquem iguais em qualquer aparelho, precisas de uma
            conta. Cria uma conta abaixo e usa os botões de upload/download para sincronizar.
          </div>

          {!cloudConfig && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
              Sincronização indisponível: falta configuração do servidor.
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Ativar sincronização</div>
              <div className="text-xs text-muted-foreground">Se estiver desligado, tudo continua a funcionar só em modo local.</div>
            </div>
            <Switch checked={syncEnabledLocal} onCheckedChange={setSyncEnabledLocal} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={saveCloudSettings}>Guardar definições</Button>
            {state.sync?.lastSyncAt && (
              <div className="flex items-center text-xs text-muted-foreground">
                Última sync: {new Date(state.sync.lastSyncAt).toLocaleString("pt-PT")}
              </div>
            )}
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <Label>Email</Label>
              <Input value={cloudEmail} onChange={(e) => setCloudEmail(e.target.value)} placeholder="teu@email.com" />
            </div>
            <div className="grid gap-1">
              <Label>Password</Label>
              <Input value={cloudPass} onChange={(e) => setCloudPass(e.target.value)} type="password" placeholder="••••••••" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={onSignUp} disabled={!cloudConfig}>Criar conta</Button>
            <Button onClick={onSignIn} variant="outline" disabled={!cloudConfig}>Entrar</Button>
            <Button onClick={onSignOut} variant="ghost" disabled={!cloudConfig || !session}>Sair</Button>
          </div>

          <div>
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 py-0 text-xs"
              onClick={onForgotPassword}
              disabled={!cloudConfig || resetBusy || !cloudEmail.trim()}
            >
              {resetBusy ? "A enviar..." : "Esqueci-me da password"}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Estado da sessão: {session ? (<span className="text-emerald-600 dark:text-emerald-400 font-medium">ligada</span>) : (<span>desligada</span>)}
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button onClick={onUploadToCloud} disabled={!cloudConfig || !session}>Guardar na cloud (upload)</Button>
            <Button onClick={onDownloadFromCloud} variant="outline" disabled={!cloudConfig || !session}>Carregar da cloud (download)</Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Os dados sao guardados de forma segura no backend da aplicacao.
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-destructive">Zona de Perigo</h3>
              <p className="text-xs text-muted-foreground mt-1">Eliminar a tua conta e todos os dados associados permanentemente.</p>
            </div>
            <Button onClick={() => setDeleteAccountMode(!deleteAccountMode)} variant="destructive">
              {deleteAccountMode ? "Cancelar" : "Eliminar Conta"}
            </Button>
          </div>

          {deleteAccountMode && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3">
              <div className="text-sm font-medium">Confirmar eliminacao de conta</div>
              <p className="text-xs text-muted-foreground">
                Esta acao e irreversivel. Todos os teus dados (cadeiras, avaliacoes, blocos de estudo) serao eliminados permanentemente do servidor.
              </p>
              <div className="grid gap-2">
                <Label htmlFor="delete-confirm">Escreve "apagar" para confirmar:</Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="apagar"
                  type="text"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={onDeleteAccount}
                  variant="destructive"
                  disabled={deleteConfirmation !== "apagar" || deletingAccount || !session}
                >
                  {deletingAccount ? "A eliminar..." : "Eliminar conta permanentemente"}
                </Button>
                <Button
                  onClick={() => {
                    setDeleteAccountMode(false);
                    setDeleteConfirmation("");
                  }}
                  variant="outline"
                  disabled={deletingAccount}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Catálogo de cadeiras</CardTitle>
            <div className="text-xs text-muted-foreground">
              {state.courses.length} {pluralCadeiras(state.courses.length)}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button onClick={onAddCourse} variant="secondary">
              + Adicionar cadeira
            </Button>

            <div className="text-xs text-muted-foreground">
              Dica: usa o botão “Carregar cadeiras” acima para preencher automaticamente.
            </div>
          </div>

          <Separator />

          {state.courses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              Ainda não tens cadeiras no catálogo.
            </div>
          ) : (
            <div className="space-y-6">
              {years.map((year) => {
                const sem1 = grouped[year]?.[1] ?? [];
                const sem2 = grouped[year]?.[2] ?? [];
                return (
                  <YearBlock
                    key={year}
                    year={year}
                    sem1={sem1}
                    sem2={sem2}
                    orderMap={orderMap}
                    planCourses={planSeeds}
                    onUpdate={(id, patch) => updateCourse(id, patch)}
                    onRemove={(id) => removeCourse(id)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
