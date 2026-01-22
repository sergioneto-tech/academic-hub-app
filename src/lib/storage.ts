import { AppState, Course, Assessment, Rules, Degree } from "@/types";

const STORAGE_KEY = "gestor-academico-uab";

const defaultCatalog: Course[] = [
  { id: "1", codigo: "21001", nome: "Introdução à Programação", ano: 1, semestre: 1, ativa: false, concluida: false },
  { id: "2", codigo: "21002", nome: "Matemática Discreta", ano: 1, semestre: 1, ativa: false, concluida: false },
  { id: "3", codigo: "21003", nome: "Arquitetura de Computadores", ano: 1, semestre: 2, ativa: false, concluida: false },
  { id: "4", codigo: "21004", nome: "Estruturas de Dados", ano: 2, semestre: 1, ativa: false, concluida: false },
  { id: "5", codigo: "21005", nome: "Bases de Dados", ano: 2, semestre: 2, ativa: false, concluida: false },
  { id: "6", codigo: "21006", nome: "Engenharia de Software", ano: 3, semestre: 1, ativa: false, concluida: false },
];

const defaultDegrees: Degree[] = [
  { id: "lic-info", nome: "Licenciatura em Informática" },
  { id: "lic-gestao", nome: "Licenciatura em Gestão" },
  { id: "lic-educacao", nome: "Licenciatura em Educação" },
];

const defaultAssessments: Assessment[] = [
  { id: "a1", courseId: "1", tipo: "efolio", nome: "e-fólio A", dataInicio: "2025-02-01", dataFim: "2025-02-15", nota: 1.8, maxNota: 2 },
  { id: "a2", courseId: "1", tipo: "efolio", nome: "e-fólio B", dataInicio: "2025-03-01", dataFim: "2025-03-15", nota: 1.5, maxNota: 2 },
  { id: "a3", courseId: "1", tipo: "exame", nome: "p-fólio", dataExame: "2025-06-15", maxNota: 16 },
  { id: "a4", courseId: "2", tipo: "efolio", nome: "e-fólio A", dataInicio: "2025-02-10", dataFim: "2025-02-25", nota: 2.0, maxNota: 2 },
  { id: "a5", courseId: "2", tipo: "efolio", nome: "e-fólio B", dataInicio: "2025-03-10", dataFim: "2025-03-25", maxNota: 2 },
  { id: "a6", courseId: "2", tipo: "exame", nome: "p-fólio", dataExame: "2025-06-20", maxNota: 16 },
];

const defaultRules: Rules[] = [
  { courseId: "1", minAptoExame: 3.5, minExame: 5.5, formulaFinal: "somaSimples" },
  { courseId: "2", minAptoExame: 3.5, minExame: 5.5, formulaFinal: "somaSimples" },
  { courseId: "3", minAptoExame: 3.5, minExame: 5.5, formulaFinal: "somaSimples" },
  { courseId: "4", minAptoExame: 3.5, minExame: 5.5, formulaFinal: "somaSimples" },
  { courseId: "5", minAptoExame: 3.5, minExame: 5.5, formulaFinal: "somaSimples" },
  { courseId: "6", minAptoExame: 3.5, minExame: 5.5, formulaFinal: "somaSimples" },
];

const defaultState: AppState = {
  degree: defaultDegrees[0],
  catalog: defaultCatalog,
  activeCourses: [
    { ...defaultCatalog[0], ativa: true },
    { ...defaultCatalog[1], ativa: true },
  ],
  assessments: defaultAssessments,
  rules: defaultRules,
};

export const storage = {
  get(): AppState {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error("Error reading from localStorage:", e);
    }
    return defaultState;
  },

  set(state: AppState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Error writing to localStorage:", e);
    }
  },

  export(): string {
    return JSON.stringify(this.get(), null, 2);
  },

  import(json: string): boolean {
    try {
      const state = JSON.parse(json) as AppState;
      this.set(state);
      return true;
    } catch (e) {
      console.error("Error importing data:", e);
      return false;
    }
  },

  reset(): void {
    this.set(defaultState);
  },

  getDegrees(): Degree[] {
    return defaultDegrees;
  },
};
