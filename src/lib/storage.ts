import type { AppState, Assessment, Course, Degree, Rules, StudyBlock, SyncSettings } from "./types";
import { APP_VERSION, SCHEMA_VERSION } from "./version";

const KEY = "academic_hub_state";
const LEGACY_KEYS = ["academic_hub_state_v2", "academic_hub_state_v1"] as const;

function uuid(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function defaultState(): AppState {
  return {
    meta: { appVersion: APP_VERSION, schemaVersion: SCHEMA_VERSION },
    degree: null,
    courses: [],
    assessments: [],
    rules: [],
    studyBlocks: [],
    sync: { enabled: false },
  };
}

export function migrate(state: any): AppState {
  const base: AppState = {
    degree: state?.degree ?? null,
    courses: Array.isArray(state?.courses) ? state.courses : [],
    assessments: Array.isArray(state?.assessments) ? state.assessments : [],
    rules: Array.isArray(state?.rules) ? state.rules : [],
    studyBlocks: Array.isArray(state?.studyBlocks) ? state.studyBlocks : [],
    sync: undefined,
  };

  // garantir campos mínimos
  base.courses = base.courses.map((c: any): Course => ({
    id: String(c.id ?? uuid()),
    code: String(c.code ?? c.codigo ?? ""),
    name: String(c.name ?? c.nome ?? ""),
    year: Number(c.year ?? c.ano ?? 1),
    semester: Number(c.semester ?? c.semestre ?? 1),
    isActive: Boolean(c.isActive ?? c.ativa ?? false),
    isCompleted: Boolean(c.isCompleted ?? c.concluida ?? false),
    completedAt: c.completedAt ? String(c.completedAt) : undefined,
  }));

  base.assessments = base.assessments.map((a: any): Assessment => ({
    id: String(a.id ?? uuid()),
    courseId: String(a.courseId ?? ""),
    type: (a.type === "efolio" || a.type === "exam" || a.type === "resit") ? a.type : (a.tipo === "exame" ? "exam" : a.tipo === "recurso" ? "resit" : "efolio"),
    name: String(a.name ?? a.nome ?? ""),
    maxPoints: Number(a.maxPoints ?? a.maxNota ?? (
      a.type === "exam" ? 12 : a.type === "resit" ? 20 : 4
    )),
    grade: typeof a.grade === "number" ? a.grade : (a.grade === null ? null : null),
    startDate: a.startDate ? String(a.startDate) : undefined,
    endDate: a.endDate ?? a.dataFim ? String(a.endDate ?? a.dataFim) : undefined,
    date: a.date ?? a.dataExame ? String(a.date ?? a.dataExame) : undefined,
  }));

  base.rules = base.rules.map((r: any): Rules => ({
    courseId: String(r.courseId ?? ""),
    minAptoExame: Number(r.minAptoExame ?? 3.5),
    minExame: Number(r.minExame ?? 5.5),
  }));

  // Study blocks (pode não existir em estados antigos)
  base.studyBlocks = (base.studyBlocks ?? []).map((b: any): StudyBlock => ({
    id: String(b.id ?? uuid()),
    courseId: String(b.courseId ?? ""),
    title: String(b.title ?? ""),
    activity: ["reading", "exercises", "revision", "efolio", "other"].includes(b.activity) ? b.activity : "other",
    startDate: String(b.startDate ?? ""),
    endDate: String(b.endDate ?? ""),
    status: ["todo", "in_progress", "done"].includes(b.status) ? b.status : "todo",
    notes: b.notes ? String(b.notes) : undefined,
  }));

  // meta (versões)
  base.meta = {
    appVersion: String(state?.meta?.appVersion ?? APP_VERSION),
    schemaVersion: Number(state?.meta?.schemaVersion ?? SCHEMA_VERSION),
  };

  // Sync (opcional, pode não existir em estados antigos)
  const s = state?.sync;
  const sync: SyncSettings = {
    enabled: Boolean(s?.enabled ?? false),
    supabaseUrl: s?.supabaseUrl ? String(s.supabaseUrl) : undefined,
    supabaseAnonKey: s?.supabaseAnonKey ? String(s.supabaseAnonKey) : undefined,
    lastSyncAt: s?.lastSyncAt ? String(s.lastSyncAt) : undefined,
  };
  base.sync = sync;

  // grau
  if (base.degree) {
    base.degree = { id: String(base.degree.id ?? uuid()), name: String((base.degree as any).name ?? (base.degree as any).nome ?? "") } as Degree;
  }

  return base;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);

    // 1) Key atual (estável)
    if (raw) return migrate(JSON.parse(raw));

    // 2) Migração automática de versões antigas (evita perda de dados após updates)
    for (const k of LEGACY_KEYS) {
      const legacy = localStorage.getItem(k);
      if (!legacy) continue;
      const migrated = migrate(JSON.parse(legacy));
      // Guardar já no KEY novo (sem apagar o antigo, por segurança)
      try { localStorage.setItem(KEY, JSON.stringify(migrated)); } catch {}
      return migrated;
    }

    return defaultState();
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// Storage API object for compatibility
export const storage = {
  get: loadState,
  set: saveState,
  getDegrees: (): Degree[] => [
    { id: "lic-info", name: "Licenciatura em Informática" },
    { id: "lic-gestao", name: "Licenciatura em Gestão" },
    { id: "lic-psicologia", name: "Licenciatura em Psicologia" },
    { id: "lic-educacao", name: "Licenciatura em Educação" },
  ],
  export: (): string => JSON.stringify(loadState(), null, 2),
  import: (json: string): boolean => {
    try {
      const data = JSON.parse(json);
      const migrated = migrate(data);
      saveState(migrated);
      return true;
    } catch (e) {
      console.error("[storage] import failed:", e);
      return false;
    }
  },
  reset: () => saveState(defaultState()),
};
