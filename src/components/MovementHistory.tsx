"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import { dateTime } from "@/lib/format";

type Movement = {
  id: string;
  createdAt: string;
  type: string;
  stockKind: string;
  quantity: number;
  reason?: string;
  note?: string;
  barcodeValue?: string;
  article: { name: string; articleNumber: string };
  user: { name: string };
  fromWarehouse?: { name: string } | null;
  toWarehouse?: { name: string } | null;
};

export function MovementHistory() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ movements: Movement[] }>("/api/movements?take=100")
      .then((data) => setMovements(data.movements))
      .catch((err) => setError(err instanceof Error ? err.message : "Verlauf konnte nicht geladen werden."));
  }, []);

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <p className="eyebrow">Historie</p>
          <h1>Buchungsverlauf</h1>
        </div>
        <a className="secondary-action" href="/api/export/movements.csv">
          <Download size={18} aria-hidden />
          CSV
        </a>
      </div>
      {error ? <div className="status error">{error}</div> : null}
      <div className="list">
        {movements.map((movement) => (
          <article key={movement.id} className="movement-row">
            <div>
              <strong>{movement.article.name}</strong>
              <span>
                {movement.type} · {movement.quantity} · {movement.stockKind}
              </span>
              <small>
                {movement.fromWarehouse?.name ?? "−"} → {movement.toWarehouse?.name ?? "−"}
              </small>
            </div>
            <div className="movement-meta">
              <span>{dateTime(movement.createdAt)}</span>
              <span>{movement.user.name}</span>
            </div>
          </article>
        ))}
        {movements.length === 0 ? <div className="empty-state">Noch keine Buchungen vorhanden.</div> : null}
      </div>
    </section>
  );
}
