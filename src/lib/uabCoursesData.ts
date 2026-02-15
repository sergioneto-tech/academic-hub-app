/**
 * Base de dados completa de cadeiras por licenciatura da UAb.
 * Fonte: https://guiadoscursos.uab.pt/ (scraping fev. 2026)
 *
 * Inclui apenas cadeiras obrigatórias (Major anos 1-2 + 1 Minor default para o 3º ano).
 * Opcionais (marcadas com * no site) não estão incluídas.
 */
import type { PlanCourseSeed } from "./uabPlan";

// ── Licenciatura em Ciências do Ambiente ──────────────────────
export const LCA_COURSES: PlanCourseSeed[] = [
  // 1º Ano – S1
  { code: "21012", name: "Biologia Geral I", year: 1, semester: 1, ects: 6, area: "Ciências Biológicas" },
  { code: "21022", name: "Conceitos Fundamentais de Química", year: 1, semester: 1, ects: 6, area: "Química e Bioquímica" },
  { code: "21051", name: "Física para as Ciências Ambientais", year: 1, semester: 1, ects: 6, area: "Física" },
  { code: "21056", name: "Geologia Geral I", year: 1, semester: 1, ects: 6, area: "Ciências da Terra" },
  { code: "21068", name: "Introdução à Estatística Aplicada", year: 1, semester: 1, ects: 6, area: "Matemática" },
  // 1º Ano – S2
  { code: "21013", name: "Biologia Geral II", year: 1, semester: 2, ects: 6, area: "Ciências Biológicas" },
  { code: "21015", name: "Cálculo", year: 1, semester: 2, ects: 6, area: "Matemática" },
  { code: "21026", name: "Ecologia Geral", year: 1, semester: 2, ects: 6, area: "Ciências e Tecnologias do Ambiente" },
  { code: "21057", name: "Geologia Geral II", year: 1, semester: 2, ects: 6, area: "Ciências da Terra" },
  { code: "21096", name: "Química e Ambiente", year: 1, semester: 2, ects: 6, area: "Química e Bioquímica" },
  // 2º Ano – S1
  { code: "21070", name: "Introdução à Gestão Ambiental", year: 2, semester: 1, ects: 6, area: "Ciências e Tecnologias do Ambiente" },
  { code: "21075", name: "Introdução ao Ordenamento do Território", year: 2, semester: 1, ects: 6, area: "Ciências e Tecnologias do Ambiente" },
  { code: "21086", name: "Poluição", year: 2, semester: 1, ects: 6, area: "Ciências e Tecnologias do Ambiente" },
  { code: "21118", name: "Trabalhos de Campo I", year: 2, semester: 1, ects: 6, area: "Ciências e Tecnologias do Ambiente" },
  { code: "41035", name: "Introdução ao Direito do Ambiente", year: 2, semester: 1, ects: 6, area: "Ciências Jurídicas" },
  // 2º Ano – S2
  { code: "21084", name: "Novas Ruralidades", year: 2, semester: 2, ects: 6, area: "Ciências e Tecnologias do Ambiente" },
  { code: "21098", name: "Riscos Naturais", year: 2, semester: 2, ects: 6, area: "Ciências da Terra" },
  { code: "21104", name: "Sistemas de Informação Geográfica", year: 2, semester: 2, ects: 6, area: "Ciências e Tecnologias do Ambiente" },
  { code: "21156", name: "Novas Energias", year: 2, semester: 2, ects: 6, area: "Ciências e Tecnologias do Ambiente" },
  { code: "21168", name: "Ecologia das Alterações Globais", year: 2, semester: 2, ects: 6, area: "Ciências Biológicas" },
  // 3º Ano – Minor Conservação do Património Natural
  { code: "21011", name: "Biodiversidade e Conservação", year: 3, semester: 1, ects: 6, area: "Ciências Biológicas" },
  { code: "21055", name: "Geologia e Ambiente", year: 3, semester: 1, ects: 6, area: "Ciências da Terra" },
  { code: "21069", name: "Introdução à Ética e Cidadania Ambiental", year: 3, semester: 1, ects: 6, area: "Ciências e Tecnologias do Ambiente" },
  { code: "21120", name: "Turismo Sustentável", year: 3, semester: 1, ects: 6, area: "Ciências e Tecnologias do Ambiente" },
  { code: "21169", name: "Recursos Marinhos", year: 3, semester: 1, ects: 6, area: "Ciências Biológicas" },
  { code: "21017", name: "Caracterização e Conservação do Património Geológico", year: 3, semester: 2, ects: 6, area: "Ciências da Terra" },
  { code: "21066", name: "Instrumentos de Gestão Ambiental", year: 3, semester: 2, ects: 6, area: "Ciências e Tecnologias do Ambiente" },
  { code: "21119", name: "Trabalhos de Campo II", year: 3, semester: 2, ects: 6, area: "Ciências e Tecnologias do Ambiente" },
  { code: "21170", name: "Educação para a Sustentabilidade", year: 3, semester: 2, ects: 6, area: "Ciências e Tecnologias do Ambiente" },
  { code: "61068", name: "Economia do Desenvolvimento Sustentável", year: 3, semester: 2, ects: 6, area: "Economia" },
];

