export type UUID = string;

export type Degree = {
  id: UUID;
  name: string;
};

export type Course = {
  id: UUID;
  code: string;
  name: string;
  year: number;
  semester: number;
  isActive: boolean;
  isCompleted: boolean;
  completedAt?: string; // ISO

  /** Sessões (ex.: abertura, antes de e‑fólios, antes de exame). */
  sessions?: CourseSession[];
};

export type CourseSession = {
  id: UUID;
  /** Título curto da sessão (ex.: "sessão de abertura"). */
  title: string;
  /** Data/hora local em formato ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:MM). */
  dateTime: string;
};


export type AssessmentType = "efolio" | "exam" | "resit";

export type Assessment = {
  id: UUID;
  courseId: UUID;
  type: AssessmentType;
  name: string;

  // Pontuação máxima deste item (editável)
  maxPoints: number;

  // Nota obtida neste item (pode ter decimais)
  grade: number | null;

  // Datas
  startDate?: string; // e-fólio
  endDate?: string;   // e-fólio
  gradeReleaseDate?: string; // publicação da nota (opcional)
  date?: string;      // exame / recurso
};

export type Rules = {
  courseId: UUID;
  minAptoExame: number; // default 3.5
  minExame: number;     // default 5.5
};

export type AppMeta = {
  appVersion: string;
  schemaVersion: number;
};

export type SyncSettings = {
  /** Ativar/desativar sincronização em cloud (opcional). */
  enabled: boolean;

  /** URL do projeto Supabase (ex.: https://xxxx.supabase.co). */
  supabaseUrl?: string;

  /** Anon key do projeto Supabase (Settings > API). */
  supabaseAnonKey?: string;

  /** Data/hora do último upload/download realizado (informativo). */
  lastSyncAt?: string; // ISO
};

export type StudyBlockStatus = "todo" | "in_progress" | "done";

export type StudyBlock = {
  id: UUID;
  courseId: UUID;
  title: string;
  /** Tipo de atividade */
  activity: "reading" | "exercises" | "revision" | "efolio" | "other";
  /** Data início (YYYY-MM-DD) */
  startDate: string;
  /** Data fim (YYYY-MM-DD) */
  endDate: string;
  /** Hora início (HH:MM), opcional */
  startTime?: string;
  /** Hora fim (HH:MM), opcional */
  endTime?: string;
  status: StudyBlockStatus;
  notes?: string;
};

export type AppState = {
  meta?: AppMeta;
  degree: Degree | null;
  courses: Course[];
  assessments: Assessment[];
  rules: Rules[];
  studyBlocks?: StudyBlock[];

  /** Definições opcionais (compatível com versões antigas). */
  sync?: SyncSettings;
};
