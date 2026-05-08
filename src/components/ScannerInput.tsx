"use client";

import { Keyboard, ScanLine, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { normalizeBarcode } from "@/lib/barcode";
import { apiFetch } from "@/lib/client-api";
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
  const [settings, setSettings] = useState({
    minBarcodeLength: 3,
    scanTimeoutMs: 90,
    duplicateWindowMs: 600,
    enterSuffix: true,
  });

  useEffect(() => {
    apiFetch<{ settings: { scanner?: Partial<typeof settings> } }>("/api/app-config")
      .then((config) => setSettings((current) => ({ ...current, ...config.settings.scanner })))
      .catch(() => undefined);
  }, []);

  const commit = useCallback(
    (value: string) => {
      const normalized = normalizeBarcode(value);
      if (normalized.length < settings.minBarcodeLength) return;
      setManual(normalized);
      onScan(normalized);
    },
    [onScan, settings.minBarcodeLength],
  );

  useScannerCapture({
    busy,
    onScan: commit,
    minBarcodeLength: settings.minBarcodeLength,
    scanTimeoutMs: settings.scanTimeoutMs,
    duplicateWindowMs: settings.duplicateWindowMs,
    enterSuffix: settings.enterSuffix,
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