// ── Licenciatura em Ciências Sociais ──────────────────────────
export const LCS_COURSES: PlanCourseSeed[] = [
  // 1º Ano – S1
  { code: "41018", name: "Demografia", year: 1, semester: 1, ects: 6, area: "Demografia" },
  { code: "41036", name: "Introdução às Ciências Sociais", year: 1, semester: 1, ects: 6, area: "Sociologia" },
  { code: "41037", name: "Introdução ao Direito", year: 1, semester: 1, ects: 6, area: "Ciências Jurídicas" },
  { code: "41050", name: "Psicologia Geral", year: 1, semester: 1, ects: 6, area: "Psicologia" },
  { code: "41098", name: "Antropologia Geral", year: 1, semester: 1, ects: 6, area: "Antropologia" },
  // 1º Ano – S2
  { code: "21044", name: "Estatística para as Ciências Sociais", year: 1, semester: 2, ects: 6, area: "Matemática" },
  { code: "41031", name: "Introdução à Ciência Política", year: 1, semester: 2, ects: 6, area: "Ciência Política" },
  { code: "41099", name: "Política Social", year: 1, semester: 2, ects: 6, area: "Política Social" },
  { code: "41100", name: "Sociologia Geral", year: 1, semester: 2, ects: 6, area: "Sociologia" },
  { code: "61022", name: "Introdução à Economia", year: 1, semester: 2, ects: 6, area: "Economia" },
  // 2º Ano – S1
  { code: "41038", name: "Metodologia das Ciências Sociais: Métodos Qualitativos", year: 2, semester: 1, ects: 6, area: "Sociologia" },
  { code: "41101", name: "Etnografias", year: 2, semester: 1, ects: 6, area: "Antropologia" },
  { code: "61029", name: "Princípios de Gestão", year: 2, semester: 1, ects: 6, area: "Gestão" },
  // 2º Ano – S2
  { code: "41039", name: "Metodologia das Ciências Sociais: Métodos Quantitativos", year: 2, semester: 2, ects: 6, area: "Sociologia" },
  { code: "41052", name: "Psicologia Social", year: 2, semester: 2, ects: 6, area: "Psicologia" },
  { code: "41071", name: "História Económica e Social", year: 2, semester: 2, ects: 6, area: "História" },
  // 3º Ano – Minor Ciência Política e Administrativa (default)
  { code: "41033", name: "Introdução ao Direito Administrativo", year: 3, semester: 1, ects: 6, area: "Ciências Jurídicas" },
  { code: "41035", name: "Introdução ao Direito do Ambiente", year: 3, semester: 1, ects: 6, area: "Ciências Jurídicas" },
  { code: "41044", name: "Política Internacional", year: 3, semester: 1, ects: 6, area: "Ciência Política" },
  { code: "41067", name: "Teoria das Relações Internacionais", year: 3, semester: 1, ects: 6, area: "Ciência Política" },
  { code: "41106", name: "Direito da União Europeia", year: 3, semester: 1, ects: 6, area: "Ciências Jurídicas" },
  { code: "41015", name: "Ciência da Administração", year: 3, semester: 2, ects: 6, area: "Ciência Política" },
  { code: "41022", name: "Direito Constitucional Comparado", year: 3, semester: 2, ects: 6, area: "Ciências Jurídicas" },
  { code: "41043", name: "Organizações Políticas", year: 3, semester: 2, ects: 6, area: "Ciência Política" },
  { code: "41055", name: "Sistemas de Poder", year: 3, semester: 2, ects: 6, area: "Ciência Política" },
  { code: "41068", name: "Teoria Política", year: 3, semester: 2, ects: 6, area: "Ciência Política" },
];

