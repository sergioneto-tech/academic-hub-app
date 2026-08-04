import type { Degree } from "@/lib/types";

export type DegreeAccent = {
  color: string;
  soft: string;
  label: string;
};

const ACCENTS: Array<{ match: RegExp; accent: DegreeAccent }> = [
  { match: /inform[aá]tica|computa[cç][aã]o|engenharia/i, accent: { color: "#2563EB", soft: "#DBEAFE", label: "Azul tecnológico" } },
  { match: /gest[aã]o|economia|administra[cç][aã]o/i, accent: { color: "#059669", soft: "#D1FAE5", label: "Verde esmeralda" } },
  { match: /psicologia/i, accent: { color: "#7C3AED", soft: "#EDE9FE", label: "Violeta" } },
  { match: /direito|jur[ií]dic/i, accent: { color: "#9F1239", soft: "#FFE4E6", label: "Bordô" } },
  { match: /educa[cç][aã]o|ensino/i, accent: { color: "#D97706", soft: "#FEF3C7", label: "Âmbar" } },
  { match: /sa[uú]de|enfermagem/i, accent: { color: "#0F766E", soft: "#CCFBF1", label: "Turquesa" } },
];

export const DEFAULT_DEGREE_ACCENT: DegreeAccent = {
  color: "#2563EB",
  soft: "#DBEAFE",
  label: "Azul académico",
};

export function getDegreeAccent(degree?: Degree | null): DegreeAccent {
  if (degree?.accentColor) {
    return { color: degree.accentColor, soft: `${degree.accentColor}1A`, label: "Cor personalizada" };
  }

  const name = degree?.name ?? "";
  return ACCENTS.find((entry) => entry.match.test(name))?.accent ?? DEFAULT_DEGREE_ACCENT;
}
