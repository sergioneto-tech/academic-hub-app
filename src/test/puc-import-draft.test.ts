import { describe, expect, it } from "vitest";
import { buildPucImportDraft } from "@/lib/pucImportDraft";
import { parsePucText } from "@/lib/pucParser";

describe("PUC import draft", () => {
  it("maps sumative and final-exam cotations without importing exam dates", () => {
    const text = `
Unidade curricular: Álgebra Linear I 2026 01
Ano letivo: 2026/2027
A avaliação contínua nesta UC segue a tipologia 4.
9.2 Calendarização
Atividades Sumativas Atividade Sumativa 1 Atividade de Avaliação por Exame
Cotação 6 valores 14 valores
Disponibilização do enunciado e critérios de avaliação 13/11/2026 às 13h 13/01/2027 às 13h
Data e hora limites de entrega 23/11/2026 às 23:59 13/01/2027 às 14h45
Disponibilização da classificação e feedback Até 18/12/2026 Até 12/02/2027
Época Normal: 13/01/2027
Época Recurso: 16/02/2027
`;

    const draft = buildPucImportDraft(parsePucText(text), text);

    expect(draft.model).toBe("type4");
    expect(draft.events).toHaveLength(1);
    expect(draft.events[0]).toMatchObject({
      name: "Atividade Sumativa 1",
      maxPoints: 6,
      startDate: "2026-11-13",
      endDate: "2026-11-23",
      gradeReleaseDate: "2026-12-18",
    });
    expect(draft.finalAssessment).toEqual({
      name: "Atividade de Avaliação por Exame",
      maxPoints: 14,
    });
    expect(draft.warnings.some((warning) => warning.includes("foram ignoradas"))).toBe(true);
    expect(draft.warnings.some((warning) => warning.includes("calendário oficial"))).toBe(true);
  });

  it("reads the final cotation from a sumative table even when its date is delegated to the official calendar", () => {
    const text = `
Unidade curricular: Análise Infinitesimal 2026 01
Código da Unidade Curricular (UC): 21175
Ano letivo: 2026/2027
A avaliação contínua nesta UC segue a tipologia 1.
9.1 Calendário da Avaliação Sumativa Contínua
Atividades Sumativas Atividade Sumativa 1 Atividade Sumativa 2 Atividade Sumativa 3 Atividade Sumativa 4
Cotação 3 valores 3 valores 2 valores 12 valores
Disponibilização do enunciado e critérios de avaliação 19/10/2026 23/11/2026 14/12/2026 Consultar o calendário de provas
Data e hora limites de entrega 01/11/2026 23:59 07/12/2026 23:59 04/01/2027 23:59 N/A
Disponibilização da classificação e feedback 02/11/2026 08/12/2026 09/01/2027 A definir
`;

    const draft = buildPucImportDraft(parsePucText(text), text);

    expect(draft.events.map((item) => item.maxPoints)).toEqual([3, 3, 2]);
    expect(draft.finalAssessment).toEqual({
      name: "Prova / exame final",
      maxPoints: 12,
    });
    expect(draft.warnings).toEqual([]);
  });

  it("reads e-fólio and e-fólio Global cotations from legacy PUC labels", () => {
    const text = `
Unidade curricular: Segurança em Redes e Computadores 2026 03
UNIDADE CURRICULAR 21181
Ano Letivo: 2026/2027
6.2. Calendário de avaliação contínua
E-fólio A [4 valores]
Data da especificação do trabalho a realizar no E-fólio A Data: 16/10
Envio do E-fólio A ao professor Data: 27/10
Indicação da classificação do E-fólio A Data: 09/11
E-fólio B [4 valores]
Data da especificação do trabalho a realizar no E-fólio B Data: 16/11
Envio do E-fólio B ao professor Data: 09/12
Indicação da classificação do E-fólio B Data: 18/12
e-fólio Global [12 valores] Realização Data: [consultar datas oficiais das provas]
`;

    const draft = buildPucImportDraft(parsePucText(text), text);

    expect(draft.events.map((item) => item.maxPoints)).toEqual([4, 4]);
    expect(draft.finalAssessment).toEqual({
      name: "E-fólio Global",
      maxPoints: 12,
    });
    expect(draft.warnings).toEqual([]);
  });

  it("prefers the continuous-assessment global cotation over the alternative exam cotation", () => {
    const text = `
Unidade curricular: Sistemas Distribuídos 2025 01
UNIDADE CURRICULAR 21108
Ano Letivo: 2025/2026
6.2. Calendário de avaliação contínua
E-Fólio A [4 valores]
Data da especificação do trabalho a realizar no E-Fólio A 06 de abril
Envio do E-Fólio A no espaço de turma 12 de abril
Indicação da classificação do E-Fólio A 20 de abril
E-Fólio B [4 valores]
Data da especificação do trabalho a realizar no E-Fólio B 11 de maio
Envio do E-Fólio B no espaço de turma 17 de maio
Indicação da classificação do E-Fólio B 25 de maio
E-Fólio Global 12 valores
Exame 20 valores
09-06-2026 Provas agendadas para o período da manhã Início às 10.00 horas de Portugal continental
`;

    const draft = buildPucImportDraft(parsePucText(text), text);

    expect(draft.events.map((item) => item.maxPoints)).toEqual([4, 4]);
    expect(draft.finalAssessment).toEqual({
      name: "E-fólio Global",
      maxPoints: 12,
    });
    expect(draft.warnings.some((warning) => warning.includes("foram ignoradas"))).toBe(true);
  });

  it("never exposes exam or resit dates as importable activity dates", () => {
    const text = `
Unidade curricular: Unidade de Teste 2026 01
Código da Unidade Curricular (UC): 29999
Ano letivo: 2026/2027
A avaliação contínua nesta UC segue a tipologia 4.
9.2 Calendarização
Atividades Sumativas Atividade Sumativa 1 Atividade de Avaliação por Exame
Cotação 6 valores 14 valores
Disponibilização do enunciado e critérios de avaliação 13/11/2026 13/01/2027 às 10h
Data e hora limites de entrega 23/11/2026 13/01/2027 às 12h
Disponibilização da classificação e feedback 18/12/2026 12/02/2027
Época Normal: 13/01/2027 às 10h
Época de Recurso: 16/02/2027 às 15h
`;

    const parsed = parsePucText(text);
    const draft = buildPucImportDraft(parsed, text);

    expect(parsed.events.some((item) => item.kind === "exam" && item.startDate === "2027-01-13")).toBe(true);
    expect(parsed.events.some((item) => item.kind === "resit" && item.startDate === "2027-02-16")).toBe(true);
    expect(draft.events).toHaveLength(1);
    expect(draft.events.some((item) => item.startDate === "2027-01-13" || item.startDate === "2027-02-16")).toBe(false);
    expect(draft.finalAssessment).toEqual({
      name: "Atividade de Avaliação por Exame",
      maxPoints: 14,
    });
    expect(draft.warnings.some((warning) => warning.includes("exclusivamente o calendário oficial"))).toBe(true);
  });
});