// ── Licenciatura em Educação ──────────────────────────────────
export const LED_COURSES: PlanCourseSeed[] = [
  // 1º Ano – S1
  { code: "11012", name: "Educação e Equidade na Sociedade Contemporânea", year: 1, semester: 1, ects: 6, area: "Ciências da Educação" },
  { code: "11013", name: "Educação e Internet", year: 1, semester: 1, ects: 6, area: "Ciências da Educação" },
  { code: "11017", name: "Ética e Educação", year: 1, semester: 1, ects: 6, area: "Filosofia" },
  { code: "11045", name: "Práticas de Estudo e Aprendizagem", year: 1, semester: 1, ects: 6, area: "Ciências da Educação" },
  { code: "11060", name: "Comunicação Educacional e Tecnologias Multimédia", year: 1, semester: 1, ects: 6, area: "Ciências da Educação" },
  // 1º Ano – S2
  { code: "11028", name: "Princípios de Didática", year: 1, semester: 2, ects: 6, area: "Ciências da Educação" },
  { code: "11032", name: "Psicologia do Desenvolvimento", year: 1, semester: 2, ects: 6, area: "Psicologia" },
  { code: "11051", name: "Pedagogia Social", year: 1, semester: 2, ects: 6, area: "Ciências da Educação" },
  { code: "11061", name: "Metodologias de Investigação Educacional", year: 1, semester: 2, ects: 6, area: "Ciências da Educação" },
  { code: "11062", name: "Políticas Educativas na Sociedade Contemporânea", year: 1, semester: 2, ects: 6, area: "Ciências da Educação" },
  // 2º Ano – S1
  { code: "11011", name: "Educação e Diversidade Cultural", year: 2, semester: 1, ects: 6, area: "Ciências da Educação" },
  { code: "11063", name: "Media Digitais na Educação", year: 2, semester: 1, ects: 6, area: "Ciências da Educação" },
  { code: "11064", name: "Psicologia da Educação", year: 2, semester: 1, ects: 6, area: "Psicologia" },
  { code: "11065", name: "Avaliação em Educação", year: 2, semester: 1, ects: 6, area: "Ciências da Educação" },
  { code: "11067", name: "Acessibilidade em Educação e Formação", year: 2, semester: 1, ects: 6, area: "Educação" },
  // 2º Ano – S2
  { code: "11010", name: "Educação Aberta e a Distância", year: 2, semester: 2, ects: 6, area: "Ciências da Educação" },
  { code: "11026", name: "Pedagogia do Ócio e dos Tempos Livres", year: 2, semester: 2, ects: 6, area: "Ciências da Educação" },
  { code: "11066", name: "Educação e Literacias ao Longo da Vida", year: 2, semester: 2, ects: 6, area: "Ciências da Educação" },
  { code: "21044", name: "Estatística para as Ciências Sociais", year: 2, semester: 2, ects: 6, area: "Matemática" },
  { code: "41119", name: "Sociologia da Educação", year: 2, semester: 2, ects: 6, area: "Sociologia" },
  // 3º Ano – Ramo Educação e Formação (default)
  { code: "11008", name: "Conceção e Desenvolvimento de Programas de Formação", year: 3, semester: 1, ects: 6, area: "Ciências da Educação" },
  { code: "11068", name: "Pedagogia da Educação e Formação de Adultos", year: 3, semester: 1, ects: 6, area: "Ciências da Educação" },
  { code: "11126", name: "Competências Digitais na Educação e Formação", year: 3, semester: 1, ects: 6, area: "Ciências da Educação" },
  { code: "11129", name: "Projetos de Intervenção em Educação e Formação", year: 3, semester: 2, ects: 12, area: "Ciências da Educação" },
  { code: "11130", name: "Formação e Empregabilidade", year: 3, semester: 2, ects: 6, area: "Ciências da Educação" },
];

// ── Licenciatura em Estudos Europeus ──────────────────────────
export const LEE_COURSES: PlanCourseSeed[] = [
  // 1º Ano – S1
  { code: "31030", name: "História da Construção Europeia", year: 1, semester: 1, ects: 6, area: "História" },
  { code: "31041", name: "História da Idade Moderna", year: 1, semester: 1, ects: 6, area: "História" },
  { code: "51208", name: "Introdução aos Estudos Europeus", year: 1, semester: 1, ects: 6, area: "Humanidades" },
  { code: "51209", name: "A Ideia da Europa", year: 1, semester: 1, ects: 6, area: "Cultura" },
  // 1º Ano – S2
  { code: "41031", name: "Introdução à Ciência Política", year: 1, semester: 2, ects: 6, area: "Ciência Política" },
  { code: "51143", name: "Correntes Estéticas Europeias", year: 1, semester: 2, ects: 6, area: "Estudos Europeus" },
  { code: "51210", name: "Identidade, Unidade e Pluralidade na Europa", year: 1, semester: 2, ects: 6, area: "Cultura" },
  { code: "51211", name: "Europa e Descolonização", year: 1, semester: 2, ects: 6, area: "Cultura" },
  // 2º Ano – S1
  { code: "41044", name: "Política Internacional", year: 2, semester: 1, ects: 6, area: "Ciência Política" },
  { code: "41067", name: "Teoria das Relações Internacionais", year: 2, semester: 1, ects: 6, area: "Ciência Política" },
  { code: "51148", name: "História das Ideias", year: 2, semester: 1, ects: 6, area: "Filosofia" },
  // 2º Ano – S2
  { code: "31033", name: "História da Idade Contemporânea", year: 2, semester: 2, ects: 6, area: "História" },
  { code: "31113", name: "Sociedade e Cultura Europeias", year: 2, semester: 2, ects: 6, area: "Humanidades" },
  { code: "31354", name: "Os Media na Europa", year: 2, semester: 2, ects: 6, area: "Humanidades" },
  { code: "41071", name: "História Económica e Social", year: 2, semester: 2, ects: 6, area: "História" },
  // 3º Ano – Minor Economia, Direito e Sociedade (default)
  { code: "41106", name: "Direito da União Europeia", year: 3, semester: 1, ects: 6, area: "Ciências Jurídicas" },
  { code: "41116", name: "Sociologia das Migrações", year: 3, semester: 1, ects: 6, area: "Sociologia" },
  { code: "41129", name: "A Europa e a sua Agenda Social", year: 3, semester: 1, ects: 6, area: "Sociologia" },
  { code: "61096", name: "Integração e Políticas Europeias", year: 3, semester: 1, ects: 6, area: "Economia" },
  { code: "41027", name: "Globalização, Cidadania e Identidades", year: 3, semester: 2, ects: 6, area: "Sociologia" },
  { code: "41047", name: "Problemas Sociais Contemporâneos", year: 3, semester: 2, ects: 6, area: "Sociologia" },
  { code: "61044", name: "Ética Empresarial", year: 3, semester: 2, ects: 6, area: "Gestão" },
  { code: "61068", name: "Economia do Desenvolvimento Sustentável", year: 3, semester: 2, ects: 6, area: "Economia" },
];

