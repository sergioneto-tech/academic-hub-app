export interface Degree {
  id: string;
  nome: string;
}

export interface Course {
  id: string;
  codigo: string;
  nome: string;
  ano: number;
  semestre: 1 | 2;
  ativa: boolean;
  concluida: boolean;
  notaFinal?: number;
}

export interface Assessment {
  id: string;
  courseId: string;
  tipo: "efolio" | "exame";
  nome: string;
  dataInicio?: string;
  dataFim?: string;
  dataExame?: string;
  nota?: number;
  maxNota: number;
}

export interface Rules {
  courseId: string;
  minAptoExame: number;
  minExame: number;
  formulaFinal: "somaSimples";
}

export interface AppState {
  degree: Degree | null;
  catalog: Course[];
  activeCourses: Course[];
  assessments: Assessment[];
  rules: Rules[];
}

export type CourseStatus = "Apto a Exame" | "Não Apto" | "Recurso" | "Aprovado" | "Reprovado" | "Em Curso";
