import { euro } from "@/lib/format";

type Stock = {
  fullQuantity: number;
  emptyQuantity: number;
  warehouse?: { name: string };
};

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
  stocks?: Stock[];
  category?: { name: string } | null;
};

export function ArticleSummary({ article }: { article: Article }) {
  const full = article.stocks?.reduce((sum, stock) => sum + stock.fullQuantity, 0) ?? 0;
  const empty = article.stocks?.reduce((sum, stock) => sum + stock.emptyQuantity, 0) ?? 0;

  return (
    <article className="article-summary">
      <div>
        <p className="eyebrow">{article.category?.name ?? "Ohne Kategorie"}</p>
        <h2>{article.name}</h2>
        <p>{article.articleNumber}</p>
      </div>
      <div className="summary-grid">
        <span>
          Vollgut
          <strong>{full}</strong>
        </span>
        <span>
          Leergut
          <strong>{empty}</strong>
        </span>
        <span>
          Verkauf
          <strong>{euro(article.salePrice)}</strong>
        </span>
        <span>
          Pfand
          <strong>{euro(article.depositAmount)}</strong>
        </span>
      </div>
      <div className="barcode-list">
        {(article.barcodes ?? []).map((barcode) => (
          <code key={barcode.value}>{barcode.value}</code>
        ))}
      </div>
    </article>
  );
}
