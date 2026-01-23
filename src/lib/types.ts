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

export type AssessmentType = "efolio" | "exame" | "recurso";

export type Assessment = {
  id: UUID;
  courseId: UUID;
  type: AssessmentType;
  name: string;

  // e-fólio
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD

  // exame/recurso
  date?: string;      // YYYY-MM-DD

  grade?: number | null;
  maxGrade?: number;  // default 2 p/ e-fólio, 16 p/ exame (ajusta na UI)
};

export type Rules = {
  courseId: UUID;
  minAptoExame: number; // default 3.5
  minExame: number;     // default 5.5
};

export type AppState = {
  degree: Degree | null;
  courses: Course[];
  assessments: Assessment[];
  rules: Rules[];
};