// ── Licenciatura em Gestão de Vendas e do Retalho ─────────────
export const LGVR_COURSES: PlanCourseSeed[] = [
  // 1º Ano – S1
  { code: "21190", name: "Segurança e Saúde no Trabalho (LGVR)", year: 1, semester: 1, ects: 6, area: "Segurança e Saúde no Trabalho" },
  { code: "61070", name: "Princípios de Gestão (LGVR)", year: 1, semester: 1, ects: 6, area: "Gestão" },
  { code: "61071", name: "Marketing (LGVR)", year: 1, semester: 1, ects: 6, area: "Gestão" },
  { code: "61072", name: "Sistemas de Informação para a Gestão (LGVR)", year: 1, semester: 1, ects: 6, area: "Gestão" },
  { code: "61073", name: "Gestão de Pessoas (LGVR)", year: 1, semester: 1, ects: 6, area: "Gestão" },
  // 1º Ano – S2
  { code: "21191", name: "Matemática Aplicada à Gestão (LGVR)", year: 1, semester: 2, ects: 6, area: "Matemática" },
  { code: "41126", name: "Direito Comercial (LGVR)", year: 1, semester: 2, ects: 6, area: "Ciências Jurídicas" },
  { code: "61074", name: "Sistema Contabilístico e Fiscal (LGVR)", year: 1, semester: 2, ects: 6, area: "Gestão" },
  { code: "61075", name: "Gestão Comercial e da Distribuição (LGVR)", year: 1, semester: 2, ects: 6, area: "Gestão" },
  { code: "61076", name: "Microeconomia (LGVR)", year: 1, semester: 2, ects: 6, area: "Economia" },
  // 2º Ano – S1
  { code: "21192", name: "Transformação Digital em Vendas (LGVR)", year: 2, semester: 1, ects: 6, area: "Gestão" },
  { code: "21193", name: "Segurança Alimentar (LGVR)", year: 2, semester: 1, ects: 6, area: "Química e Bioquímica" },
  { code: "61077", name: "Análise Financeira (LGVR)", year: 2, semester: 1, ects: 6, area: "Gestão" },
  { code: "61078", name: "Gestão da Produção e Operações (LGVR)", year: 2, semester: 1, ects: 6, area: "Gestão" },
  { code: "61079", name: "Logística e Gestão da Cadeia de Abastecimento (LGVR)", year: 2, semester: 1, ects: 6, area: "Gestão" },
  // 2º Ano – S2
  { code: "41127", name: "Direito do Trabalho (LGVR)", year: 2, semester: 2, ects: 6, area: "Direito" },
  { code: "61080", name: "Economia Digital e E-Business (LGVR)", year: 2, semester: 2, ects: 6, area: "Gestão" },
  { code: "61081", name: "Gestão Estratégica (LGVR)", year: 2, semester: 2, ects: 6, area: "Gestão" },
  { code: "61082", name: "Macroeconomia (LGVR)", year: 2, semester: 2, ects: 6, area: "Economia" },
  { code: "61083", name: "Marketing de Serviços (LGVR)", year: 2, semester: 2, ects: 6, area: "Gestão" },
  // 3º Ano – S1
  { code: "61084", name: "Gestão da Qualidade (LGVR)", year: 3, semester: 1, ects: 6, area: "Gestão" },
  { code: "61085", name: "Gestão das Vendas no Retalho (LGVR)", year: 3, semester: 1, ects: 6, area: "Gestão" },
  { code: "61086", name: "Global Business (LGVR)", year: 3, semester: 1, ects: 6, area: "Gestão" },
  // 3º Ano – S2
  { code: "21195", name: "Data Analytics (LGVR)", year: 3, semester: 2, ects: 6, area: "Tecnologias de Informação" },
  { code: "41128", name: "Responsabilidade Social no Retalho (LGVR)", year: 3, semester: 2, ects: 6, area: "Ciências Sociais e Comportamentais" },
  { code: "61093", name: "Tecnologia e Inovação (LGVR)", year: 3, semester: 2, ects: 6, area: "Gestão" },
  { code: "61094", name: "Casos de Gestão (LGVR)", year: 3, semester: 2, ects: 12, area: "Gestão" },
];

