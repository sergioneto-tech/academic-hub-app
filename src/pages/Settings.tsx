import { useEffect, useMemo, useRef, useState, useCallback } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAppStore } from "@/lib/AppStore";
import { DEGREE_OPTIONS, getDegreeOptionById, getPlanCoursesForDegree } from "@/lib/uabPlan";
import type { Course } from "@/lib/types";
import { APP_VERSION } from "@/lib/version";
import { toast } from "@/components/ui/use-toast";
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
      className="w-16 h-8 px-2 py-1 text-sm"
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
  onUpdate,
  onRemove,
}: {
  title: string;
  courses: Course[];
  orderMap: Map<string, number>;
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
                  "rounded-lg border p-3",
                  completed
                    ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-700/50 dark:bg-emerald-900/25 dark:ring-1 dark:ring-emerald-700/15"
                    : "bg-card",
                ].join(" ")}
              >
                <div className="grid gap-2 md:grid-cols-12 md:items-end">
                  <div className="md:col-span-2">
                    <Label className="text-[11px] leading-none text-muted-foreground">Código</Label>
                    <Input className="h-8 px-2 py-1 text-sm" value={c.code} onChange={(e) => onUpdate(c.id, { code: e.target.value })} />
                  </div>

                  <div className="md:col-span-6">
                    <Label className="text-[11px] leading-none text-muted-foreground">Nome</Label>
                    <Input className="h-8 px-2 py-1 text-sm" value={c.name} onChange={(e) => onUpdate(c.id, { name: e.target.value })} />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-[11px] leading-none text-muted-foreground">Ano</Label>
                    <NumericInput
                      value={c.year ?? 1}
                      min={1}
                      max={6}
                      onCommit={(v) => onUpdate(c.id, { year: v })}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="text-[11px] leading-none text-muted-foreground">Semestre</Label>
                    <NumericInput
                      value={c.semester ?? 1}
                      min={1}
                      max={2}
                      onCommit={(v) => onUpdate(c.id, { semester: v })}
                    />
                  </div>

                  <div className="md:col-span-8 flex flex-wrap items-center gap-3 pt-0.5">
                    <div className="flex items-center gap-2">
                      <Switch className="scale-90" checked={Boolean(c.isActive)} onCheckedChange={(v) => onUpdate(c.id, { isActive: v })} />
                      <span className="text-xs font-medium">Ativa</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        className="scale-90"
                        checked={Boolean(c.isCompleted)}
                        onCheckedChange={(v) =>
                          onUpdate(c.id, {
                            isCompleted: v,
                            completedAt: v ? (c.completedAt ?? new Date().toISOString()) : undefined,
                            // opcional: se marcar como concluída, geralmente deixa de estar "ativa"
                            isActive: v ? false : c.isActive,
                          })
                        }
                      />
                      <span className="text-xs font-medium">Concluída</span>
                    </div>

                    {completed && (
                      <span className="text-[11px] text-muted-foreground">
                        {c.completedAt ? `Concluída em ${new Date(c.completedAt).toLocaleDateString("pt-PT")}` : "Concluída"}
                      </span>
                    )}
                  </div>

                  <div className="md:col-span-4 flex md:justify-end">
                    <Button variant="destructive" size="sm" className="h-8 px-3 text-xs" onClick={() => onRemove(c.id)}>
                      Remover
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
  onUpdate,
  onRemove,
}: {
  year: number;
  sem1: Course[];
  sem2: Course[];
  orderMap: Map<string, number>;
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
        <SemesterPanel title="1º Semestre" courses={sem1} orderMap={orderMap} onUpdate={onUpdate} onRemove={onRemove} />
        <SemesterPanel title="2º Semestre" courses={sem2} orderMap={orderMap} onUpdate={onUpdate} onRemove={onRemove} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { state, setDegree, mergePlanCourses, addCourse, updateCourse, removeCourse, exportData, importData, resetData, setSync } =
    useAppStore();

  const currentDegreeId = state.degree?.id ?? "";

  const NONE = "__none__";
  const [selectedDegreeId, setSelectedDegreeId] = useState<string>(currentDegreeId || NONE);

  useEffect(() => {
    setSelectedDegreeId(currentDegreeId || NONE);
  }, [currentDegreeId]);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // --- Sincronização (opcional) ---
  const [syncEnabledLocal, setSyncEnabledLocal] = useState<boolean>(() => Boolean(state.sync?.enabled));
  const [cloudEmail, setCloudEmail] = useState<string>("");
  const [cloudPass, setCloudPass] = useState<string>("");
  const [session, setSession] = useState<AuthSession | null>(null);

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
      const s = await signUp(cloudConfig, cloudEmail.trim(), cloudPass);
      storeSession(cloudConfig, s);
      setSession(s);
      toast({ title: "Conta criada", description: "Conta criada e sessão iniciada." });
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
      toast({ title: "Falha ao entrar", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    }
  };

  const onSignOut = () => {
    if (!cloudConfig) return;
    storeSession(cloudConfig, null);
    setSession(null);
    toast({ title: "Sessão terminada" });
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
      const res = importData(JSON.stringify(remote.state));
      if (!res.ok) throw new Error("Erro ao aplicar dados da cloud.");
      setSync({ lastSyncAt: new Date().toISOString() });
      toast({ title: "Download concluído", description: "Dados da cloud aplicados neste dispositivo." });
    } catch (e) {
      toast({ title: "Falha no download", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
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

          <div className="text-xs text-muted-foreground">
            Estado da sessão: {session ? (<span className="text-emerald-600 dark:text-emerald-400 font-medium">ligada</span>) : (<span>desligada</span>)}
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button onClick={onUploadToCloud} disabled={!cloudConfig || !session}>Guardar na cloud (upload)</Button>
            <Button onClick={onDownloadFromCloud} variant="outline" disabled={!cloudConfig || !session}>Carregar da cloud (download)</Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Os dados são guardados de forma segura no backend da aplicação.
          </div>
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
