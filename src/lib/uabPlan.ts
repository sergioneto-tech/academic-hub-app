import type { Degree } from "@/lib/types";

export type DegreeOption = {
  /** Identificador estável (guardado no state.degree.id) */
  id: string;
  /** Nome a mostrar ao utilizador */
  name: string;
  /** URL de referência (fonte dos dados) */
  sourceUrl: string;
};

export type PlanCourseSeed = {
  code: string;
  name: string;
  year: number;
  semester: number;
};

export const DEGREE_OPTIONS: DegreeOption[] = [
  // --- Cursos suportados com plano “seed” (auto-carregamento de cadeiras) ---
  {
    id: "lei3",
    name: "Licenciatura em Engenharia Informática (Plano oficial – 3 anos)",
    sourceUrl: "https://wiki.dcet.uab.pt/files/images/c/c0/LEI_Plano_alternativo_5_anos.pdf",
  },
  {
    id: "lei5",
    name: "Licenciatura em Engenharia Informática (Plano alternativo – 5 anos)",
    sourceUrl: "https://wiki.dcet.uab.pt/files/images/c/c0/LEI_Plano_alternativo_5_anos.pdf",
  },

  // --- Outras licenciaturas (lista do Guia dos Cursos da UAb) ---
  // Nota: nesta versão, estas opções servem para o utilizador identificar o seu curso,
  // mas não têm (ainda) plano “seed” embebido para auto-carregamento de cadeiras.
  {
    id: "uab-lca",
    name: "Licenciatura em Ciências do Ambiente",
    sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-ciencias-do-ambiente/",
  },
  {
    id: "uab-lcs",
    name: "Licenciatura em Ciências Sociais",
    sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-ciencias-sociais/",
  },
  {
    id: "uab-led",
    name: "Licenciatura em Educação",
    sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-educacao/",
  },
  {
    id: "uab-lee",
    name: "Licenciatura em Estudos Europeus",
    sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-estudos-europeus/",
  },
  {
    id: "uab-lgvr",
    name: "Licenciatura em Gestão de Vendas e do Retalho",
    sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-gestao-de-vendas-e-do-retalho/",
  },
  {
    id: "uab-lgest",
    name: "Licenciatura em Gestão",
    sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-gestao/",
  },
  {
    id: "uab-lhis",
    name: "Licenciatura em História",
    sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-historia/",
  },
  {
    id: "uab-lhum",
    name: "Licenciatura em Humanidades",
    sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-humanidades/",
  },
  {
    id: "uab-lla",
    name: "Licenciatura em Línguas Aplicadas",
    sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-linguas-aplicadas/",
  },
  {
    id: "uab-lmag",
    name: "Licenciatura em Matemática Aplicada à Gestão",
    sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-matematica-aplicada-a-gestao/",
  },
  {
    id: "uab-lma",
    name: "Licenciatura em Matemática e Aplicações",
    sourceUrl: "https://guiadoscursos.uab.pt/en/cursos/licenciatura-em-matematica-e-aplicacoes/",
  },
];

/**
 * Plano de estudos “seed” (cadeiras) para inicialização automática.
 *
 * Nota: nesta versão, os dados são embebidos (para funcionar offline / sem depender de CORS),
 * e referem-se ao mapa/plano publicado na wiki (ver sourceUrl).
 */