// ── Licenciatura em Gestão ────────────────────────────────────
export const LGEST_COURSES: PlanCourseSeed[] = [
  // 1º Ano – S1
  { code: "21068", name: "Introdução à Estatística Aplicada", year: 1, semester: 1, ects: 6, area: "Matemática" },
  { code: "61007", name: "Contabilidade Financeira", year: 1, semester: 1, ects: 6, area: "Gestão" },
  { code: "61020", name: "Informática de Gestão", year: 1, semester: 1, ects: 6, area: "Gestão" },
  { code: "61029", name: "Princípios de Gestão", year: 1, semester: 1, ects: 6, area: "Gestão" },
  { code: "61039", name: "Comunicação em Gestão", year: 1, semester: 1, ects: 6, area: "Gestão" },
  // 1º Ano – S2
  { code: "21158", name: "Matemática Aplicada à Gestão", year: 1, semester: 2, ects: 6, area: "Matemática" },
  { code: "41020", name: "Direito Comercial", year: 1, semester: 2, ects: 6, area: "Ciências Jurídicas" },
  { code: "61005", name: "Contabilidade de Gestão", year: 1, semester: 2, ects: 6, area: "Gestão" },
  { code: "61025", name: "Marketing", year: 1, semester: 2, ects: 6, area: "Gestão" },
  { code: "61027", name: "Microeconomia", year: 1, semester: 2, ects: 6, area: "Economia" },
  // 2º Ano – S1
  { code: "21159", name: "Matemática Financeira", year: 2, semester: 1, ects: 6, area: "Matemática" },
  { code: "61011", name: "Finanças Empresariais", year: 2, semester: 1, ects: 6, area: "Gestão" },
  { code: "61017", name: "Gestão de Produção e Operações", year: 2, semester: 1, ects: 6, area: "Gestão" },
  { code: "61019", name: "Gestão de Recursos Humanos", year: 2, semester: 1, ects: 6, area: "Gestão" },
  { code: "61031", name: "Sistemas de Informação para a Gestão", year: 2, semester: 1, ects: 6, area: "Gestão" },
  // 2º Ano – S2
  { code: "21008", name: "Análise Estatística", year: 2, semester: 2, ects: 6, area: "Matemática" },
  { code: "61024", name: "Macroeconomia", year: 2, semester: 2, ects: 6, area: "Economia" },
  { code: "61036", name: "Avaliação de Investimentos", year: 2, semester: 2, ects: 6, area: "Gestão" },
  { code: "61037", name: "Tecnologias e Inovação", year: 2, semester: 2, ects: 6, area: "Economia" },
  { code: "61038", name: "Gestão Estratégica", year: 2, semester: 2, ects: 6, area: "Gestão" },
  // 3º Ano – Minor Finanças Empresariais (default)
  { code: "61008", name: "Contabilidade Financeira Avançada", year: 3, semester: 1, ects: 6, area: "Gestão" },
  { code: "61009", name: "Controlo de Gestão", year: 3, semester: 1, ects: 6, area: "Gestão" },
  { code: "61023", name: "Investimentos Financeiros", year: 3, semester: 1, ects: 6, area: "Gestão" },
  { code: "61046", name: "Fiscalidade I", year: 3, semester: 1, ects: 6, area: "Gestão" },
  { code: "61002", name: "Auditoria Financeira", year: 3, semester: 2, ects: 6, area: "Gestão" },
  { code: "61006", name: "Contabilidade de Gestão Avançada", year: 3, semester: 2, ects: 6, area: "Gestão" },
  { code: "61047", name: "Casos de Finanças", year: 3, semester: 2, ects: 6, area: "Gestão" },
  { code: "61048", name: "Contabilidade de Grupos Empresariais", year: 3, semester: 2, ects: 6, area: "Gestão" },
];

