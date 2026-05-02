"use client";

import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, Boxes, Edit3, Recycle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArticleSummary } from "./ArticleSummary";
import { apiFetch } from "@/lib/client-api";
import { dateTime } from "@/lib/format";
import type { CurrentUser } from "@/lib/auth";
import type { ArticleDto, MovementDto, StockDto } from "@/types/domain";

type Props = { id: string; user: CurrentUser };

export function ArticleDetail({ id, user }: Props) {
  const [article, setArticle] = useState<ArticleDto | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ article: ArticleDto }>(`/api/articles/${id}`)
      .then((data) => setArticle(data.article))
      .catch((err) => setError(err instanceof Error ? err.message : "Artikel konnte nicht geladen werden."));
  }, [id]);

  const primaryBarcode = useMemo(
    () => article?.barcodes.find((barcode) => barcode.primary && !barcode.articleUnitId)?.value ?? article?.barcodes[0]?.value ?? "",
    [article],
  );
  const barcodeQuery = primaryBarcode ? `?barcode=${encodeURIComponent(primaryBarcode)}` : "";

  if (error) return <div className="status error">{error}</div>;
  if (!article) return <div className="empty-state">Artikel wird geladen...</div>;

  return (
    <section className="screen">
      <ArticleSummary article={article} />
      <div className="scanner-action-grid">
        <Link className="scan-action-card primary" href={`/scan/einbuchen${barcodeQuery}`}>
          <ArrowDownToLine size={28} aria-hidden />
          <strong>Einbuchen</strong>
        </Link>
        <Link className="scan-action-card" href={`/scan/ausbuchen${barcodeQuery}`}>
          <ArrowUpFromLine size={28} aria-hidden />
          <strong>Ausbuchen</strong>
        </Link>
        <Link className="scan-action-card" href={`/scan/umbuchen${barcodeQuery}`}>
          <ArrowRightLeft size={28} aria-hidden />
          <strong>Umbuchen</strong>
        </Link>
        <Link className="scan-action-card" href="/bestand">
          <Boxes size={28} aria-hidden />
          <strong>Bestand anzeigen</strong>
        </Link>
        {article.supportsEmpties ? (
          <Link className="scan-action-card" href={`/scan/leergut${barcodeQuery}`}>
            <Recycle size={28} aria-hidden />
            <strong>Leergut buchen</strong>
          </Link>
        ) : null}
        {user.role === "ADMIN" ? (
          <Link className="scan-action-card" href={`/artikel/${article.id}/bearbeiten`}>
            <Edit3 size={28} aria-hidden />
            <strong>Artikel bearbeiten</strong>
          </Link>
        ) : null}
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
              <span>
                {movement.quantity} · {movement.stockKind}
                {movement.unitLabel ? ` · ${movement.unitCount ?? 1} × ${movement.unitLabel}` : ""}
              </span>
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
