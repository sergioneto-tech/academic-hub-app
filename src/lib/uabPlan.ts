import type { Degree } from "@/lib/types";
import {
  LCA_COURSES, LCS_COURSES, LED_COURSES, LEE_COURSES,
  LGVR_COURSES, LGEST_COURSES, LHIS_COURSES, LHUM_COURSES,
  LLA_COURSES, LMAG_COURSES, LMA_COURSES,
} from "@/lib/uabCoursesData";

export type DegreeOption = {
  id: string;
  name: string;
  sourceUrl: string;
};

export type PlanCourseSeed = {
  code: string;
  name: string;
  year: number;
  semester: number;
  ects?: number;
  area?: string;
};

export const DEGREE_OPTIONS: DegreeOption[] = [
  { id: "lei", name: "Licenciatura em Engenharia Informática", sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-engenharia-informatica/" },
  { id: "uab-lca", name: "Licenciatura em Ciências do Ambiente", sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-ciencias-do-ambiente/" },
  { id: "uab-lcs", name: "Licenciatura em Ciências Sociais", sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-ciencias-sociais/" },
  { id: "uab-led", name: "Licenciatura em Educação", sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-educacao/" },
  { id: "uab-lee", name: "Licenciatura em Estudos Europeus", sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-estudos-europeus/" },
  { id: "uab-lgvr", name: "Licenciatura em Gestão de Vendas e do Retalho", sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-gestao-de-vendas-e-do-retalho/" },
  { id: "uab-lgest", name: "Licenciatura em Gestão", sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-gestao/" },
  { id: "uab-lhis", name: "Licenciatura em História", sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-historia/" },
  { id: "uab-lhum", name: "Licenciatura em Humanidades", sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-humanidades/" },
  { id: "uab-lla", name: "Licenciatura em Línguas Aplicadas", sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-linguas-aplicadas/" },
  { id: "uab-lmag", name: "Licenciatura em Matemática Aplicada à Gestão", sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-matematica-aplicada-a-gestao/" },
  { id: "uab-lma", name: "Licenciatura em Matemática e Aplicações", sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-matematica-e-aplicacoes/" },
];

const PLAN_BY_DEGREE: Record<string, PlanCourseSeed[]> = {
  lei: [
    // 1º Ano – S1
    { code: "21002", name: "Álgebra Linear I", year: 1, semester: 1, ects: 6, area: "Matemática" },
    { code: "21010", name: "Arquitetura de Computadores", year: 1, semester: 1, ects: 6, area: "Engenharia Informática" },
    { code: "21173", name: "Introdução à Programação", year: 1, semester: 1, ects: 6, area: "Engenharia Informática" },
    { code: "21174", name: "Sistemas Computacionais", year: 1, semester: 1, ects: 4, area: "Tecnologias de Informação e Comunicação" },
    { code: "21175", name: "Análise Infinitesimal", year: 1, semester: 1, ects: 6, area: "Matemática" },
    { code: "21176", name: "Ética e Práticas de Engenharia", year: 1, semester: 1, ects: 2, area: "Engenharia Informática" },
    // 1º Ano – S2
    { code: "21037", name: "Elementos de Probabilidades e Estatística", year: 1, semester: 2, ects: 6, area: "Matemática" },
    { code: "21082", name: "Matemática Finita", year: 1, semester: 2, ects: 6, area: "Matemática" },
    { code: "21111", name: "Sistemas Operativos", year: 1, semester: 2, ects: 6, area: "Engenharia Informática" },
    { code: "21177", name: "Modelação de Sistemas de Informação", year: 1, semester: 2, ects: 6, area: "Engenharia Informática" },
    { code: "21178", name: "Laboratório de Programação", year: 1, semester: 2, ects: 6, area: "Engenharia Informática" },
    // 2º Ano – S1
    { code: "21048", name: "Física Geral", year: 2, semester: 1, ects: 6, area: "Física" },
    { code: "21053", name: "Fundamentos de Bases de Dados", year: 2, semester: 1, ects: 6, area: "Engenharia Informática" },
    { code: "21078", name: "Linguagens e Computação", year: 2, semester: 1, ects: 6, area: "Engenharia Informática" },
    { code: "21093", name: "Programação por Objetos", year: 2, semester: 1, ects: 6, area: "Engenharia Informática" },
    { code: "21106", name: "Sistemas em Rede", year: 2, semester: 1, ects: 6, area: "Engenharia Informática" },
    // 2º Ano – S2
    { code: "21046", name: "Estruturas de Dados e Algoritmos Fundamentais", year: 2, semester: 2, ects: 6, area: "Engenharia Informática" },
    { code: "21071", name: "Introdução à Inteligência Artificial", year: 2, semester: 2, ects: 6, area: "Engenharia Informática" },
    { code: "21076", name: "Investigação Operacional", year: 2, semester: 2, ects: 6, area: "Matemática" },
    { code: "21077", name: "Linguagens de Programação", year: 2, semester: 2, ects: 6, area: "Engenharia Informática" },
    { code: "21179", name: "Laboratório de Desenvolvimento de Software", year: 2, semester: 2, ects: 6, area: "Engenharia Informática" },
    // 3º Ano – S1
    { code: "21020", name: "Computação Gráfica", year: 3, semester: 1, ects: 6, area: "Engenharia Informática" },
    { code: "21062", name: "Gestão de Projetos Informáticos", year: 3, semester: 1, ects: 6, area: "Engenharia Informática" },
    { code: "21103", name: "Sistemas de Gestão de Bases de Dados", year: 3, semester: 1, ects: 6, area: "Engenharia Informática" },
    { code: "21110", name: "Sistemas Multimédia", year: 3, semester: 1, ects: 6, area: "Tecnologias de Informação e Comunicação" },
    { code: "21180", name: "Computação Numérica", year: 3, semester: 1, ects: 4, area: "Engenharia Informática" },
    { code: "21181", name: "Segurança em Redes e Computadores", year: 3, semester: 1, ects: 2, area: "Engenharia Informática" },
    // 3º Ano – S2
    { code: "21018", name: "Compilação", year: 3, semester: 2, ects: 6, area: "Engenharia Informática" },
    { code: "21097", name: "Raciocínio e Representação do Conhecimento", year: 3, semester: 2, ects: 6, area: "Engenharia Informática" },
    { code: "21108", name: "Sistemas Distribuídos", year: 3, semester: 2, ects: 6, area: "Engenharia Informática" },
    { code: "21182", name: "Laboratório de Sistemas e Serviços Web", year: 3, semester: 2, ects: 6, area: "Engenharia Informática" },
    { code: "21184", name: "Projeto de Engenharia Informática", year: 3, semester: 2, ects: 6, area: "Engenharia Informática" },
  ],
  "uab-lca": LCA_COURSES,
  "uab-lcs": LCS_COURSES,
  "uab-led": LED_COURSES,
  "uab-lee": LEE_COURSES,
  "uab-lgvr": LGVR_COURSES,
  "uab-lgest": LGEST_COURSES,
  "uab-lhis": LHIS_COURSES,
  "uab-lhum": LHUM_COURSES,
  "uab-lla": LLA_COURSES,
  "uab-lmag": LMAG_COURSES,
  "uab-lma": LMA_COURSES,
};

export function getDegreeOptionById(id?: string | null): DegreeOption | null {
  if (!id) return null;
  return DEGREE_OPTIONS.find((d) => d.id === id) ?? null;
}

export function resolveDegreeOption(degree: Degree | null): DegreeOption | null {
  if (!degree) return null;
  const byId = getDegreeOptionById(degree.id);
  if (byId) return byId;
  // Compat: old ids lei3/lei5 → lei
  const id = degree.id ?? "";
  if (id === "lei3" || id === "lei5") return getDegreeOptionById("lei");
  const name = (degree.name || "").toLowerCase();
  if (name.includes("engenharia") && name.includes("inform")) {
    return getDegreeOptionById("lei");
  }
  return null;
}

export function getPlanCoursesForDegree(degree: Degree | null): PlanCourseSeed[] {
  const opt = resolveDegreeOption(degree);
  if (!opt) return [];
  return PLAN_BY_DEGREE[opt.id] ?? [];
}

/** Returns ECTS for a course code (from the plan), defaults to 6 if not specified */
export function getCourseEcts(planCourses: PlanCourseSeed[], code: string): number {
  const pc = planCourses.find(p => p.code === code);
  return pc?.ects ?? 6;
}

/** Returns scientific area for a course code (from the plan) */
export function getCourseArea(planCourses: PlanCourseSeed[], code: string): string | undefined {
  const pc = planCourses.find(p => p.code === code);
  return pc?.area;
}
