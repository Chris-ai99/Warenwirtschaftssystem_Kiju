"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, RotateCcw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArticleSummary } from "./ArticleSummary";
import { ScannerInput } from "./ScannerInput";
import { StockInBatchFlow } from "./StockInBatchFlow";
import { apiFetch } from "@/lib/client-api";
import { euro } from "@/lib/format";
import type { CurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

type Warehouse = { id: string; name: string; active: boolean };
type Article = {
  id: string;
  name: string;
  articleNumber: string;
  unit: string;
  salePrice: string;
  purchasePrice: string;
  depositAmount: string;
  supportsEmpties: boolean;
  barcodes?: { value: string; primary: boolean }[];
  stocks?: { fullQuantity: number; emptyQuantity: number; warehouse?: { name: string } }[];
  category?: { name: string } | null;
};

const titles: Record<string, string> = {
  suchen: "Artikel suchen",
  einbuchen: "Bestand einbuchen",
  ausbuchen: "Bestand ausbuchen",
  umbuchen: "Lager umbuchen",
  leergut: "Leergut erfassen",
};

const reasonOptions = [
  ["VERKAUF", "Verkauf"],
  ["BRUCH", "Bruch"],
  ["VERLUST", "Verlust"],
  ["KORREKTUR", "Korrektur"],
  ["EIGENVERBRAUCH", "Eigenverbrauch"],
  ["SONSTIGES", "Sonstiges"],
];

type BookingReason = {
  code: string;
  name: string;
  movementType: string;
  active: boolean;
};

export function ScanFlow({ mode, user }: { mode: string; user: CurrentUser }) {
  const searchParams = useSearchParams();
  const [barcode, setBarcode] = useState("");
  const [article, setArticle] = useState<Article | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("VERKAUF");
  const [bookingReasons, setBookingReasons] = useState(reasonOptions);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [emptyAction, setEmptyAction] = useState<"in" | "out">("in");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);

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
    apiFetch<{ warehouses: Warehouse[] }>("/api/warehouses").then((data) => {
      const activeWarehouses = data.warehouses.filter((warehouse) => warehouse.active);
      setWarehouses(activeWarehouses);
      const last = localStorage.getItem("lastWarehouseId");
      const fallback = activeWarehouses[0]?.id ?? "";
      setWarehouseId(last && activeWarehouses.some((warehouse) => warehouse.id === last) ? last : fallback);
      setTargetWarehouseId(activeWarehouses.find((warehouse) => warehouse.id !== last)?.id ?? fallback);
    });
  }, []);

  useEffect(() => {
    apiFetch<{ labels: Record<string, string> }>("/api/app-config")
      .then((config) => setLabels(config.labels))
      .catch(() => undefined);
    apiFetch<{ bookingReasons: BookingReason[] }>("/api/booking-reasons?movementType=STOCK_OUT&stockKind=FULL")
      .then((data) => {
        const options = data.bookingReasons
          .filter((item) => item.active && item.movementType === "STOCK_OUT")
          .map((item) => [item.code, item.name]);
        if (options.length) setBookingReasons(options);
      })
      .catch(() => undefined);
  }, []);

  const scan = useCallback(async (value: string) => {
    setBusy(true);
    setError("");
    setSuccess("");
    setArticle(null);
    setBarcode(value);
    try {
      const response = await apiFetch<{ article: Article }>(
        `/api/articles/by-barcode/${encodeURIComponent(value)}`,
      );
      setArticle(response.article);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Barcode wurde nicht gefunden.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const initialBarcode = searchParams.get("barcode");
    if (mode !== "einbuchen" && initialBarcode && !barcode && !article) {
      scan(initialBarcode);
    }
  }, [article, barcode, mode, scan, searchParams]);

  const title =
    mode === "einbuchen"
      ? labels["action.stockIn"] ?? titles[mode]
      : mode === "ausbuchen"
        ? labels["action.stockOut"] ?? titles[mode]
        : mode === "umbuchen"
          ? labels["action.transfer"] ?? titles[mode]
          : mode === "leergut"
            ? labels["action.empties"] ?? titles[mode]
            : titles[mode] ?? "Artikel suchen";
  const isBookingMode = mode !== "suchen";
  const depositValue = useMemo(
    () => Number(article?.depositAmount ?? 0) * quantity,
    [article?.depositAmount, quantity],
  );

  if (mode === "einbuchen") {
    return <StockInBatchFlow />;
  }

  if (!["suchen", "ausbuchen", "umbuchen", "leergut"].includes(mode)) {
    return <div className="status error">Unbekannter Scan-Modus.</div>;
  }

  async function submitMovement(event: React.FormEvent) {
    event.preventDefault();
    if (!article) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      localStorage.setItem("lastWarehouseId", warehouseId);
      let path = "/api/stock/in";
      let body: Record<string, unknown> = {
        articleId: article.id,
        warehouseId,
        quantity,
        barcodeValue: barcode,
        note,
      };

      if (mode === "einbuchen") {
        body.unitCost = unitCost || undefined;
      }
      if (mode === "ausbuchen") {
        path = "/api/stock/out";
        body.reason = reason;
      }
      if (mode === "umbuchen") {
        path = "/api/stock/transfer";
        body = {
          articleId: article.id,
          fromWarehouseId: warehouseId,
          toWarehouseId: targetWarehouseId,
          quantity,
          barcodeValue: barcode,
          note,
        };
      }
      if (mode === "leergut") {
        path = emptyAction === "in" ? "/api/stock/empties/in" : "/api/stock/empties/out";
      }

      await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
      setSuccess("Buchung gespeichert.");
      setNote("");
      setQuantity(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Buchung konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setArticle(null);
    setBarcode("");
    setError("");
    setSuccess("");
  }

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <p className="eyebrow">HID-Scanner aktiv</p>
          <h1>{title}</h1>
        </div>
      </div>

      <ScannerInput onScan={scan} busy={busy} />

      {error && !article ? (
        <div className="status error">
          <strong>{error}</strong>
          <span>Barcode: {barcode}</span>
          {hasPermission(user, "article:write") && barcode ? (
            <Link className="secondary-action" href={`/artikel/neu?barcode=${encodeURIComponent(barcode)}`}>
              Artikel anlegen
            </Link>
          ) : null}
        </div>
      ) : null}

      {article ? (
        <div className="flow-stack">
          <ArticleSummary article={article} />

          {mode === "suchen" ? (
            <div className="sticky-actions">
              <Link className="primary-action" href={`/artikel/${article.id}`}>
                Details anzeigen
              </Link>
              <button className="secondary-action" onClick={reset}>
                <RotateCcw size={18} aria-hidden />
                Nächsten Artikel scannen
              </button>
            </div>
          ) : null}

          {isBookingMode ? (
            <form className="movement-form" onSubmit={submitMovement}>
              {mode === "leergut" ? (
                <div className="segmented">
                  <button
                    type="button"
                    className={emptyAction === "in" ? "active" : ""}
                    onClick={() => setEmptyAction("in")}
                  >
                    Leergut zurück
                  </button>
                  <button
                    type="button"
                    className={emptyAction === "out" ? "active" : ""}
                    onClick={() => setEmptyAction("out")}
                  >
                    Leergut raus
                  </button>
                </div>
              ) : null}

              <label className="field">
                <span>{mode === "umbuchen" ? "Quelllager" : "Lager"}</span>
                <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>

              {mode === "umbuchen" ? (
                <label className="field">
                  <span>Ziellager</span>
                  <select
                    value={targetWarehouseId}
                    onChange={(event) => setTargetWarehouseId(event.target.value)}
                  >
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="field">
                <span>Menge</span>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                />
              </label>

              {mode === "einbuchen" ? (
                <label className="field">
                  <span>Einkaufspreis optional</span>
                  <input value={unitCost} onChange={(event) => setUnitCost(event.target.value)} />
                </label>
              ) : null}

              {mode === "ausbuchen" ? (
                <label className="field">
                  <span>Grund</span>
                  <select value={reason} onChange={(event) => setReason(event.target.value)}>
                    {bookingReasons.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {mode === "leergut" ? (
                <div className="status info">Pfandwert: {euro(depositValue)}</div>
              ) : null}

              <label className="field">
                <span>Notiz optional</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} />
              </label>

              {success ? (
                <div className="status success">
                  <CheckCircle2 size={20} aria-hidden />
                  {success}
                </div>
              ) : null}
              {error ? <div className="status error">{error}</div> : null}
              {!online ? <div className="status warning">Offline - Buchungen nicht möglich.</div> : null}

              <div className="sticky-actions">
                <button className="primary-action" disabled={busy || !online}>
                  <Save size={20} aria-hidden />
                  {busy ? "Speichern..." : "Buchung speichern"}
                </button>
                <button type="button" className="secondary-action" onClick={reset}>
                  Nächster Artikel
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
