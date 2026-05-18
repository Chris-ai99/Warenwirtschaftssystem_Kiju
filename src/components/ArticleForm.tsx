"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArticleImage } from "./ArticleImage";
import { normalizeBarcode } from "@/lib/barcode";
import { apiFetch } from "@/lib/client-api";
import type { ArticleDto, ArticleUnitDto, CategoryDto } from "@/types/domain";

type UnitForm = {
  id?: string;
  label: string;
  quantity: number;
  barcode: string;
  sortOrder: number;
  isDefault: boolean;
  active: boolean;
};

type ArticleFormProps = {
  articleId?: string;
};

const beverageUnits: UnitForm[] = [
  { label: "1 Flasche", quantity: 1, barcode: "", sortOrder: 0, isDefault: true, active: true },
  { label: "3 Stück", quantity: 3, barcode: "", sortOrder: 1, isDefault: false, active: true },
  { label: "6 Stück", quantity: 6, barcode: "", sortOrder: 2, isDefault: false, active: true },
  { label: "12 Stück", quantity: 12, barcode: "", sortOrder: 3, isDefault: false, active: true },
  { label: "24 Stück / Kiste", quantity: 24, barcode: "", sortOrder: 4, isDefault: false, active: true },
];

function unitFromDto(unit: ArticleUnitDto): UnitForm {
  return {
    id: unit.id,
    label: unit.label,
    quantity: unit.quantity,
    barcode: unit.barcodes?.[0]?.value ?? "",
    sortOrder: unit.sortOrder,
    isDefault: unit.isDefault,
    active: unit.active,
  };
}

