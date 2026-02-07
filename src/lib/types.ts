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

export type AppState = {
  meta?: AppMeta;
  degree: Degree | null;
  courses: Course[];
  assessments: Assessment[];
  rules: Rules[];
};
