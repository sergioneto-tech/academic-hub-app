export type UUID = string;

export type Degree = {
  id: UUID;
  name: string;
  /** Cor de assinatura visual da licenciatura. */
  accentColor?: string;
};

export type EvaluationRegime = "legacy" | "regulation-2026";
export type EvaluationModel = "type1" | "type2" | "type3" | "type4" | "exam-only" | "custom";
export type LegacyEvaluationMode = "efolios-exam" | "exam-only" | "custom" | "final-grade-only";

export type Course = {
  id: UUID;
  code: string;
  name: string;
  year: number;
  semester: number;
  isActive: boolean;
  isCompleted: boolean;
  completedAt?: string; // ISO

  /** Regime aplicável à UC. O valor legacy preserva todos os dados antigos. */
  evaluationRegime?: EvaluationRegime;
  /** Indica quando o regime foi aplicado automaticamente a partir da publicação oficial da UAb. */
  evaluationRegimeSource?: "official" | "manual";
  /** Tipologia/configuração indicada no PUC da cadeira. */
  evaluationModel?: EvaluationModel;
  /** Estrutura utilizada em cadeiras do regime anterior/histórico. Ausente = e-fólios + g-fólio. */
  legacyEvaluationMode?: LegacyEvaluationMode;
  /** Nota final conhecida quando já não existe detalhe fiável da composição histórica. */
  manualFinalGrade?: number;

  /** Sessões (ex.: abertura, antes de atividades ou antes de exame). */
  sessions?: CourseSession[];
};

export type CourseSession = {
  id: UUID;
  /** Título curto da sessão (ex.: "sessão de abertura"). */
  title: string;
  /** Data/hora local em formato ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:MM). */
  dateTime: string;
};

export type AssessmentType = "efolio" | "exam" | "resit" | "special" | "activity" | "project" | "presentation" | "discussion" | "other";
export type AssessmentMode = "asynchronous" | "synchronous";
export type AssessmentStatus = "todo" | "submitted" | "graded" | "not-completed";

export type Assessment = {
  id: UUID;
  courseId: UUID;
  type: AssessmentType;
  name: string;

  // Pontuação máxima deste item (editável)
  maxPoints: number;

  // Nota obtida neste item (pode ter decimais)
  grade: number | null;

  /** Metadados do modelo flexível de avaliação. */
  mode?: AssessmentMode;
  required?: boolean;
  minimumPercent?: number;
  status?: AssessmentStatus;
  order?: number;
  description?: string;

  // Datas
  startDate?: string;
  endDate?: string;
  gradeReleaseDate?: string;
  date?: string;
  /** Origem da data da prova. Datas oficiais são repostas pela sincronização UAb quando necessário. */
  dateSource?: "official" | "manual";
  officialCheckedAt?: string;
};

export type Rules = {
  courseId: UUID;
  minAptoExame: number; // default legado 3.5
  minExame: number;     // default legado 5.5

  /** Regras configuráveis para o regime de 2026. */
  minimumFinalGrade?: number;
  asyncMinimumPercent?: number;
  syncMinimumPercent?: number;
  nMinusOneMinimumPercent?: number;
};

export type AppMeta = {
  appVersion: string;
  /** Pode faltar em backups antigos; a migração preenche sempre a versão atual. */
  schemaVersion?: number;
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
  /** Última alteração local relevante; permite detetar conflitos entre dispositivos. */
  localModifiedAt?: string; // ISO
  /** Dispositivo que originou a versão cloud atualmente conhecida. */
  lastSyncDeviceId?: string;
  lastSyncDeviceLabel?: string;
  /** Impede upload automático enquanto o utilizador decide um conflito. */
  conflictPending?: boolean;
};

export type ProfileSettings = {
  displayName?: string;
  /** URL pública/assinada ou data URL para compatibilidade local. */
  avatarUrl?: string;
  /** Caminho no bucket privado quando existir sincronização Supabase. */
  avatarPath?: string;
};

export type AppearanceSettings = {
  theme: "light" | "dark" | "system";
};

export type NotificationSettings = {
  deadlines: boolean;
  exams: boolean;
  grades: boolean;
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

  /** Preferências novas, opcionais para manter compatibilidade total. */
  profile?: ProfileSettings;
  appearance?: AppearanceSettings;
  notifications?: NotificationSettings;
  lastSeenRelease?: string;

  /** Definições opcionais (compatível com versões antigas). */
  sync?: SyncSettings;
};
