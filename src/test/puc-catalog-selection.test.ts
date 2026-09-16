import { describe, expect, it } from "vitest";
import { selectUnambiguousSharedPucEntry, type SharedPucCatalogEntry } from "@/lib/pucCatalog";

function entry(overrides: Partial<SharedPucCatalogEntry>): SharedPucCatalogEntry {
  return {
    id: "catalog-1",
    course_code: "21175",
    course_name: "Análise Infinitesimal",
    academic_year: "2026/2027",
    edition: "01",
    evaluation_model: "type1",
    payload: { events: [] },
    version: 1,
    validated_at: "2026-09-16T20:00:00.000Z",
    updated_at: "2026-09-16T20:00:00.000Z",
    ...overrides,
  };
}

describe("safe shared PUC catalog selection", () => {
  it("uses the single active edition from the latest academic year", () => {
    const selected = selectUnambiguousSharedPucEntry([
      entry({ id: "old", academic_year: "2025/2026", edition: "02" }),
      entry({ id: "current", academic_year: "2026/2027", edition: "01" }),
    ]);
    expect(selected?.id).toBe("current");
  });

  it("does not silently choose between multiple editions in the latest academic year", () => {
    const selected = selectUnambiguousSharedPucEntry([
      entry({ id: "edition-01", edition: "01" }),
      entry({ id: "edition-03", edition: "03" }),
    ]);
    expect(selected).toBeNull();
  });

  it("returns null when there is no catalog entry", () => {
    expect(selectUnambiguousSharedPucEntry([])).toBeNull();
  });
});
