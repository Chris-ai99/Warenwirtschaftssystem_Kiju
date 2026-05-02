"use client";

import { Keyboard, ScanLine, Search } from "lucide-react";
import { useCallback, useState } from "react";
import { normalizeBarcode } from "@/lib/barcode";
import { useScannerCapture } from "./useScannerCapture";

type Props = {
  onScan: (barcode: string) => void;
  busy?: boolean;
  initialValue?: string;
  prompt?: string;
};

export function ScannerInput({
  onScan,
  busy,
  initialValue = "",
  prompt = "Hardware-Scanbutton drücken oder Code eingeben.",
}: Props) {
  const [manual, setManual] = useState(initialValue);

  const commit = useCallback(
    (value: string) => {
      const normalized = normalizeBarcode(value);
      if (normalized.length < 3) return;
      setManual(normalized);
      onScan(normalized);
    },
    [onScan],
  );

  useScannerCapture({
    busy,
    onScan: commit,
  });

  return (
    <div className="scanner-panel">
      <div className="scan-prompt">
        <ScanLine size={34} aria-hidden />
        <div>
          <strong>Barcode scannen</strong>
          <span>{prompt}</span>
        </div>
      </div>
      <label className="field">
        <span>
          <Keyboard size={18} aria-hidden />
          Barcode eingeben
        </span>
        <div className="inline-field">
          <input
            value={manual}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) => setManual(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                commit(manual);
              }
            }}
            placeholder="z. B. 4000000000017"
          />
          <button className="icon-button filled" type="button" onClick={() => commit(manual)} disabled={busy}>
            <Search size={20} aria-hidden />
          </button>
        </div>
      </label>
    </div>
  );
}
