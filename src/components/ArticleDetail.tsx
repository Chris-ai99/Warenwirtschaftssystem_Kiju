"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArticleSummary } from "./ArticleSummary";
import { apiFetch } from "@/lib/client-api";
import { dateTime } from "@/lib/format";
import type { ArticleDto, MovementDto, StockDto } from "@/types/domain";

type Props = { id: string };

export function ArticleDetail({ id }: Props) {
  const [article, setArticle] = useState<ArticleDto | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ article: ArticleDto }>(`/api/articles/${id}`)
      .then((data) => setArticle(data.article))
      .catch((err) => setError(err instanceof Error ? err.message : "Artikel konnte nicht geladen werden."));
  }, [id]);

  if (error) return <div className="status error">{error}</div>;
  if (!article) return <div className="empty-state">Artikel wird geladen...</div>;

  return (
    <section className="screen">
      <ArticleSummary article={article} />
      <div className="quick-actions">
        <Link className="secondary-action" href={`/scan/einbuchen?barcode=${article.barcodes?.[0]?.value ?? ""}`}>
          Einbuchen
        </Link>
        <Link className="secondary-action" href={`/scan/ausbuchen?barcode=${article.barcodes?.[0]?.value ?? ""}`}>
          Ausbuchen
        </Link>
        <Link className="secondary-action" href={`/scan/leergut?barcode=${article.barcodes?.[0]?.value ?? ""}`}>
          Leergut
        </Link>
      </div>
      <h2 className="section-title">Bestand</h2>
      <div className="list">
        {article.stocks.map((stock: StockDto) => (
          <div key={stock.id} className="stock-row">
            <div>
              <strong>{stock.warehouse.name}</strong>
              <span>Verfügbar: {stock.fullQuantity - stock.reservedQuantity}</span>
            </div>
            <div className="quantity-pills">
              <span>Voll {stock.fullQuantity}</span>
              <span>Leer {stock.emptyQuantity}</span>
            </div>
          </div>
        ))}
      </div>
      <h2 className="section-title">Letzte Buchungen</h2>
      <div className="list">
        {(article.movements ?? []).map((movement: MovementDto) => (
          <div key={movement.id} className="movement-row">
            <div>
              <strong>{movement.type}</strong>
              <span>{movement.quantity} · {movement.stockKind}</span>
            </div>
            <div className="movement-meta">
              <span>{dateTime(movement.createdAt)}</span>
              <span>{movement.user.name}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
