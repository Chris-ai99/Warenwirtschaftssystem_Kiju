import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScannerCapture } from "./useScannerCapture";

function Harness({
  onScan,
  onQuantity,
}: {
  onScan: (barcode: string) => void;
  onQuantity?: (quantity: number) => void;
}) {
  useScannerCapture({ onScan, onQuantity });
  return <div />;
}

describe("useScannerCapture", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T08:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("suppresses duplicate native scans for the same barcode", () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);

    window.dispatchEvent(new CustomEvent("kiju-native-scan", { detail: { barcode: "4000000000017" } }));
    window.dispatchEvent(new CustomEvent("kiju-native-scan", { detail: { barcode: "4000000000017" } }));
    expect(onScan).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(260);
    window.dispatchEvent(new CustomEvent("kiju-native-scan", { detail: { barcode: "4000000000017" } }));
    expect(onScan).toHaveBeenCalledTimes(2);
  });

  it("collects Numpad-style digit input as one quantity", () => {
    const onQuantity = vi.fn();
    render(<Harness onScan={vi.fn()} onQuantity={onQuantity} />);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
    vi.advanceTimersByTime(300);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }));
    vi.advanceTimersByTime(650);

    expect(onQuantity).toHaveBeenCalledWith(12);
  });

  it("classifies a quick key burst plus Enter as a scan", () => {
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);

    for (const key of "4000000000017") {
      window.dispatchEvent(new KeyboardEvent("keydown", { key }));
      vi.advanceTimersByTime(5);
    }
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    expect(onScan).toHaveBeenCalledWith("4000000000017");
  });
});
