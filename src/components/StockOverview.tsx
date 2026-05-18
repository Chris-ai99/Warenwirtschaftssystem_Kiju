"use client";

import Link from "next/link";
import { Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { euro } from "@/lib/format";

type Stock = {
  id: string;
  fullQuantity: number;
  emptyQuantity: number;
  reservedQuantity: number;
  article: {
    id: string;
    articleNumber: string;
    name: string;
    purchasePrice: string;
    salePrice: string;
    depositAmount: string;
    barcodes: { value: string; primary: boolean }[];
    category?: { name: string } | null;
  };
  warehouse: { id: string; name: string };
};

export function StockOverview() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ stocks: Stock[] }>("/api/stock")
      .then((data) => setStocks(data.stocks))
      .catch((err) => setError(err instanceof Error ? err.message : "Bestand konnte nicht geladen werden."));
  }, []);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return stocks.filter((stock) => {
      return (
        stock.article.name.toLowerCase().includes(term) ||
        stock.article.articleNumber.toLowerCase().includes(term) ||
        stock.warehouse.name.toLowerCase().includes(term) ||
        stock.article.barcodes.some((barcode) => barcode.value.includes(term))
      );
    });
  }, [stocks, search]);

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <p className="eyebrow">Bestand</p>
          <h1>Bestand je Lager</h1>
        </div>
        <a className="secondary-action" href="/api/export/stock.csv">
          <Download size={18} aria-hidden />
          CSV
        </a>
      </div>
      <label className="field">
        <span>
          <Search size={18} aria-hidden />
          Suche
        </span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      {error ? <div className="status error">{error}</div> : null}
      <div className="list">
        {filtered.map((stock) => (
          <StockRow key={stock.id} stock={stock} />
        ))}
        {filtered.length === 0 ? <div className="empty-state">Noch kein Bestand vorhanden.</div> : null}
      </div>
    </section>
  );
}

function StockRow({ stock }: { stock: Stock }) {
  const purchaseValue = Number(stock.article.purchasePrice) * stock.fullQuantity;
  const saleValue = Number(stock.article.salePrice) * stock.fullQuantity;
  const depositValue = Number(stock.article.depositAmount) * stock.emptyQuantity;

  return (
    <Link className="stock-row" href={`/artikel/${stock.article.id}`}>
      <div>
        <strong>{stock.article.name}</strong>
        <span>
          {stock.article.articleNumber} · {stock.warehouse.name}
        </span>
      </div>
      <div className="quantity-pills">
        <span>Voll {stock.fullQuantity}</span>
        <span>Leer {stock.emptyQuantity}</span>
        <span>EK-Wert {euro(purchaseValue)}</span>
        <span>VK-Wert {euro(saleValue)}</span>
        <span>Pfandwert {euro(depositValue)}</span>
      </div>
    </Link>
  );
}
