import { describe, expect, it } from "vitest";
import { buildPucImportDraft } from "@/lib/pucImportDraft";
import { parsePucText } from "@/lib/pucParser";

describe("PUC import draft", () => {
  it("maps sumative cotations without importing exam dates", () => {
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
  });

  it("reads e-fólio cotations from legacy PUC labels", () => {
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
    expect(draft.warnings).toEqual([]);
  });
});
