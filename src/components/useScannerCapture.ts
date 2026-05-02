"use client";

import { useCallback, useEffect, useRef } from "react";
import { normalizeBarcode } from "@/lib/barcode";
import { classifyHidInput } from "@/lib/hid-input";

type NativeScanEvent = CustomEvent<{ barcode?: string }>;

type Options = {
  busy?: boolean;
  onScan: (barcode: string) => void;
  onQuantity?: (quantity: number) => void;
  onQuantityConfirm?: () => void;
};

function isTextField(element: Element | null) {
  if (!element) return false;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.dataset.scanField !== "true";
  }
  return element.getAttribute("contenteditable") === "true";
}

export function useScannerCapture({ busy, onScan, onQuantity, onQuantityConfirm }: Options) {
  const buffer = useRef("");
  const timings = useRef<number[]>([]);
  const timer = useRef<number | null>(null);
  const lastScan = useRef<{ code: string; at: number } | null>(null);

  const commitScan = useCallback(
    (value: string) => {
      const normalized = normalizeBarcode(value);
      if (normalized.length < 3) return;
      const previous = lastScan.current;
      if (previous?.code === normalized && Date.now() - previous.at < 250) return;
      lastScan.current = { code: normalized, at: Date.now() };
      onScan(normalized);
    },
    [onScan],
  );

  const clearBuffer = useCallback(() => {
    buffer.current = "";
    timings.current = [];
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const commitBuffer = useCallback(
    (terminated: boolean) => {
      const decision = classifyHidInput(buffer.current, timings.current, terminated);
      clearBuffer();
      if (decision.kind === "scan") {
        commitScan(decision.value);
        return;
      }
      if (decision.kind === "quantity" && onQuantity) {
        onQuantity(Number(decision.value));
      }
    },
    [clearBuffer, commitScan, onQuantity],
  );

  useEffect(() => {
    function scheduleCommit() {
      if (timer.current) window.clearTimeout(timer.current);
      const quantityDelay = onQuantity && /^\d{1,5}$/.test(buffer.current) ? 650 : 140;
      timer.current = window.setTimeout(() => commitBuffer(false), quantityDelay);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (busy || isTextField(document.activeElement)) return;

      if (event.key === "Enter" || event.key === "Tab") {
        if (buffer.current) {
          event.preventDefault();
          commitBuffer(true);
          return;
        }
        if (onQuantityConfirm) {
          event.preventDefault();
          onQuantityConfirm();
        }
        return;
      }

      if (event.key.length === 1) {
        event.preventDefault();
        buffer.current += event.key;
        timings.current.push(performance.now());
        scheduleCommit();
      }
    }

    function onNativeScan(event: Event) {
      if (busy) return;
      const barcode = (event as NativeScanEvent).detail?.barcode;
      if (barcode) commitScan(barcode);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("kiju-native-scan", onNativeScan);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("kiju-native-scan", onNativeScan);
      clearBuffer();
    };
  }, [busy, clearBuffer, commitBuffer, commitScan, onQuantity, onQuantityConfirm]);

  return { commitScan };
}
