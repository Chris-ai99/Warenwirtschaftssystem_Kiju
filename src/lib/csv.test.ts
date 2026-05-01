import { describe, expect, it } from "vitest";
import { escapeCsvCell, parseSimpleCsv, toCsv } from "./csv";

describe("csv helpers", () => {
  it("escapes formulas for spreadsheet exports", () => {
    expect(escapeCsvCell("=cmd")).toBe("'=cmd");
    expect(escapeCsvCell("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
  });

  it("creates semicolon-separated csv", () => {
    expect(toCsv(["Name", "Menge"], [["Wasser", 3]])).toContain("Name;Menge");
  });

  it("parses simple article csv", () => {
    const parsed = parseSimpleCsv("Artikelnummer;Name\nA-1;Wasser");
    expect(parsed.rows[0].Name).toBe("Wasser");
  });
});
