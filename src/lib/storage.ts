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
    profile: {},
    appearance: { theme: "system" },
    notifications: { deadlines: true, exams: true, grades: true },
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
    profile: {
      displayName: state?.profile?.displayName ? String(state.profile.displayName) : undefined,
      avatarUrl: state?.profile?.avatarUrl ? String(state.profile.avatarUrl) : undefined,
      avatarPath: state?.profile?.avatarPath ? String(state.profile.avatarPath) : undefined,
    },
    appearance: {
      theme: ["light", "dark", "system"].includes(state?.appearance?.theme)
        ? state.appearance.theme
        : "system",
    },
    notifications: {
      deadlines: state?.notifications?.deadlines !== false,
      exams: state?.notifications?.exams !== false,
      grades: state?.notifications?.grades !== false,
    },
    lastSeenRelease: state?.lastSeenRelease ? String(state.lastSeenRelease) : undefined,
    sync: undefined,
  };

  // Garantir campos mínimos e preservar o regime anterior por omissão.
  base.courses = base.courses.map((c: any): Course => ({
    id: String(c.id ?? uuid()),
    code: String(c.code ?? c.codigo ?? ""),
    name: String(c.name ?? c.nome ?? ""),
    year: Number(c.year ?? c.ano ?? 1),
    semester: Number(c.semester ?? c.semestre ?? 1),
    isActive: Boolean(c.isActive ?? c.ativa ?? false),
    isCompleted: Boolean(c.isCompleted ?? c.concluida ?? false),
    completedAt: c.completedAt ? String(c.completedAt) : undefined,
    evaluationRegime: c.evaluationRegime === "regulation-2026" ? "regulation-2026" : "legacy",
    evaluationModel: ["type1", "type2", "type3", "type4", "exam-only", "custom"].includes(c.evaluationModel)
      ? c.evaluationModel
      : undefined,
    sessions: (() => {
      const raw = c.sessions ?? c.sessoes;
      if (!Array.isArray(raw)) return undefined;
      const mapped = raw
        .map((s: any) => ({
          id: String(s.id ?? uuid()),
          title: String(s.title ?? s.titulo ?? s.name ?? "Sessão"),
          dateTime: String(s.dateTime ?? s.dataHora ?? s.datetime ?? s.date ?? s.data ?? ""),
        }))
        .filter((s: any) => !!s.dateTime);
      return mapped.length ? mapped : undefined;
    })(),
  }));

  const validAssessmentTypes = ["efolio", "exam", "resit", "activity", "project", "presentation", "discussion", "other"];
  base.assessments = base.assessments.map((a: any): Assessment => ({
    id: String(a.id ?? uuid()),
    courseId: String(a.courseId ?? ""),
    type: validAssessmentTypes.includes(a.type)
      ? a.type
      : a.tipo === "exame"
        ? "exam"
        : a.tipo === "recurso"
          ? "resit"
          : "efolio",
    name: String(a.name ?? a.nome ?? ""),
    maxPoints: Number(a.maxPoints ?? a.maxNota ?? (a.type === "exam" ? 12 : a.type === "resit" ? 20 : 4)),
    grade: typeof a.grade === "number" ? a.grade : null,
    mode: a.mode === "synchronous" ? "synchronous" : a.mode === "asynchronous" ? "asynchronous" : undefined,
    required: typeof a.required === "boolean" ? a.required : undefined,
    minimumPercent: Number.isFinite(Number(a.minimumPercent)) ? Number(a.minimumPercent) : undefined,
    status: ["todo", "submitted", "graded", "not-completed"].includes(a.status) ? a.status : undefined,
    order: Number.isFinite(Number(a.order)) ? Number(a.order) : undefined,
    description: a.description ? String(a.description) : undefined,
    startDate: a.startDate ? String(a.startDate) : undefined,
    endDate: a.endDate ?? a.dataFim ? String(a.endDate ?? a.dataFim) : undefined,
    gradeReleaseDate: a.gradeReleaseDate ?? a.dataNota ?? a.grade_release
      ? String(a.gradeReleaseDate ?? a.dataNota ?? a.grade_release)
      : undefined,
    date: a.date ?? a.dataExame ? String(a.date ?? a.dataExame) : undefined,
  }));

  base.rules = base.rules.map((r: any): Rules => ({
    courseId: String(r.courseId ?? ""),
    minAptoExame: Number(r.minAptoExame ?? 3.5),
    minExame: Number(r.minExame ?? 5.5),
    minimumFinalGrade: Number.isFinite(Number(r.minimumFinalGrade)) ? Number(r.minimumFinalGrade) : 10,
    asyncMinimumPercent: Number.isFinite(Number(r.asyncMinimumPercent)) ? Number(r.asyncMinimumPercent) : 50,
    syncMinimumPercent: Number.isFinite(Number(r.syncMinimumPercent)) ? Number(r.syncMinimumPercent) : 50,
    nMinusOneMinimumPercent: Number.isFinite(Number(r.nMinusOneMinimumPercent))
      ? Number(r.nMinusOneMinimumPercent)
      : 40,
  }));

  base.studyBlocks = (base.studyBlocks ?? []).map((b: any): StudyBlock => ({
    id: String(b.id ?? uuid()),
    courseId: String(b.courseId ?? ""),
    title: String(b.title ?? ""),
    activity: ["reading", "exercises", "revision", "efolio", "other"].includes(b.activity) ? b.activity : "other",
    startDate: String(b.startDate ?? ""),
    endDate: String(b.endDate ?? ""),
    startTime: b.startTime ? String(b.startTime) : undefined,
    endTime: b.endTime ? String(b.endTime) : undefined,
    status: ["todo", "in_progress", "done"].includes(b.status) ? b.status : "todo",
    notes: b.notes ? String(b.notes) : undefined,
  }));

  base.meta = {
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
  };

  const s = state?.sync;
  const sync: SyncSettings = {
    enabled: Boolean(s?.enabled ?? false),
    supabaseUrl: s?.supabaseUrl ? String(s.supabaseUrl) : undefined,
    supabaseAnonKey: s?.supabaseAnonKey ? String(s.supabaseAnonKey) : undefined,
    lastSyncAt: s?.lastSyncAt ? String(s.lastSyncAt) : undefined,
  };
  base.sync = sync;

  if (base.degree) {
    base.degree = {
      id: String(base.degree.id ?? uuid()),
      name: String((base.degree as any).name ?? (base.degree as any).nome ?? ""),
      accentColor: (base.degree as any).accentColor ? String((base.degree as any).accentColor) : undefined,
    } as Degree;
  }

  return base;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));

    for (const k of LEGACY_KEYS) {
      const legacy = localStorage.getItem(k);
      if (!legacy) continue;
      const migrated = migrate(JSON.parse(legacy));
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

export const storage = {
  get: loadState,
  set: saveState,
  getDegrees: (): Degree[] => [
    { id: "lic-info", name: "Licenciatura em Engenharia Informática", accentColor: "#2563EB" },
    { id: "lic-gestao", name: "Licenciatura em Gestão", accentColor: "#059669" },
    { id: "lic-psicologia", name: "Licenciatura em Psicologia", accentColor: "#7C3AED" },
    { id: "lic-direito", name: "Licenciatura em Direito", accentColor: "#9F1239" },
    { id: "lic-educacao", name: "Licenciatura em Educação", accentColor: "#D97706" },
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