// ── Licenciatura em História ──────────────────────────────────
export const LHIS_COURSES: PlanCourseSeed[] = [
  // 1º Ano – S1
  { code: "31047", name: "História das Civilizações Clássicas", year: 1, semester: 1, ects: 6, area: "História" },
  { code: "31048", name: "História das Civilizações Pré-Clássicas", year: 1, semester: 1, ects: 6, area: "História" },
  { code: "31102", name: "Pré e Proto-História de Portugal", year: 1, semester: 1, ects: 6, area: "História" },
  { code: "31103", name: "Problemática do Conhecimento Histórico", year: 1, semester: 1, ects: 6, area: "História" },
  // 1º Ano – S2
  { code: "31037", name: "História da Idade Média", year: 1, semester: 2, ects: 6, area: "História" },
  { code: "31051", name: "História de Portugal Medieval", year: 1, semester: 2, ects: 6, area: "História" },
  { code: "31100", name: "Património Histórico e Artístico", year: 1, semester: 2, ects: 6, area: "História" },
  { code: "31120", name: "Temas de Cultura", year: 1, semester: 2, ects: 6, area: "História" },
  // 2º Ano – S1
  { code: "31041", name: "História da Idade Moderna", year: 2, semester: 1, ects: 6, area: "História" },
  { code: "31052", name: "História de Portugal Moderno", year: 2, semester: 1, ects: 6, area: "História" },
  { code: "31058", name: "História dos Descobrimentos e da Expansão Portuguesa", year: 2, semester: 1, ects: 6, area: "História" },
  { code: "31125", name: "Seminário (2ºAno/1ºSem)", year: 2, semester: 1, ects: 6, area: "História" },
  // 2º Ano – S2
  { code: "31033", name: "História da Idade Contemporânea", year: 2, semester: 2, ects: 6, area: "História" },
  { code: "31050", name: "História de Portugal Contemporâneo", year: 2, semester: 2, ects: 6, area: "História" },
  { code: "31124", name: "Teorias e Correntes Historiográficas", year: 2, semester: 2, ects: 6, area: "História" },
  { code: "31126", name: "Seminário (2ºAno/2ºSem)", year: 2, semester: 2, ects: 6, area: "História" },
  // 3º Ano – Minor Artes e Património (default)
  { code: "31008", name: "Arte do Ocidente Europeu", year: 3, semester: 1, ects: 6, area: "História da Arte" },
  { code: "31015", name: "Estética e Teoria da Arte", year: 3, semester: 1, ects: 6, area: "História da Arte" },
  { code: "31028", name: "História da Arte Portuguesa I", year: 3, semester: 1, ects: 6, area: "História da Arte" },
  { code: "31029", name: "História da Arte Portuguesa II", year: 3, semester: 2, ects: 6, area: "História da Arte" },
  { code: "31067", name: "Iniciação à Museologia", year: 3, semester: 2, ects: 6, area: "Estudos do Património" },
  { code: "31107", name: "Salvaguarda do Património Construído em Portugal", year: 3, semester: 2, ects: 6, area: "Estudos do Património" },
];

// ── Licenciatura em Humanidades ───────────────────────────────
export const LHUM_COURSES: PlanCourseSeed[] = [
  // 1º Ano – S1
  { code: "51138", name: "Introdução aos Estudos Linguísticos", year: 1, semester: 1, ects: 6, area: "Linguística" },
  { code: "51139", name: "Estudos Culturais", year: 1, semester: 1, ects: 6, area: "Cultura" },
  { code: "51141", name: "Temas da Cultura Clássica I", year: 1, semester: 1, ects: 6, area: "Cultura" },
  // 1º Ano – S2
  { code: "51142", name: "Introdução aos Estudos Literários", year: 1, semester: 2, ects: 6, area: "Literatura" },
  { code: "51143", name: "Correntes Estéticas Europeias", year: 1, semester: 2, ects: 6, area: "Estudos Europeus" },
  { code: "51144", name: "Temas da Cultura Clássica II", year: 1, semester: 2, ects: 6, area: "Cultura" },
  // 2º Ano – S1
  { code: "51146", name: "Estudos Literários Comparados", year: 2, semester: 1, ects: 6, area: "Estudos Literários" },
  { code: "51147", name: "Análise do Discurso", year: 2, semester: 1, ects: 6, area: "Linguística" },
  { code: "51148", name: "História das Ideias", year: 2, semester: 1, ects: 6, area: "Filosofia" },
  // 2º Ano – S2
  { code: "51151", name: "História da Língua Portuguesa", year: 2, semester: 2, ects: 6, area: "Linguística" },
  { code: "51152", name: "Problemáticas da Arte", year: 2, semester: 2, ects: 6, area: "Estudos Artísticos" },
  { code: "51204", name: "Escrita em Ambiente Digital", year: 2, semester: 2, ects: 6, area: "Linguística" },
  // 3º Ano – Minor Estudos Portugueses (default)
  { code: "51153", name: "Temas de Literatura Portuguesa", year: 3, semester: 1, ects: 6, area: "Estudos Literários" },
  { code: "51154", name: "Fonética, Fonologia e Morfologia do Português", year: 3, semester: 1, ects: 6, area: "Linguística" },
  { code: "51155", name: "Literaturas de Língua Portuguesa", year: 3, semester: 1, ects: 6, area: "Estudos Literários" },
  { code: "51156", name: "Estudos Interartes de Expressão Portuguesa", year: 3, semester: 1, ects: 6, area: "Estudos Literários" },
  { code: "51165", name: "Literatura Portuguesa I", year: 3, semester: 1, ects: 6, area: "Literatura" },
  { code: "51157", name: "Teoria da Literatura", year: 3, semester: 2, ects: 6, area: "Estudos Literários" },
  { code: "51158", name: "Sintaxe, Semântica e Pragmática do Português", year: 3, semester: 2, ects: 6, area: "Linguística" },
  { code: "51159", name: "Património Oral e Literatura Tradicional", year: 3, semester: 2, ects: 6, area: "Literatura" },
  { code: "51160", name: "História Cultural e Artística Portuguesa", year: 3, semester: 2, ects: 6, area: "Estudos Culturais" },
  { code: "51166", name: "Literatura Portuguesa II", year: 3, semester: 2, ects: 6, area: "Literatura" },
];