const PLAN_BY_DEGREE: Record<string, PlanCourseSeed[]> = {
  // Plano oficial de 3 anos (Mapa LEI 22/23 – Wiki UAb)
  lei3: [
    // 1º Ano
    { code: "21002", name: "Álgebra Linear I", year: 1, semester: 1 },
    { code: "21037", name: "Elementos de Probabilidades e Estatística", year: 1, semester: 2 },

    { code: "21010", name: "Arquitetura de Computadores", year: 1, semester: 1 },
    { code: "21082", name: "Matemática Finita", year: 1, semester: 2 },

    { code: "21173", name: "Introdução à Programação", year: 1, semester: 1 },
    { code: "21111", name: "Sistemas Operativos", year: 1, semester: 2 },

    { code: "21174", name: "Sistemas Computacionais", year: 1, semester: 1 },
    { code: "21177", name: "Modelação de Sistemas de Informação", year: 1, semester: 2 },

    { code: "21175", name: "Análise Infinitesimal", year: 1, semester: 1 },
    { code: "21178", name: "Laboratório de Programação", year: 1, semester: 2 },

    // Aparece no mapa sem coluna explícita — guardamos como 1º semestre por defeito.
    { code: "21176", name: "Ética e Práticas de Engenharia", year: 1, semester: 1 },

    // 2º Ano
    { code: "21048", name: "Física Geral", year: 2, semester: 1 },
    { code: "21046", name: "Estruturas de Dados e Algoritmos Fundamentais", year: 2, semester: 2 },

    { code: "21053", name: "Fundamentos de Bases de Dados", year: 2, semester: 1 },
    { code: "21071", name: "Introdução à Inteligência Artificial", year: 2, semester: 2 },

    { code: "21078", name: "Linguagens e Computação", year: 2, semester: 1 },
    { code: "21076", name: "Investigação Operacional", year: 2, semester: 2 },

    { code: "21093", name: "Programação por Objetos", year: 2, semester: 1 },
    { code: "21077", name: "Linguagens de Programação", year: 2, semester: 2 },

    { code: "21106", name: "Sistemas em Rede", year: 2, semester: 1 },
    { code: "21179", name: "Laboratório de Desenvolvimento de Software", year: 2, semester: 2 },

    // 3º Ano
    { code: "21020", name: "Computação Gráfica", year: 3, semester: 1 },
    { code: "21018", name: "Compilação", year: 3, semester: 2 },

    { code: "21062", name: "Gestão de Projetos Informáticos", year: 3, semester: 1 },
    { code: "21097", name: "Raciocínio e Representação do Conhecimento", year: 3, semester: 2 },

    { code: "21103", name: "Sistemas de Gestão de Bases de Dados", year: 3, semester: 1 },
    { code: "21108", name: "Sistemas Distribuídos", year: 3, semester: 2 },

    { code: "21110", name: "Sistemas Multimédia", year: 3, semester: 1 },
    { code: "21182", name: "Laboratório de Sistemas e Serviços Web", year: 3, semester: 2 },

    { code: "21180", name: "Computação Numérica", year: 3, semester: 1 },
    { code: "21184", name: "Projeto de Engenharia Informática", year: 3, semester: 2 },

    // Aparece no mapa sem coluna explícita — guardamos como 1º semestre por defeito.
    { code: "21181", name: "Segurança em Redes e Computadores", year: 3, semester: 1 },
  ],

  // Plano alternativo de 5 anos (Mapa LEI 22/23 – Wiki UAb)
  lei5: [
    // 1º Ano
    { code: "21173", name: "Introdução à Programação", year: 1, semester: 1 },
    { code: "21178", name: "Laboratório de Programação", year: 1, semester: 2 },

    { code: "21175", name: "Análise Infinitesimal", year: 1, semester: 1 },
    { code: "21037", name: "Elementos de Probabilidades e Estatística", year: 1, semester: 2 },

    { code: "21174", name: "Sistemas Computacionais", year: 1, semester: 1 },
    { code: "21177", name: "Modelação de Sistemas de Informação", year: 1, semester: 2 },

    { code: "21176", name: "Ética e Práticas de Engenharia", year: 1, semester: 1 },

    // 2º Ano
    { code: "21002", name: "Álgebra Linear I", year: 2, semester: 1 },
    { code: "21082", name: "Matemática Finita", year: 2, semester: 2 },

    { code: "21010", name: "Arquitetura de Computadores", year: 2, semester: 1 },
    { code: "21111", name: "Sistemas Operativos", year: 2, semester: 2 },

    { code: "21093", name: "Programação por Objetos", year: 2, semester: 1 },
    { code: "21046", name: "Estruturas de Dados e Algoritmos Fundamentais", year: 2, semester: 2 },

    // 3º Ano
    { code: "21048", name: "Física Geral", year: 3, semester: 1 },
    { code: "21076", name: "Investigação Operacional", year: 3, semester: 2 },

    { code: "21053", name: "Fundamentos de Bases de Dados", year: 3, semester: 1 },
    { code: "21077", name: "Linguagens de Programação", year: 3, semester: 2 },

    { code: "21078", name: "Linguagens e Computação", year: 3, semester: 1 },
    { code: "21179", name: "Laboratório de Desenvolvimento de Software", year: 3, semester: 2 },

    // 4º Ano
    { code: "21106", name: "Sistemas em Rede", year: 4, semester: 1 },
    { code: "21071", name: "Introdução à Inteligência Artificial", year: 4, semester: 2 },

    { code: "21180", name: "Computação Numérica", year: 4, semester: 1 },
    { code: "21182", name: "Laboratório de Sistemas e Serviços Web", year: 4, semester: 2 },

    { code: "21181", name: "Segurança em Redes e Computadores", year: 4, semester: 1 },
    { code: "21108", name: "Sistemas Distribuídos", year: 4, semester: 2 },

    { code: "21103", name: "Sistemas de Gestão de Bases de Dados", year: 4, semester: 1 },

    // 5º Ano
    { code: "21020", name: "Computação Gráfica", year: 5, semester: 1 },
    { code: "21097", name: "Raciocínio e Representação do Conhecimento", year: 5, semester: 2 },

    { code: "21062", name: "Gestão de Projetos Informáticos", year: 5, semester: 1 },
    { code: "21018", name: "Compilação", year: 5, semester: 2 },

    { code: "21110", name: "Sistemas Multimédia", year: 5, semester: 1 },
    { code: "21184", name: "Projeto de Engenharia Informática", year: 5, semester: 2 },
  ],
};

export function getDegreeOptionById(id?: string | null): DegreeOption | null {
  if (!id) return null;
  return DEGREE_OPTIONS.find((d) => d.id === id) ?? null;
}

export function resolveDegreeOption(degree: Degree | null): DegreeOption | null {
  if (!degree) return null;

  const byId = getDegreeOptionById(degree.id);
  if (byId) return byId;

  // Fallback por nome (compatibilidade com estados antigos)
  const name = (degree.name || "").toLowerCase();
  if (name.includes("engenharia") && name.includes("inform")) {
    // Se o utilizador tinha apenas "LEI" guardado, assumimos plano oficial (3 anos)
    return getDegreeOptionById("lei3");
  }

  return null;
}

export function getPlanCoursesForDegree(degree: Degree | null): PlanCourseSeed[] {
  const opt = resolveDegreeOption(degree);
  if (!opt) return [];
  return PLAN_BY_DEGREE[opt.id] ?? [];
}
