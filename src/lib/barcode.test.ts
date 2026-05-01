import { describe, expect, it } from "vitest";
import { isValidBarcode, normalizeBarcode } from "./barcode";

describe("barcode helpers", () => {
  it("trims scanner suffixes and control characters", () => {
    expect(normalizeBarcode("\n 4000000000017\t")).toBe("4000000000017");
  });

  it("rejects too short barcodes", () => {
    expect(isValidBarcode("12")).toBe(false);
    expect(isValidBarcode("123")).toBe(true);
  });
});
