"use client";

import { CheckCircle2, Minus, Package, Plus, Save, ScanLine, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import type { ArticleDto, ArticleUnitDto, WarehouseDto } from "@/types/domain";
import { useScannerCapture } from "./useScannerCapture";

type LookupResponse = {
  article: ArticleDto;
  barcode: string;
  unit?: ArticleUnitDto | null;
};

type BatchRow = {
  key: string;
  status: "known" | "unknown";
  barcode: string;
  article?: ArticleDto;
  articleId?: string;
  articleName: string;
  articleNumber?: string;
  articleUnitId?: string | null;
  unitLabel: string;
  unitQuantity: number;
  unitCount: number;
  note: string;
  error?: string;
};

const draftKey = "kiju-stock-in-batch-draft";

function rowQuantity(row: BatchRow) {
  return row.unitCount * row.unitQuantity;
}

function clampPositiveInteger(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.trunc(value));
}

function isBeverage(article: ArticleDto) {
  const value = `${article.category?.slug ?? ""} ${article.category?.name ?? ""}`.toLowerCase();
  return value.includes("getraenke") || value.includes("getränke");
}

function defaultUnit(article: ArticleDto): ArticleUnitDto | null {
  const activeUnits = (article.units ?? []).filter((unit) => unit.active);
  return activeUnits.find((unit) => unit.isDefault) ?? activeUnits.find((unit) => unit.quantity === 1) ?? null;
}

function unitKey(article: ArticleDto, unit: ArticleUnitDto | null) {
  return `${article.id}:${unit?.id ?? "base"}:${unit?.quantity ?? 1}:${unit?.label ?? article.unit}`;
}

function rowFromLookup(result: LookupResponse): BatchRow {
  const unit = result.unit ?? defaultUnit(result.article);
  return {
    key: unitKey(result.article, unit),
    status: "known",
    barcode: result.barcode,
    article: result.article,
    articleId: result.article.id,
    articleName: result.article.name,
    articleNumber: result.article.articleNumber,
    articleUnitId: unit?.id ?? null,
    unitLabel: unit?.label ?? result.article.unit,
    unitQuantity: unit?.quantity ?? 1,
    unitCount: 1,
    note: "",
  };
}

function displayUnit(unit: string, quantity: number) {
  if (quantity !== 1 && unit.toLowerCase() === "flasche") return "Flaschen";
  return unit;
}

function formatLine(row: BatchRow) {
  const total = rowQuantity(row);
  if (row.unitQuantity === 1) {
    const label = row.unitLabel.replace(/^1\s+/, "");
    return `${row.unitCount} ${displayUnit(label, row.unitCount)}`;
  }
  return `${row.unitCount} × ${row.unitLabel} = ${total} ${displayUnit(row.article?.unit ?? "Stück", total)}`;
}

function createArticleUrl(barcode: string) {
  const params = new URLSearchParams({
    barcode,
    returnTo: "/scan/einbuchen",
  });
  return `/artikel/neu?${params.toString()}`;
}