// ── Licenciatura em Línguas Aplicadas ─────────────────────────
export const LLA_COURSES: PlanCourseSeed[] = [
  // 1º Ano – S1 (obrigatórias do Maior)
  { code: "51069", name: "Técnicas de Expressão e Comunicação I", year: 1, semester: 1, ects: 6, area: "Ciências da Comunicação" },
  { code: "51138", name: "Introdução aos Estudos Linguísticos", year: 1, semester: 1, ects: 6, area: "Linguística" },
  // 1º Ano – S2
  { code: "41047", name: "Problemas Sociais Contemporâneos", year: 1, semester: 2, ects: 6, area: "Sociologia" },
  { code: "51070", name: "Técnicas de Expressão e Comunicação II", year: 1, semester: 2, ects: 6, area: "Ciências da Comunicação" },
  // 2º Ano – S2 (Maior)
  { code: "51067", name: "Sociolinguística", year: 2, semester: 2, ects: 6, area: "Linguística" },
  // 3º Ano – S1 (Maior)
  { code: "51068", name: "Técnicas de Comunicação Intercultural", year: 3, semester: 1, ects: 6, area: "Linguística" },
];

// ── Licenciatura em Matemática Aplicada à Gestão ──────────────
export const LMAG_COURSES: PlanCourseSeed[] = [
  // 1º Ano – S1
  { code: "21002", name: "Álgebra Linear I", year: 1, semester: 1, ects: 6, area: "Matemática" },
  { code: "21030", name: "Elementos de Análise Infinitesimal I", year: 1, semester: 1, ects: 6, area: "Matemática" },
  { code: "21173", name: "Introdução à Programação", year: 1, semester: 1, ects: 6, area: "Engenharia Informática" },
  { code: "61007", name: "Contabilidade Financeira", year: 1, semester: 1, ects: 6, area: "Gestão" },
  { code: "61029", name: "Princípios de Gestão", year: 1, semester: 1, ects: 6, area: "Gestão" },
  // 1º Ano – S2
  { code: "21031", name: "Elementos de Análise Infinitesimal II", year: 1, semester: 2, ects: 6, area: "Matemática" },
  { code: "21037", name: "Elementos de Probabilidades e Estatística", year: 1, semester: 2, ects: 6, area: "Matemática" },
  { code: "21076", name: "Investigação Operacional", year: 1, semester: 2, ects: 6, area: "Matemática" },
  { code: "21178", name: "Laboratório de Programação", year: 1, semester: 2, ects: 6, area: "Engenharia Informática" },
  { code: "61024", name: "Macroeconomia", year: 1, semester: 2, ects: 6, area: "Economia" },
  // 2º Ano – S1
  { code: "21032", name: "Elementos de Análise Infinitesimal III", year: 2, semester: 1, ects: 6, area: "Matemática" },
  { code: "21041", name: "Estatística Aplicada I", year: 2, semester: 1, ects: 6, area: "Matemática" },
  { code: "21053", name: "Fundamentos de Bases de Dados", year: 2, semester: 1, ects: 6, area: "Engenharia Informática" },
  { code: "21159", name: "Matemática Financeira", year: 2, semester: 1, ects: 6, area: "Matemática" },
  { code: "61020", name: "Informática de Gestão", year: 2, semester: 1, ects: 6, area: "Gestão" },
  // 2º Ano – S2
  { code: "21091", name: "Programação Matemática", year: 2, semester: 2, ects: 6, area: "Matemática" },
  { code: "21185", name: "Equações Diferenciais Aplicadas à Macroeconomia", year: 2, semester: 2, ects: 6, area: "Matemática" },
  { code: "61005", name: "Contabilidade de Gestão", year: 2, semester: 2, ects: 6, area: "Gestão" },
  { code: "61027", name: "Microeconomia", year: 2, semester: 2, ects: 6, area: "Economia" },
  { code: "61036", name: "Avaliação de Investimentos", year: 2, semester: 2, ects: 6, area: "Gestão" },
  // 3º Ano – S1
  { code: "21035", name: "Elementos de Análise Numérica", year: 3, semester: 1, ects: 6, area: "Matemática" },
  { code: "21089", name: "Processos Estocásticos Aplicados", year: 3, semester: 1, ects: 6, area: "Matemática" },
  { code: "21103", name: "Sistemas de Gestão de Bases de Dados", year: 3, semester: 1, ects: 6, area: "Engenharia Informática" },
  { code: "61023", name: "Investimentos Financeiros", year: 3, semester: 1, ects: 6, area: "Gestão" },
  // 3º Ano – S2
  { code: "21043", name: "Estatística Computacional", year: 3, semester: 2, ects: 6, area: "Matemática" },
  { code: "21073", name: "Introdução à Probabilidade e Estatística Bayesianas", year: 3, semester: 2, ects: 6, area: "Matemática" },
  { code: "21163", name: "Elementos de Estatística Multivariada", year: 3, semester: 2, ects: 6, area: "Matemática" },
  { code: "61043", name: "Economia Digital e E-Business", year: 3, semester: 2, ects: 6, area: "Economia" },
];

