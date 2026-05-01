"use client";

import { Download, Plus, Save, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import type { ArticleDto, CategoryDto, UserDto, WarehouseDto } from "@/types/domain";

type Kind = "artikel" | "lager" | "kategorien" | "benutzer" | "einstellungen" | "import-export";

export function AdminPanel({ kind }: { kind: Kind }) {
  if (kind === "artikel") return <ArticleAdmin />;
  if (kind === "lager") return <WarehouseAdmin />;
  if (kind === "kategorien") return <CategoryAdmin />;
  if (kind === "benutzer") return <UserAdmin />;
  if (kind === "einstellungen") return <SettingsAdmin />;
  return <ImportExportAdmin />;
}

function ArticleAdmin() {
  const [articles, setArticles] = useState<ArticleDto[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiFetch<{ articles: ArticleDto[] }>(`/api/articles?search=${encodeURIComponent(search)}`).then((data) =>
      setArticles(data.articles),
    );
  }, [search]);

  return (
    <div className="admin-panel">
      <div className="screen-header">
        <h1>Artikel verwalten</h1>
        <a className="secondary-action" href="/api/export/articles.csv">
          <Download size={18} aria-hidden />
          CSV
        </a>
      </div>
      <label className="field">
        <span>Suche</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      <div className="list">
        {articles.map((article) => (
          <a key={article.id} className="stock-row" href={`/artikel/${article.id}`}>
            <div>
              <strong>{article.name}</strong>
              <span>{article.articleNumber}</span>
            </div>
            <div className="quantity-pills">
              <span>{article.active ? "aktiv" : "inaktiv"}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function WarehouseAdmin() {
  const [warehouses, setWarehouses] = useState<WarehouseDto[]>([]);
  const [form, setForm] = useState({ name: "", code: "", type: "MAIN" });
  const [message, setMessage] = useState("");

  async function load() {
    const data = await apiFetch<{ warehouses: WarehouseDto[] }>("/api/warehouses");
    setWarehouses(data.warehouses);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await apiFetch("/api/warehouses", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", code: "", type: "MAIN" });
    setMessage("Lager gespeichert.");
    await load();
  }

  return (
    <div className="admin-panel">
      <h1>Lager verwalten</h1>
      <form className="compact-form" onSubmit={submit}>
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
        <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
          <option value="MAIN">Hauptlager</option>
          <option value="SALES">Verkaufsfläche</option>
          <option value="VEHICLE">Fahrzeug</option>
          <option value="EXTERNAL">Außenlager</option>
          <option value="EMPTIES">Leergutlager</option>
        </select>
        <button className="primary-action">
          <Plus size={18} aria-hidden />
          Lager anlegen
        </button>
      </form>
      {message ? <div className="status success">{message}</div> : null}
      <div className="list">
        {warehouses.map((warehouse) => (
          <div key={warehouse.id} className="stock-row">
            <div>
              <strong>{warehouse.name}</strong>
              <span>{warehouse.code} · {warehouse.type}</span>
            </div>
            <span>{warehouse.active ? "aktiv" : "inaktiv"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryAdmin() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [name, setName] = useState("");

  async function load() {
    const data = await apiFetch<{ categories: CategoryDto[] }>("/api/categories");
    setCategories(data.categories);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const slug = name.toLowerCase().replaceAll(" ", "-");
    await apiFetch("/api/categories", { method: "POST", body: JSON.stringify({ name, slug }) });
    setName("");
    await load();
  }

  return (
    <div className="admin-panel">
      <h1>Kategorien verwalten</h1>
      <form className="compact-form" onSubmit={submit}>
        <input placeholder="Kategoriename" value={name} onChange={(event) => setName(event.target.value)} />
        <button className="primary-action">
          <Plus size={18} aria-hidden />
          Kategorie anlegen
        </button>
      </form>
      <div className="list">
        {categories.map((category) => (
          <div key={category.id} className="stock-row">
            <strong>{category.name}</strong>
            <span>{category.active ? "aktiv" : "inaktiv"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserAdmin() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", roleCode: "MITARBEITER" });

  async function load() {
    const data = await apiFetch<{ users: UserDto[] }>("/api/users");
    setUsers(data.users);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await apiFetch("/api/users", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", email: "", password: "", roleCode: "MITARBEITER" });
    await load();
  }

  return (
    <div className="admin-panel">
      <h1>Benutzer verwalten</h1>
      <form className="compact-form" onSubmit={submit}>
        <input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <input placeholder="E-Mail" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <input placeholder="Passwort" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <select value={form.roleCode} onChange={(event) => setForm({ ...form, roleCode: event.target.value })}>
          <option value="MITARBEITER">Mitarbeiter</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button className="primary-action">
          <Plus size={18} aria-hidden />
          Benutzer anlegen
        </button>
      </form>
      <div className="list">
        {users.map((user) => (
          <div key={user.id} className="stock-row">
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <span>{user.role.code}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsAdmin() {
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [lowStockThresholdDefault, setLowStockThresholdDefault] = useState(5);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch<{ settings: Record<string, unknown> }>("/api/settings").then((data) => {
      setAllowNegativeStock(Boolean(data.settings.allowNegativeStock));
      setLowStockThresholdDefault(Number(data.settings.lowStockThresholdDefault ?? 5));
    });
  }, []);

  async function save() {
    await apiFetch("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({ allowNegativeStock, lowStockThresholdDefault }),
    });
    setMessage("Einstellungen gespeichert.");
  }

  return (
    <div className="admin-panel">
      <h1>Einstellungen</h1>
      <label className="toggle">
        <input
          type="checkbox"
          checked={allowNegativeStock}
          onChange={(event) => setAllowNegativeStock(event.target.checked)}
        />
        Negative Bestände für Admins erlauben
      </label>
      <label className="field">
        <span>Standard-Warnbestand</span>
        <input
          type="number"
          min="0"
          value={lowStockThresholdDefault}
          onChange={(event) => setLowStockThresholdDefault(Number(event.target.value))}
        />
      </label>
      <button className="primary-action" onClick={save}>
        <Save size={18} aria-hidden />
        Speichern
      </button>
      {message ? <div className="status success">{message}</div> : null}
    </div>
  );
}

function ImportExportAdmin() {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState("");

  async function importCsv() {
    const data = await apiFetch<{ imported: number; errors: { row: number; message: string }[] }>(
      "/api/import/articles",
      {
        method: "POST",
        body: JSON.stringify({ csv }),
      },
    );
    setResult(`${data.imported} Artikel importiert, ${data.errors.length} Fehler.`);
  }

  return (
    <div className="admin-panel">
      <h1>Import / Export</h1>
      <div className="export-grid">
        <a className="secondary-action" href="/api/export/articles.csv">
          <Download size={18} aria-hidden />
          Artikel
        </a>
        <a className="secondary-action" href="/api/export/stock.csv">
          <Download size={18} aria-hidden />
          Bestand
        </a>
        <a className="secondary-action" href="/api/export/movements.csv">
          <Download size={18} aria-hidden />
          Buchungen
        </a>
      </div>
      <label className="field">
        <span>Artikel-CSV einfügen</span>
        <textarea
          rows={8}
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          placeholder="Artikelnummer;Name;Barcode;Kategorie;Einkaufspreis;Verkaufspreis"
        />
      </label>
      <button className="primary-action" onClick={importCsv}>
        <Upload size={18} aria-hidden />
        CSV importieren
      </button>
      {result ? <div className="status info">{result}</div> : null}
    </div>
  );
}
