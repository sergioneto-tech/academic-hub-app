import type { AppState, Assessment, Course, Degree, Rules } from "./types";

const KEY = "academic_hub_state_v2";

function uuid(): string {
  // simples e suficiente aqui
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
    code: String(c.code ?? ""),
    name: String(c.name ?? ""),
    year: Number(c.year ?? 1),
    semester: Number(c.semester ?? 1),
    isActive: Boolean(c.isActive ?? false),
    isCompleted: Boolean(c.isCompleted ?? false),
    completedAt: c.completedAt ? String(c.completedAt) : undefined,
  }));

  base.assessments = base.assessments.map((a: any): Assessment => ({
    id: String(a.id ?? uuid()),
    courseId: String(a.courseId ?? ""),
    type: (a.type === "efolio" || a.type === "exam" || a.type === "resit") ? a.type : "efolio",
    name: String(a.name ?? ""),
    maxPoints: Number(a.maxPoints ?? (
      a.type === "exam" ? 12 : a.type === "resit" ? 20 : 4
    )),
    grade: typeof a.grade === "number" ? a.grade : (a.grade === null ? null : null),
    startDate: a.startDate ? String(a.startDate) : undefined,
    endDate: a.endDate ? String(a.endDate) : undefined,
    date: a.date ? String(a.date) : undefined,
  }));

  base.rules = base.rules.map((r: any): Rules => ({
    courseId: String(r.courseId ?? ""),
    minAptoExame: Number(r.minAptoExame ?? 3.5),
    minExame: Number(r.minExame ?? 5.5),
  }));

  // grau
  if (base.degree) {
    base.degree = { id: String(base.degree.id ?? uuid()), name: String((base.degree as any).name ?? "") } as Degree;
  }

  return base;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return migrate(JSON.parse(raw));
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
