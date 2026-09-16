import { describe, expect, it } from "vitest";
import { normalizeExtractedPucText, textItemsToPageText } from "@/lib/pucPdf";
import { parsePucText } from "@/lib/pucParser";

describe("PUC PDF text reconstruction", () => {
  it("keeps items on the same visual line and separates rows", () => {
    const text = textItemsToPageText([
      { str: "Atividade", transform: [1, 0, 0, 1, 20, 700] },
      { str: "Sumativa 1", transform: [1, 0, 0, 1, 90, 700] },
      { str: "19/10/2026", transform: [1, 0, 0, 1, 20, 680] },
      { str: "01/11/2026", transform: [1, 0, 0, 1, 120, 680], hasEOL: true },
    ]);

    expect(text).toBe("Atividade Sumativa 1\n19/10/2026 01/11/2026");
  });

  it("ignores non-text items without failing", () => {
    expect(textItemsToPageText([{ type: "beginMarkedContent" }, null, { str: "PUC", hasEOL: true }])).toBe("PUC");
  });

  it("normalizes wrapped table labels exactly like a real PlataformAbERTA PUC", () => {
    const extracted = normalizeExtractedPucText(`
Unidade curricular: Análise Infinitesimal 2026 01
Código da Unidade Curricular (UC): 21175
Ano letivo: 2026-2027
A avaliação contínua nesta UC segue a tipologia 1.
9.1 Calendário da Avaliação Sumativa Contínua
Atividades
Sumativas
Atividade
Sumativa 1
Atividade
Sumativa 2
Atividade Sumativa
3 Atividade Sumativa 4
Cotação 3 valores 3 valores 2 valores 12 valores
Disponibilização do
enunciado e critérios
de avaliação
19/10/2026 23/11/2026 14/12/2026
Consultar o calendário de provas
Data e hora limites
de entrega
01/11/2026
23:59
07/12/2026
23:59
04/01/2027
23:59 N/A
Disponibilização da
classificação e
feedback
02/11/2026
08/12/2026
09/01/2027 A definir
`);

    const result = parsePucText(extracted);
    expect(result.events.find((item) => item.name === "Atividade Sumativa 1")).toMatchObject({
      startDate: "2026-10-19",
      endDate: "2026-11-01",
      endTime: "23:59",
      gradeReleaseDate: "2026-11-02",
    });
    expect(result.events.find((item) => item.name === "Atividade Sumativa 2")).toMatchObject({
      startDate: "2026-11-23",
      endDate: "2026-12-07",
      endTime: "23:59",
      gradeReleaseDate: "2026-12-08",
    });
    expect(result.events.find((item) => item.name === "Atividade Sumativa 3")).toMatchObject({
      startDate: "2026-12-14",
      endDate: "2027-01-04",
      endTime: "23:59",
      gradeReleaseDate: "2027-01-09",
    });
  });
});