function isBeverageCategory(category?: CategoryDto | null, categoryName = "") {
  const value = `${category?.slug ?? ""} ${category?.name ?? ""} ${categoryName}`.toLowerCase();
  return value.includes("getraenke") || value.includes("getränke");
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function moneyOrZero(value: string) {
  const trimmed = value.trim();
  return trimmed || "0";
}

export function ArticleForm({ articleId }: ArticleFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBarcode = searchParams.get("barcode") ?? "";
  const initialArticleNumber = normalizeBarcode(initialBarcode);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(articleId));
  const [articleNumberTouched, setArticleNumberTouched] = useState(Boolean(articleId));
  const [form, setForm] = useState({
    barcode: initialBarcode,
    articleNumber: initialArticleNumber,
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
    units: [] as UnitForm[],
  });

  useEffect(() => {
    apiFetch<{ categories: CategoryDto[] }>("/api/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!articleId) return;
    setLoading(true);
    apiFetch<{ article: ArticleDto }>(`/api/articles/${articleId}`)
      .then(({ article }) => {
        setForm({
          barcode: article.barcodes.find((barcode) => barcode.primary && !barcode.articleUnitId)?.value ?? "",
          articleNumber: article.articleNumber,
          name: article.name,
          categoryId: article.category?.id ?? "",
          categoryName: "",
          purchasePrice: article.purchasePrice,
          salePrice: article.salePrice,
          depositAmount: article.depositAmount,
          unit: article.unit,
          description: article.description ?? "",
          imageUrl: article.imageUrl ?? "",
          active: article.active,
          supportsEmpties: article.supportsEmpties,
          lowStockThreshold: article.lowStockThreshold,
          units: (article.units ?? []).map(unitFromDto),
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Artikel konnte nicht geladen werden."))
      .finally(() => setLoading(false));
  }, [articleId]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === form.categoryId),
    [categories, form.categoryId],
  );
  const beverageCategory = isBeverageCategory(selectedCategory, form.categoryName);

  useEffect(() => {
    if (!beverageCategory || form.units.length > 0) return;
    setForm((current) => ({ ...current, units: beverageUnits }));
  }, [beverageCategory, form.units.length]);

  function update(name: string, value: string | boolean | number | UnitForm[]) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateBarcode(value: string) {
    setForm((current) => ({
      ...current,
      barcode: value,
      articleNumber:
        !articleId && !articleNumberTouched ? normalizeBarcode(value) : current.articleNumber,
    }));
  }

  function updateArticleNumber(value: string) {
    setArticleNumberTouched(true);
    update("articleNumber", value);
  }

  function updateUnit(index: number, patch: Partial<UnitForm>) {
    setForm((current) => ({
      ...current,
      units: current.units
        .map((unit, unitIndex) => {
          if (unitIndex !== index) return unit;
          const next = { ...unit, ...patch };
          return patch.isDefault ? { ...next, active: true } : next;
        })
        .map((unit, unitIndex) =>
          patch.isDefault && unitIndex !== index ? { ...unit, isDefault: false } : unit,
        ),
    }));
  }

  function addUnit() {
    setForm((current) => ({
      ...current,
      units: [
        ...current.units,
        {
          label: "Neue Gebindegröße",
          quantity: 1,
          barcode: "",
          sortOrder: current.units.length,
          isDefault: current.units.length === 0,
          active: true,
        },
      ],
    }));
  }

  function removeUnit(index: number) {
    setForm((current) => ({
      ...current,
      units: current.units.filter((_, unitIndex) => unitIndex !== index),
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId || undefined,
        categoryName: optionalText(form.categoryName),
        barcode: optionalText(form.barcode),
        purchasePrice: moneyOrZero(form.purchasePrice),
        salePrice: moneyOrZero(form.salePrice),
        depositAmount: moneyOrZero(form.depositAmount),
        description: optionalText(form.description),
        imageUrl: optionalText(form.imageUrl),
        units: form.units.map((unit, index) => ({
          ...unit,
          label: unit.label.trim(),
          barcode: optionalText(unit.barcode),
          quantity: Math.max(1, Math.trunc(Number(unit.quantity) || 1)),
          sortOrder: index,
        })),
      };
      const response = await apiFetch<{ article: { id: string } }>(
        articleId ? `/api/articles/${articleId}` : "/api/articles",
        {
          method: articleId ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );

      const returnTo = searchParams.get("returnTo");
      if (returnTo && form.barcode) {
        const url = new URL(returnTo, window.location.origin);
        url.searchParams.set("resolvedBarcode", form.barcode);
        router.push(`${url.pathname}${url.search}`);
        return;
      }

      router.push(`/artikel/${response.article.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Artikel konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="empty-state">Artikel wird geladen...</div>;

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="field">
        <span>Barcode</span>
        <input
          value={form.barcode}
          onChange={(event) => updateBarcode(event.target.value)}
          placeholder="Barcode oder externe Nummer scannen"
        />
      </label>
      <label className="field">
        <span>Artikelnummer intern</span>
        <input
          value={form.articleNumber}
          onChange={(event) => updateArticleNumber(event.target.value)}
          placeholder="Wird aus Barcode / externer Nummer übernommen"
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
        <span>Einkaufspreis ohne Pfand</span>
        <input value={form.purchasePrice} onChange={(event) => update("purchasePrice", event.target.value)} />
      </label>
      <label className="field">
        <span>Verkaufspreis ohne Pfand</span>
        <input value={form.salePrice} onChange={(event) => update("salePrice", event.target.value)} />
      </label>
      <label className="field">
        <span>Pfandbetrag</span>
        <input value={form.depositAmount} onChange={(event) => update("depositAmount", event.target.value)} />
      </label>
      <label className="field">
        <span>Basiseinheit</span>
        <input value={form.unit} onChange={(event) => update("unit", event.target.value)} />
      </label>

      {beverageCategory ? (
        <section className="unit-editor wide">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">Getränke</p>
              <h2 className="section-title">Gebindegrößen</h2>
            </div>
            <button className="secondary-action compact" type="button" onClick={addUnit}>
              <Plus size={18} aria-hidden />
              Hinzufügen
            </button>
          </div>

          {form.units.map((unit, index) => (
            <div className="unit-row" key={unit.id ?? index}>
              <label className="field">
                <span>Bezeichnung</span>
                <input value={unit.label} onChange={(event) => updateUnit(index, { label: event.target.value })} />
              </label>
              <label className="field">
                <span>Stück je Einheit</span>
                <input
                  type="number"
                  min="1"
                  value={unit.quantity}
                  onChange={(event) => updateUnit(index, { quantity: Number(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>Gebinde-Barcode optional</span>
                <input value={unit.barcode} onChange={(event) => updateUnit(index, { barcode: event.target.value })} />
              </label>
              <div className="unit-row-actions">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={unit.isDefault}
                    onChange={(event) => updateUnit(index, { isDefault: event.target.checked })}
                  />
                  Standard
                </label>
                <button className="icon-button danger" type="button" onClick={() => removeUnit(index)}>
                  <Trash2 size={18} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <label className="field wide">
        <span>Bild-URL optional</span>
        <input
          type="url"
          value={form.imageUrl}
          onChange={(event) => update("imageUrl", event.target.value)}
          placeholder="https://..."
        />
      </label>
      <ArticleImage src={form.imageUrl} alt="Vorschau Artikelbild" className="article-image-preview wide" />
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
          {busy ? "Speichern..." : articleId ? "Änderungen speichern" : "Artikel speichern"}
        </button>
      </div>
    </form>
  );
}
