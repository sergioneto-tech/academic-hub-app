import type { AppState, Assessment, Course, Degree, Rules } from "./types";

const KEY = "academic_hub_state_v2";

function uuid(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function defaultState(): AppState {
  return {
    degree: null,
    courses: [],
    assessments: [],
    rules: [],
  };
}

function migrate(state: any): AppState {
  const base: AppState = {
    degree: state?.degree ?? null,
    courses: Array.isArray(state?.courses) ? state.courses : [],
    assessments: Array.isArray(state?.assessments) ? state.assessments : [],
    rules: Array.isArray(state?.rules) ? state.rules : [],
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

  // grau
  if (base.degree) {
    base.degree = { id: String(base.degree.id ?? uuid()), name: String((base.degree as any).name ?? (base.degree as any).nome ?? "") } as Degree;
  }

  return base;
}

export function loadState(key: string = KEY): AppState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState, key: string = KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// Storage API object for compatibility
export const storage = {
  get: (key?: string) => loadState(key),
  set: (state: AppState, key?: string) => saveState(state, key),
  getDegrees: (): Degree[] => [
    { id: "lic-info", name: "Licenciatura em Informática" },
    { id: "lic-gestao", name: "Licenciatura em Gestão" },
    { id: "lic-psicologia", name: "Licenciatura em Psicologia" },
    { id: "lic-educacao", name: "Licenciatura em Educação" },
  ],
  export: (key?: string): string => JSON.stringify(loadState(key), null, 2),
  import: (json: string, key?: string): boolean => {
    try {
      const data = JSON.parse(json);
      const migrated = migrate(data);
      saveState(migrated, key);
      return true;
    } catch {
      return false;
    }
  },
  reset: (key?: string) => saveState(defaultState(), key),
};
