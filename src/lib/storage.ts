import type {
  AppState,
  Assessment,
  AssessmentMode,
  AssessmentStatus,
  AssessmentType,
  Course,
  CourseSession,
  Degree,
  EvaluationModel,
  StudyBlock,
  StudyBlockStatus,
  SyncSettings,
} from "./types";
import { APP_VERSION, SCHEMA_VERSION } from "./version";

const KEY = "academic_hub_state";
const LEGACY_KEYS = ["academic_hub_state_v2", "academic_hub_state_v1"] as const;

type UnknownRecord = Record<string, unknown>;

const ASSESSMENT_TYPES = ["efolio", "exam", "resit", "activity", "project", "presentation", "discussion", "other"] as const;
const ASSESSMENT_MODES = ["asynchronous", "synchronous"] as const;
const ASSESSMENT_STATUSES = ["todo", "submitted", "graded", "not-completed"] as const;
const EVALUATION_MODELS = ["type1", "type2", "type3", "type4", "exam-only", "custom"] as const;
const STUDY_ACTIVITIES = ["reading", "exercises", "revision", "efolio", "other"] as const;
const STUDY_STATUSES = ["todo", "in_progress", "done"] as const;
const THEMES = ["light", "dark", "system"] as const;

function uuid(): string {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function records(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function first(record: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function optionalText(value: unknown): string | undefined {
  return value === undefined || value === null || value === "" ? undefined : String(value);
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : value === undefined || value === null ? fallback : Boolean(value);
}

function oneOf<const T extends readonly string[]>(value: unknown, options: T): T[number] | undefined {
  return typeof value === "string" && options.includes(value as T[number]) ? (value as T[number]) : undefined;
}

function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // O armazenamento pode estar bloqueado; a aplicação continua em memória.
  }
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

function migrateSession(value: UnknownRecord): CourseSession | null {
  const dateTime = text(first(value, "dateTime", "dataHora", "datetime", "date", "data"));
  if (!dateTime) return null;
  return {
    id: text(value.id, uuid()),
    title: text(first(value, "title", "titulo", "name"), "Sessão"),
    dateTime,
  };
}

function migrateCourse(value: UnknownRecord): Course {
  const sessions = records(first(value, "sessions", "sessoes"))
    .map(migrateSession)
    .filter((session): session is CourseSession => session !== null);

  return {
    id: text(value.id, uuid()),
    code: text(first(value, "code", "codigo")),
    name: text(first(value, "name", "nome")),
    year: numberValue(first(value, "year", "ano"), 1),
    semester: numberValue(first(value, "semester", "semestre"), 1),
    isActive: booleanValue(first(value, "isActive", "ativa")),
    isCompleted: booleanValue(first(value, "isCompleted", "concluida")),
    completedAt: optionalText(value.completedAt),
    evaluationRegime: value.evaluationRegime === "regulation-2026" ? "regulation-2026" : "legacy",
    evaluationModel: oneOf(value.evaluationModel, EVALUATION_MODELS) as EvaluationModel | undefined,
    sessions: sessions.length > 0 ? sessions : undefined,
  };
}

function assessmentType(value: UnknownRecord): AssessmentType {
  const direct = oneOf(value.type, ASSESSMENT_TYPES);
  if (direct) return direct as AssessmentType;
  const legacyType = text(value.tipo).toLocaleLowerCase("pt-PT");
  if (legacyType === "exame") return "exam";
  if (legacyType === "recurso") return "resit";
  return "efolio";
}

function migrateAssessment(value: UnknownRecord): Assessment {
  const type = assessmentType(value);
  const maxPoints = numberValue(
    first(value, "maxPoints", "maxNota"),
    type === "exam" ? 12 : type === "resit" ? 20 : 4,
  );
  const rawGrade = value.grade;

  return {
    id: text(value.id, uuid()),
    courseId: text(value.courseId),
    type,
    name: text(first(value, "name", "nome")),
    maxPoints,
    grade: typeof rawGrade === "number" && Number.isFinite(rawGrade) ? rawGrade : null,
    mode: oneOf(value.mode, ASSESSMENT_MODES) as AssessmentMode | undefined,
    required: typeof value.required === "boolean" ? value.required : undefined,
    minimumPercent: optionalNumber(value.minimumPercent),
    status: oneOf(value.status, ASSESSMENT_STATUSES) as AssessmentStatus | undefined,
    order: optionalNumber(value.order),
    description: optionalText(value.description),
    startDate: optionalText(value.startDate),
    endDate: optionalText(first(value, "endDate", "dataFim")),
    gradeReleaseDate: optionalText(first(value, "gradeReleaseDate", "dataNota", "grade_release")),
    date: optionalText(first(value, "date", "dataExame")),
  };
}

function migrateStudyBlock(value: UnknownRecord): StudyBlock {
  return {
    id: text(value.id, uuid()),
    courseId: text(value.courseId),
    title: text(value.title),
    activity: oneOf(value.activity, STUDY_ACTIVITIES) ?? "other",
    startDate: text(value.startDate),
    endDate: text(value.endDate),
    startTime: optionalText(value.startTime),
    endTime: optionalText(value.endTime),
    status: (oneOf(value.status, STUDY_STATUSES) ?? "todo") as StudyBlockStatus,
    notes: optionalText(value.notes),
  };
}

export function migrate(input: unknown): AppState {
  const state = asRecord(input);
  const degreeRecord = isRecord(state.degree) ? state.degree : null;
  const profile = asRecord(state.profile);
  const appearance = asRecord(state.appearance);
  const notifications = asRecord(state.notifications);
  const syncRecord = asRecord(state.sync);

  const degree: Degree | null = degreeRecord
    ? {
        id: text(degreeRecord.id, uuid()),
        name: text(first(degreeRecord, "name", "nome")),
        accentColor: optionalText(degreeRecord.accentColor),
      }
    : null;

  const sync: SyncSettings = {
    enabled: booleanValue(syncRecord.enabled),
    supabaseUrl: optionalText(syncRecord.supabaseUrl),
    supabaseAnonKey: optionalText(syncRecord.supabaseAnonKey),
    lastSyncAt: optionalText(syncRecord.lastSyncAt),
  };

  return {
    meta: { appVersion: APP_VERSION, schemaVersion: SCHEMA_VERSION },
    degree,
    courses: records(state.courses).map(migrateCourse),
    assessments: records(state.assessments).map(migrateAssessment),
    rules: records(state.rules).map((rule) => ({
      courseId: text(rule.courseId),
      minAptoExame: numberValue(rule.minAptoExame, 3.5),
      minExame: numberValue(rule.minExame, 5.5),
      minimumFinalGrade: numberValue(rule.minimumFinalGrade, 10),
      asyncMinimumPercent: numberValue(rule.asyncMinimumPercent, 50),
      syncMinimumPercent: numberValue(rule.syncMinimumPercent, 50),
      nMinusOneMinimumPercent: numberValue(rule.nMinusOneMinimumPercent, 40),
    })),
    studyBlocks: records(state.studyBlocks).map(migrateStudyBlock),
    profile: {
      displayName: optionalText(profile.displayName),
      avatarUrl: optionalText(profile.avatarUrl),
      avatarPath: optionalText(profile.avatarPath),
    },
    appearance: { theme: oneOf(appearance.theme, THEMES) ?? "system" },
    notifications: {
      deadlines: notifications.deadlines !== false,
      exams: notifications.exams !== false,
      grades: notifications.grades !== false,
    },
    lastSeenRelease: optionalText(state.lastSeenRelease),
    sync,
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));

    for (const legacyKey of LEGACY_KEYS) {
      const legacy = localStorage.getItem(legacyKey);
      if (!legacy) continue;
      const migrated = migrate(JSON.parse(legacy));
      safeLocalSet(KEY, JSON.stringify(migrated));
      return migrated;
    }

    return defaultState();
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  safeLocalSet(KEY, JSON.stringify(state));
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
      saveState(migrate(JSON.parse(json)));
      return true;
    } catch (error) {
      console.error("[storage] import failed:", error);
      return false;
    }
  },
  reset: (): void => saveState(defaultState()),
};
