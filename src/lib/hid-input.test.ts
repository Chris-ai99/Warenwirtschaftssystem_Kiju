import { describe, expect, it } from "vitest";
import { classifyHidInput } from "./hid-input";

describe("HID scanner classifier", () => {
  it("treats a fast terminated burst as a barcode scan", () => {
    const decision = classifyHidInput("4000000000017", [0, 8, 16, 24, 32, 40, 48], true);
    expect(decision).toEqual({ kind: "scan", value: "4000000000017" });
  });

  it("treats a fast scanner burst without suffix as a barcode scan", () => {
    const decision = classifyHidInput("ABC123456", [0, 12, 24, 36, 48, 60], false);
    expect(decision.kind).toBe("scan");
  });

  it("treats short digit input as a quantity", () => {
    const decision = classifyHidInput("12", [0, 280], false);
    expect(decision).toEqual({ kind: "quantity", value: "12" });
  });

  it("does not turn slow long digit input into a quantity", () => {
    const decision = classifyHidInput("123456", [0, 180, 360, 540, 720, 900], false);
    expect(decision.kind).toBe("ignore");
  });

  it("uses Enter or Tab termination for short manual barcode fallback", () => {
    const decision = classifyHidInput("ABC", [0, 160, 320], true);
    expect(decision).toEqual({ kind: "scan", value: "ABC" });
  });

  it("treats a short fast numeric scanner code as a scan, not a quantity", () => {
    const decision = classifyHidInput("1234", [0, 8, 16, 24], true);
    expect(decision).toEqual({ kind: "scan", value: "1234" });
  });

  it("keeps a slow short numeric input as a quantity", () => {
    const decision = classifyHidInput("1234", [0, 350, 700, 1050], true);
    expect(decision).toEqual({ kind: "quantity", value: "1234" });
  });
});
