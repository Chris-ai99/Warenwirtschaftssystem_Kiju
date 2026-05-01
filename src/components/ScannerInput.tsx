"use client";

import { Keyboard, ScanLine, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeBarcode } from "@/lib/barcode";

type Props = {
  onScan: (barcode: string) => void;
  busy?: boolean;
  initialValue?: string;
};

function isTextField(element: Element | null) {
  if (!element) return false;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.dataset.scanField !== "true";
  }
  return element.getAttribute("contenteditable") === "true";
}

export function ScannerInput({ onScan, busy, initialValue = "" }: Props) {
  const [manual, setManual] = useState(initialValue);
  const buffer = useRef("");
  const timer = useRef<number | null>(null);
  const lastScan = useRef<{ code: string; at: number } | null>(null);

  const commit = useCallback((value: string) => {
    const normalized = normalizeBarcode(value);
    if (normalized.length < 3) return;
    const previous = lastScan.current;
    if (previous?.code === normalized && Date.now() - previous.at < 600) return;
    lastScan.current = { code: normalized, at: Date.now() };
    setManual(normalized);
    onScan(normalized);
  }, [onScan]);

  useEffect(() => {
    function resetTimer() {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        if (buffer.current.length >= 6) commit(buffer.current);
        buffer.current = "";
      }, 90);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (busy || isTextField(document.activeElement)) return;
      if (event.key === "Enter" || event.key === "Tab") {
        if (buffer.current) {
          event.preventDefault();
          commit(buffer.current);
          buffer.current = "";
        }
        return;
      }
      if (event.key.length === 1) {
        buffer.current += event.key;
        resetTimer();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [busy, commit]);

  return (
    <div className="scanner-panel">
      <div className="scan-prompt">
        <ScanLine size={34} aria-hidden />
        <div>
          <strong>Barcode scannen</strong>
          <span>Hardware-Scanbutton drücken oder Code eingeben.</span>
        </div>
      </div>
      <label className="field">
        <span>
          <Keyboard size={18} aria-hidden />
          Barcode eingeben
        </span>
        <div className="inline-field">
          <input
            data-scan-field="true"
            value={manual}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) => setManual(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commit(manual);
              }
            }}
            placeholder="z. B. 4000000000017"
          />
          <button className="icon-button filled" onClick={() => commit(manual)} disabled={busy}>
            <Search size={20} aria-hidden />
          </button>
        </div>
      </label>
    </div>
  );
}
