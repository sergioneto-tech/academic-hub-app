import { describe, expect, it } from "vitest";
import { textItemsToPageText } from "@/lib/pucPdf";

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
});
