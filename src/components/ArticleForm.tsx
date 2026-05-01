"use client";

import { Save } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";

type Category = { id: string; name: string };

export function ArticleForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    barcode: searchParams.get("barcode") ?? "",
    articleNumber: "",
    name: "",
    categoryId: "",
    categoryName: "",
    purchasePrice: "0.00",
    salePrice: "0.00",
    depositAmount: "0.00",
    unit: "Stück",
    description: "",
    imageUrl: "",
    active: true,
    supportsEmpties: false,
    lowStockThreshold: 0,
  });

  useEffect(() => {
    apiFetch<{ categories: Category[] }>("/api/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  function update(name: string, value: string | boolean | number) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch<{ article: { id: string } }>("/api/articles", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          categoryId: form.categoryId || undefined,
          categoryName: form.categoryName || undefined,
        }),
      });
      router.push(`/artikel/${response.article.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Artikel konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="field">
        <span>Barcode</span>
        <input
          value={form.barcode}
          onChange={(event) => update("barcode", event.target.value)}
          placeholder="Barcode scannen oder eingeben"
        />
      </label>
      <label className="field">
        <span>Artikelnummer intern</span>
        <input
          value={form.articleNumber}
          onChange={(event) => update("articleNumber", event.target.value)}
          required
        />
      </label>
      <label className="field wide">
        <span>Artikelname</span>
        <input value={form.name} onChange={(event) => update("name", event.target.value)} required />
      </label>
      <label className="field">
        <span>Kategorie</span>
        <select value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
          <option value="">Neue Kategorie verwenden</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Neue Kategorie</span>
        <input value={form.categoryName} onChange={(event) => update("categoryName", event.target.value)} />
      </label>
      <label className="field">
        <span>Einkaufspreis</span>
        <input value={form.purchasePrice} onChange={(event) => update("purchasePrice", event.target.value)} />
      </label>
      <label className="field">
        <span>Verkaufspreis</span>
        <input value={form.salePrice} onChange={(event) => update("salePrice", event.target.value)} />
      </label>
      <label className="field">
        <span>Pfandbetrag</span>
        <input value={form.depositAmount} onChange={(event) => update("depositAmount", event.target.value)} />
      </label>
      <label className="field">
        <span>Einheit</span>
        <input value={form.unit} onChange={(event) => update("unit", event.target.value)} />
      </label>
      <label className="field wide">
        <span>Bild-URL optional</span>
        <input value={form.imageUrl} onChange={(event) => update("imageUrl", event.target.value)} />
      </label>
      <label className="field wide">
        <span>Beschreibung</span>
        <textarea value={form.description} onChange={(event) => update("description", event.target.value)} />
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={form.supportsEmpties}
          onChange={(event) => update("supportsEmpties", event.target.checked)}
        />
        Leergut/Pfandartikel unterstützt
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(event) => update("active", event.target.checked)}
        />
        Artikel ist aktiv
      </label>
      {error ? <div className="status error wide">{error}</div> : null}
      <div className="sticky-actions wide">
        <button className="primary-action" disabled={busy}>
          <Save size={20} aria-hidden />
          {busy ? "Speichern..." : "Artikel speichern"}
        </button>
      </div>
    </form>
  );
}
