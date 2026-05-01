import { describe, expect, it } from "vitest";
import { depositValue, nextAfterDecrease, nextAfterIncrease } from "./stock-rules";

describe("stock rules", () => {
  it("increases stock for inbound bookings", () => {
    expect(nextAfterIncrease(10, 5)).toBe(15);
  });

  it("blocks negative stock unless explicitly allowed", () => {
    expect(nextAfterDecrease(3, 4, false)).toEqual({ next: -1, allowed: false });
    expect(nextAfterDecrease(3, 4, true)).toEqual({ next: -1, allowed: true });
  });

  it("calculates deposit value for empties", () => {
    expect(depositValue(35, 0.25)).toBe(8.75);
  });
});