export function StockInBatchFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [activeKey, setActiveKey] = useState("");
  const [lastScan, setLastScan] = useState("");
  const [batchNote, setBatchNote] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const quantityRefs = useRef(new Map<string, HTMLInputElement>());
  const scanQueue = useRef(Promise.resolve());

  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    apiFetch<{ warehouses: WarehouseDto[] }>("/api/warehouses").then((data) => {
      const activeWarehouses = data.warehouses.filter((warehouse) => warehouse.active);
      const stored = localStorage.getItem("lastWarehouseId");
      const fallback = activeWarehouses[0]?.id ?? "";
      setWarehouses(activeWarehouses);
      setWarehouseId(stored && activeWarehouses.some((warehouse) => warehouse.id === stored) ? stored : fallback);
    });

    const storedDraft = localStorage.getItem(draftKey);
    if (storedDraft) {
      try {
        const draft = JSON.parse(storedDraft) as { rows?: BatchRow[]; warehouseId?: string; batchNote?: string };
        if (draft.rows) setRows(draft.rows);
        if (draft.warehouseId) setWarehouseId(draft.warehouseId);
        if (draft.batchNote) setBatchNote(draft.batchNote);
      } catch {
        localStorage.removeItem(draftKey);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify({ rows, warehouseId, batchNote }));
  }, [batchNote, rows, warehouseId]);

  const addKnownRow = useCallback((nextRow: BatchRow) => {
    setRows((current) => {
      const withoutUnknown = current.filter(
        (row) => !(row.status === "unknown" && row.barcode === nextRow.barcode),
      );
      const existing = withoutUnknown.find((row) => row.key === nextRow.key);
      if (existing) {
        return withoutUnknown.map((row) =>
          row.key === nextRow.key ? { ...row, unitCount: row.unitCount + nextRow.unitCount, barcode: nextRow.barcode } : row,
        );
      }
      return [nextRow, ...withoutUnknown];
    });
    setActiveKey(nextRow.key);
  }, []);

  const scan = useCallback(
    async (barcode: string) => {
      setBusy(true);
      setError("");
      setSuccess("");
      setLastScan(barcode);
      try {
        const result = await apiFetch<LookupResponse>(`/api/articles/by-barcode/${encodeURIComponent(barcode)}`);
        addKnownRow(rowFromLookup(result));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Barcode wurde nicht gefunden.";
        setRows((current) => {
          if (current.some((row) => row.status === "unknown" && row.barcode === barcode)) return current;
          return [
            {
              key: `unknown:${barcode}`,
              status: "unknown",
              barcode,
              articleName: "Unbekannter Artikel",
              unitLabel: "Stück",
              unitQuantity: 1,
              unitCount: 1,
              note: "",
              error: message,
            },
            ...current,
          ];
        });
        setActiveKey(`unknown:${barcode}`);
      } finally {
        setBusy(false);
      }
    },
    [addKnownRow],
  );

  const enqueueScan = useCallback(
    (barcode: string) => {
      scanQueue.current = scanQueue.current.then(() => scan(barcode));
    },
    [scan],
  );

  useEffect(() => {
    const initialBarcode = searchParams.get("barcode");
    if (initialBarcode) {
      enqueueScan(initialBarcode);
      router.replace("/scan/einbuchen");
      return;
    }
    const resolvedBarcode = searchParams.get("resolvedBarcode");
    if (!resolvedBarcode) return;
    enqueueScan(resolvedBarcode);
    router.replace("/scan/einbuchen");
  }, [enqueueScan, router, searchParams]);

  useScannerCapture({
    onScan: enqueueScan,
    onQuantity: (quantity) => {
      if (!activeKey) return;
      setRows((current) =>
        current.map((row) =>
          row.key === activeKey && row.status === "known" ? { ...row, unitCount: clampPositiveInteger(quantity) } : row,
        ),
      );
    },
  });

  const activeRow = useMemo(() => rows.find((row) => row.key === activeKey), [activeKey, rows]);
  const totalQuantity = rows
    .filter((row) => row.status === "known")
    .reduce((sum, row) => sum + rowQuantity(row), 0);
  const hasUnknownRows = rows.some((row) => row.status === "unknown");
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === warehouseId);

  useEffect(() => {
    const input = quantityRefs.current.get(activeKey);
    if (input && document.activeElement?.tagName !== "TEXTAREA") {
      input.focus({ preventScroll: true });
      input.select();
    }
  }, [activeKey, rows.length]);

  function updateRow(key: string, patch: Partial<BatchRow>) {
    setRows((current) =>
      current.map((row) =>
        row.key === key
          ? { ...row, ...patch, unitCount: clampPositiveInteger(patch.unitCount ?? row.unitCount) }
          : row,
      ),
    );
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
    if (activeKey === key) setActiveKey("");
  }

  function clearList() {
    setRows([]);
    setActiveKey("");
    setLastScan("");
    setError("");
    setSuccess("");
    localStorage.removeItem(draftKey);
  }

  function selectUnit(row: BatchRow, unit: ArticleUnitDto) {
    if (!row.article) return;
    const nextKey = unitKey(row.article, unit);
    setRows((current) => {
      const remaining = current.filter((candidate) => candidate.key !== row.key);
      const existing = remaining.find((candidate) => candidate.key === nextKey);
      const updated: BatchRow = {
        ...row,
        key: nextKey,
        articleUnitId: unit.id,
        unitLabel: unit.label,
        unitQuantity: unit.quantity,
        unitCount: 1,
      };
      if (existing) {
        return remaining.map((candidate) =>
          candidate.key === nextKey
            ? { ...candidate, unitCount: candidate.unitCount + updated.unitCount, barcode: updated.barcode }
            : candidate,
        );
      }
      return [updated, ...remaining];
    });
    setActiveKey(nextKey);
  }

  async function submitBatch() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (!warehouseId) throw new Error("Bitte Lager auswählen.");
      if (rows.length === 0) throw new Error("Die Scanliste ist leer.");
      if (hasUnknownRows) throw new Error("Bitte zuerst alle unbekannten Artikel anlegen.");

      const items = rows.map((row) => {
        if (!row.articleId) throw new Error("Artikel fehlt in einer Position.");
        return {
          articleId: row.articleId,
          articleUnitId: row.articleUnitId ?? undefined,
          unitCount: row.unitCount,
          barcodeValue: row.barcode,
          note: row.note || undefined,
        };
      });

      await apiFetch("/api/stock/in/batch", {
        method: "POST",
        body: JSON.stringify({ warehouseId, note: batchNote || undefined, items }),
      });
      localStorage.setItem("lastWarehouseId", warehouseId);
      clearList();
      setSuccess("Gemeinsame Einbuchung gespeichert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gemeinsame Einbuchung konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen scan-batch-screen">
      <div className="screen-header">
        <div>
          <p className="eyebrow">Massen-Scan</p>
          <h1>Bestand einbuchen</h1>
        </div>
      </div>

      <div className="batch-toolbar">
        <label className="field">
          <span>Lager</span>
          <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </select>
        </label>
        <div className="scan-state-card">
          <ScanLine size={26} aria-hidden />
          <div>
            <strong>{activeRow?.status === "known" ? "Menge per Numpad möglich" : "Bereit für Scan"}</strong>
            <span>{selectedWarehouse?.name ?? "Kein Lager ausgewählt"}</span>
          </div>
        </div>
      </div>

      <div className="last-scan-panel">
        <span>Letzter Scan</span>
        <strong>{lastScan || "Noch kein Scan"}</strong>
      </div>

      {activeRow?.article && isBeverage(activeRow.article) ? (
        <div className="package-picker">
          <div>
            <strong>Gebinde auswählen</strong>
            <span>Ohne Auswahl zählt der Scan als Standard-Einheit.</span>
          </div>
          <div className="package-chip-row">
            {(activeRow.article.units ?? []).filter((unit) => unit.active).map((unit) => (
              <button
                key={unit.id}
                type="button"
                className={activeRow.articleUnitId === unit.id ? "package-chip active" : "package-chip"}
                onClick={() => selectUnit(activeRow, unit)}
              >
                <Package size={16} aria-hidden />
                {unit.label}
              </button>
            ))}
          </div>
          {activeRow.unitQuantity > 1 ? (
            <div className="status info package-prompt">
              Wie viele {activeRow.unitLabel}? Menge per Numpad eingeben und Enter drücken.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="batch-list">
        {rows.length === 0 ? (
          <div className="empty-state">Lager wählen und Artikel scannen.</div>
        ) : (
          rows.map((row) => (
            <article
              key={row.key}
              className={row.key === activeKey ? "batch-row active" : "batch-row"}
              onClick={() => setActiveKey(row.key)}
            >
              <div className="batch-row-main">
                <div>
                  <strong>{row.articleName}</strong>
                  <span>{row.status === "known" ? row.articleNumber : row.barcode}</span>
                </div>
                <button
                  className="icon-button danger"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeRow(row.key);
                  }}
                  aria-label="Position entfernen"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>

              {row.status === "unknown" ? (
                <div className="status warning batch-row-status">
                  <span>Unbekannter Barcode: {row.barcode}</span>
                  <Link className="secondary-action compact" href={createArticleUrl(row.barcode)}>
                    Jetzt Artikel anlegen
                  </Link>
                </div>
              ) : (
                <>
                  <div className="batch-quantity-row">
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => updateRow(row.key, { unitCount: row.unitCount - 1 })}
                    >
                      <Minus size={18} aria-hidden />
                    </button>
                    <label className="batch-quantity-input">
                      <span>Menge</span>
                      <input
                        ref={(element) => {
                          if (element) quantityRefs.current.set(row.key, element);
                          else quantityRefs.current.delete(row.key);
                        }}
                        name="unitCount"
                        data-scan-field="true"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        value={row.unitCount}
                        onChange={(event) => updateRow(row.key, { unitCount: Number(event.target.value) })}
                      />
                    </label>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => updateRow(row.key, { unitCount: row.unitCount + 1 })}
                    >
                      <Plus size={18} aria-hidden />
                    </button>
                    <strong className="batch-total">{formatLine(row)}</strong>
                  </div>
                  <label className="field">
                    <span>Notiz optional</span>
                    <input value={row.note} onChange={(event) => updateRow(row.key, { note: event.target.value })} />
                  </label>
                </>
              )}
            </article>
          ))
        )}
      </div>

      <label className="field">
        <span>Notiz zur gemeinsamen Buchung optional</span>
        <textarea value={batchNote} onChange={(event) => setBatchNote(event.target.value)} />
      </label>

      {success ? (
        <div className="status success">
          <CheckCircle2 size={20} aria-hidden />
          {success}
        </div>
      ) : null}
      {error ? <div className="status error">{error}</div> : null}
      {!online ? <div className="status warning">Offline - Buchungen nicht möglich.</div> : null}

      <div className="sticky-actions batch-actions">
        <button className="secondary-action" type="button" onClick={clearList} disabled={busy || rows.length === 0}>
          Liste leeren
        </button>
        <button className="primary-action" type="button" onClick={submitBatch} disabled={busy || !online || rows.length === 0}>
          <Save size={20} aria-hidden />
          {busy ? "Speichern..." : `Gemeinsam buchen (${totalQuantity})`}
        </button>
      </div>
    </section>
  );
}