// ── Licenciatura em Matemática e Aplicações ───────────────────
export const LMA_COURSES: PlanCourseSeed[] = [
  // 1º Ano – S1
  { code: "21002", name: "Álgebra Linear I", year: 1, semester: 1, ects: 6, area: "Matemática" },
  { code: "21030", name: "Elementos de Análise Infinitesimal I", year: 1, semester: 1, ects: 6, area: "Matemática" },
  { code: "21079", name: "Lógica e Teoria de Conjuntos", year: 1, semester: 1, ects: 6, area: "Matemática" },
  { code: "21090", name: "Programação", year: 1, semester: 1, ects: 6, area: "Engenharia Informática" },
  { code: "21166", name: "História da Matemática", year: 1, semester: 1, ects: 6, area: "Matemática" },
  // 1º Ano – S2
  { code: "21003", name: "Álgebra Linear II", year: 1, semester: 2, ects: 6, area: "Matemática" },
  { code: "21031", name: "Elementos de Análise Infinitesimal II", year: 1, semester: 2, ects: 6, area: "Matemática" },
  { code: "21037", name: "Elementos de Probabilidades e Estatística", year: 1, semester: 2, ects: 6, area: "Matemática" },
  { code: "21082", name: "Matemática Finita", year: 1, semester: 2, ects: 6, area: "Matemática" },
  { code: "21165", name: "Geometria", year: 1, semester: 2, ects: 6, area: "Matemática" },
  // 2º Ano – S1
  { code: "21032", name: "Elementos de Análise Infinitesimal III", year: 2, semester: 1, ects: 6, area: "Matemática" },
  { code: "21035", name: "Elementos de Análise Numérica", year: 2, semester: 1, ects: 6, area: "Matemática" },
  { code: "21041", name: "Estatística Aplicada I", year: 2, semester: 1, ects: 6, area: "Matemática" },
  { code: "21133", name: "Elementos de Álgebra", year: 2, semester: 1, ects: 6, area: "Matemática" },
  { code: "21164", name: "Equações Diferenciais", year: 2, semester: 1, ects: 6, area: "Matemática" },
  // 2º Ano – S2
  { code: "21005", name: "Análise Complexa", year: 2, semester: 2, ects: 6, area: "Matemática" },
  { code: "21033", name: "Elementos de Análise Infinitesimal IV", year: 2, semester: 2, ects: 6, area: "Matemática" },
  { code: "21049", name: "Física I", year: 2, semester: 2, ects: 6, area: "Física" },
  { code: "21076", name: "Investigação Operacional", year: 2, semester: 2, ects: 6, area: "Matemática" },
  { code: "21162", name: "Curvas e Superfícies", year: 2, semester: 2, ects: 6, area: "Matemática" },
  // 3º Ano – Minor Matemática e Aplicações (default)
  { code: "21089", name: "Processos Estocásticos Aplicados", year: 3, semester: 1, ects: 6, area: "Matemática" },
  { code: "21161", name: "Análise de Fourier e Aplicações", year: 3, semester: 1, ects: 6, area: "Matemática" },
  { code: "21167", name: "Introdução à Modelação Matemática e Estatística", year: 3, semester: 1, ects: 6, area: "Matemática" },
  { code: "21091", name: "Programação Matemática", year: 3, semester: 2, ects: 6, area: "Matemática" },
  { code: "21117", name: "Topologia", year: 3, semester: 2, ects: 6, area: "Matemática" },
];
