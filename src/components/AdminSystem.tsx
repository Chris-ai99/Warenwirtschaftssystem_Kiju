"use client";

import Link from "next/link";
import {
  Archive,
  Boxes,
  ClipboardList,
  Database,
  Download,
  FileClock,
  KeyRound,
  MapPin,
  Package,
  PackageOpen,
  Plus,
  ReceiptText,
  Save,
  ScanLine,
  Settings,
  Tags,
  ToggleLeft,
  Type,
  Upload,
  Users,
  Warehouse,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client-api";

type SectionKey =
  | "dashboard"
  | "artikel"
  | "lager"
  | "standorte"
  | "kategorien"
  | "verpackungseinheiten"
  | "benutzer"
  | "rollen-rechte"
  | "buchungsgruende"
  | "scanner"
  | "pfand-leergut"
  | "systemtexte"
  | "menues"
  | "import-export"
  | "protokolle"
  | "einstellungen";

type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "checkbox" | "textarea" | "select";
  options?: { value: string; label: string }[];
  ref?: "categories" | "locations" | "roles";
  placeholder?: string;
};

type ResourceConfig = {
  title: string;
  eyebrow: string;
  resource: string;
  dataKey: string;
  search?: boolean;
  fields: Field[];
  summary: (item: Record<string, unknown>) => string;
  detail: (item: Record<string, unknown>) => string;
  empty: Record<string, unknown>;
};

type ReferenceData = {
  categories: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  roles: { id: string; code: string; name: string }[];
  permissions: { id: string; key: string; name: string; group: string }[];
};

type ScannerAppInfo = {
  name: string;
  packageName: string;
  version: string;
  versionCode: number;
  webVersion: string;
  sizeBytes: number;
  sha256: string;
  updatedAt: string;
  downloadUrl: string;
  targetUrl: string;
};

const sections = [
  { key: "artikel", href: "/admin/artikel", title: "Artikelverwaltung", detail: "Produkte, Barcodes, Preise, Pfand und Status", icon: Package },
  { key: "lager", href: "/admin/lager", title: "Lagerverwaltung", detail: "Lager, Typen, Sichtbarkeit und Reihenfolge", icon: Warehouse },
  { key: "standorte", href: "/admin/standorte", title: "Orte / Standorte", detail: "Standorte und zugeordnete Lager", icon: MapPin },
  { key: "benutzer", href: "/admin/benutzer", title: "Benutzerverwaltung", detail: "Benutzer, Rollen und Zugriffe", icon: Users },
  { key: "rollen-rechte", href: "/admin/rollen-rechte", title: "Rollen & Rechte", detail: "Berechtigungen flexibel steuern", icon: KeyRound },
  { key: "kategorien", href: "/admin/kategorien", title: "Kategorien", detail: "Farben, Icons und Standardwerte", icon: Tags },
  { key: "verpackungseinheiten", href: "/admin/verpackungseinheiten", title: "Gebindegrößen", detail: "Einheiten und Stückzahlen", icon: Boxes },
  { key: "scanner", href: "/admin/scanner", title: "Barcode & Scanner", detail: "MUNBYN IPDA082P und Scan-Erkennung", icon: ScanLine },
  { key: "buchungsgruende", href: "/admin/buchungsgruende", title: "Buchungseinstellungen", detail: "Buchungsarten, Gründe und Notizpflicht", icon: ReceiptText },
  { key: "pfand-leergut", href: "/admin/pfand-leergut", title: "Leergut / Pfand", detail: "Pfandwerte und Leergutlogik", icon: PackageOpen },
  { key: "systemtexte", href: "/admin/systemtexte", title: "Systemtexte", detail: "Buttons und sichtbare Bezeichnungen", icon: Type },
  { key: "menues", href: "/admin/menues", title: "Menüpunkte", detail: "Buttons, Rollen-Sichtbarkeit und Startseiten", icon: ToggleLeft },
  { key: "import-export", href: "/admin/import-export", title: "Import / Export", detail: "CSV/Excel-nahe Datenübernahme und Exporte", icon: Upload },
  { key: "protokolle", href: "/admin/protokolle", title: "Protokolle / Historie", detail: "Audit-Log und Systemereignisse", icon: FileClock },
  { key: "einstellungen", href: "/admin/einstellungen", title: "Systemeinstellungen", detail: "Firma, Formate, Sicherheit und Status", icon: Settings },
] as const;

const movementOptions = [
  "STOCK_IN",
  "STOCK_OUT",
  "TRANSFER",
  "EMPTY_IN",
  "EMPTY_OUT",
  "CORRECTION",
].map((value) => ({ value, label: value }));

const stockKindOptions = [
  { value: "", label: "Alle" },
  { value: "FULL", label: "Vollgut" },
  { value: "EMPTY", label: "Leergut" },
];

const warehouseTypeOptions = [
  { value: "MAIN", label: "Hauptlager" },
  { value: "SALES", label: "Verkaufsfläche" },
  { value: "VEHICLE", label: "Fahrzeug" },
  { value: "EXTERNAL", label: "Außenlager" },
  { value: "EMPTIES", label: "Leergutlager" },
  { value: "OTHER", label: "Sonstiges" },
];

const resourceConfigs: Partial<Record<SectionKey, ResourceConfig>> = {
  artikel: {
    title: "Artikel verwalten",
    eyebrow: "Artikel",
    resource: "articles",
    dataKey: "articles",
    search: true,
    fields: [
      { key: "articleNumber", label: "Artikelnummer" },
      { key: "name", label: "Name" },
      { key: "categoryId", label: "Kategorie", type: "select", ref: "categories" },
      { key: "purchasePrice", label: "Einkaufspreis" },
      { key: "salePrice", label: "Verkaufspreis" },
      { key: "depositAmount", label: "Pfandbetrag" },
      { key: "unit", label: "Einheit" },
      { key: "lowStockThreshold", label: "Mindestbestand", type: "number" },
      { key: "barcodes", label: "Barcodes, kommagetrennt", type: "textarea" },
      { key: "imageUrl", label: "Artikelbild-URL" },
      { key: "description", label: "Beschreibung", type: "textarea" },
      { key: "supportsEmpties", label: "Leergut aktiv", type: "checkbox" },
      { key: "active", label: "Aktiv", type: "checkbox" },
    ],
    summary: (item) => String(item.name ?? "Artikel"),
    detail: (item) => `${item.articleNumber ?? ""} · ${item.active === false ? "inaktiv" : "aktiv"}`,
    empty: { articleNumber: "", name: "", purchasePrice: "0.00", salePrice: "0.00", depositAmount: "0.00", unit: "Stück", lowStockThreshold: 0, barcodes: "", active: true, supportsEmpties: false },
  },
  lager: {
    title: "Lager verwalten",
    eyebrow: "Lager",
    resource: "warehouses",
    dataKey: "warehouses",
    search: true,
    fields: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "type", label: "Lagerart", type: "select", options: warehouseTypeOptions },
      { key: "locationId", label: "Standort", type: "select", ref: "locations" },
      { key: "sortOrder", label: "Reihenfolge", type: "number" },
      { key: "isDefault", label: "Standardlager", type: "checkbox" },
      { key: "visibleToEmployees", label: "Für Mitarbeiter sichtbar", type: "checkbox" },
      { key: "active", label: "Aktiv", type: "checkbox" },
    ],
    summary: (item) => String(item.name ?? "Lager"),
    detail: (item) => `${item.code ?? ""} · ${item.type ?? ""}`,
    empty: { name: "", code: "", type: "MAIN", sortOrder: 0, isDefault: false, visibleToEmployees: true, active: true },
  },
  standorte: {
    title: "Standorte verwalten",
    eyebrow: "Standorte",
    resource: "locations",
    dataKey: "locations",
    search: true,
    fields: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "sortOrder", label: "Reihenfolge", type: "number" },
      { key: "isDefault", label: "Standardstandort", type: "checkbox" },
      { key: "active", label: "Aktiv", type: "checkbox" },
    ],
    summary: (item) => String(item.name ?? "Standort"),
    detail: (item) => `${item.code ?? ""}`,
    empty: { name: "", code: "", sortOrder: 0, isDefault: false, active: true },
  },
  kategorien: {
    title: "Kategorien verwalten",
    eyebrow: "Kategorien",
    resource: "categories",
    dataKey: "categories",
    search: true,
    fields: [
      { key: "name", label: "Name" },
      { key: "slug", label: "Slug" },
      { key: "color", label: "Farbe" },
      { key: "icon", label: "Icon" },
      { key: "defaultUnit", label: "Standard-Einheit" },
      { key: "defaultDepositAmount", label: "Standard-Pfandbetrag" },
      { key: "sortOrder", label: "Reihenfolge", type: "number" },
      { key: "depositEnabled", label: "Pfand aktiv", type: "checkbox" },
      { key: "emptiesEnabled", label: "Leergut aktiv", type: "checkbox" },
      { key: "active", label: "Aktiv", type: "checkbox" },
    ],
    summary: (item) => String(item.name ?? "Kategorie"),
    detail: (item) => `${item.slug ?? ""}`,
    empty: { name: "", slug: "", color: "#0f766e", icon: "", defaultUnit: "", defaultDepositAmount: "0.00", sortOrder: 0, depositEnabled: false, emptiesEnabled: false, active: true },
  },
  verpackungseinheiten: {
    title: "Gebindegrößen verwalten",
    eyebrow: "Einheiten",
    resource: "packaging-units",
    dataKey: "packagingUnits",
    search: true,
    fields: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "quantity", label: "Stückzahl", type: "number" },
      { key: "depositAmount", label: "Pfandbetrag" },
      { key: "categoryName", label: "Kategorie-Standard" },
      { key: "sortOrder", label: "Reihenfolge", type: "number" },
      { key: "active", label: "Aktiv", type: "checkbox" },
    ],
    summary: (item) => String(item.name ?? "Einheit"),
    detail: (item) => `${item.quantity ?? 1} Stück`,
    empty: { name: "", code: "", quantity: 1, depositAmount: "", categoryName: "", sortOrder: 0, active: true },
  },
  benutzer: {
    title: "Benutzer verwalten",
    eyebrow: "Benutzer",
    resource: "users",
    dataKey: "users",
    search: true,
    fields: [
      { key: "name", label: "Name" },
      { key: "email", label: "E-Mail / Benutzername" },
      { key: "password", label: "Neues Passwort", placeholder: "Leer lassen beim Bearbeiten" },
      { key: "roleCode", label: "Rolle", type: "select", ref: "roles" },
      { key: "active", label: "Aktiv", type: "checkbox" },
    ],
    summary: (item) => String(item.name ?? "Benutzer"),
    detail: (item) => `${item.email ?? ""} · ${formatRole(item)}`,
    empty: { name: "", email: "", password: "", roleCode: "MITARBEITER", active: true },
  },
  buchungsgruende: {
    title: "Buchungsarten und Gründe",
    eyebrow: "Buchungen",
    resource: "booking-reasons",
    dataKey: "bookingReasons",
    fields: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "movementType", label: "Buchungsart", type: "select", options: movementOptions },
      { key: "stockKind", label: "Bestandsart", type: "select", options: stockKindOptions },
      { key: "permissionKey", label: "Erforderliches Recht" },
      { key: "sortOrder", label: "Reihenfolge", type: "number" },
      { key: "noteRequired", label: "Notizpflicht", type: "checkbox" },
      { key: "isDefault", label: "Standardgrund", type: "checkbox" },
      { key: "active", label: "Aktiv", type: "checkbox" },
    ],
    summary: (item) => String(item.name ?? "Grund"),
    detail: (item) => `${item.movementType ?? ""} · ${item.noteRequired ? "Notizpflicht" : "optional"}`,
    empty: { name: "", code: "", movementType: "STOCK_OUT", stockKind: "FULL", permissionKey: "", sortOrder: 0, noteRequired: false, isDefault: false, active: true },
  },
  systemtexte: {
    title: "Systemtexte / Bezeichnungen",
    eyebrow: "Texte",
    resource: "ui-labels",
    dataKey: "uiLabels",
    search: true,
    fields: [
      { key: "key", label: "Technischer Schlüssel" },
      { key: "label", label: "Sichtbare Bezeichnung" },
      { key: "defaultLabel", label: "Standardtext" },
      { key: "area", label: "Bereich" },
      { key: "description", label: "Beschreibung", type: "textarea" },
      { key: "active", label: "Aktiv", type: "checkbox" },
    ],
    summary: (item) => String(item.label ?? "Text"),
    detail: (item) => `${item.key ?? ""} · ${item.area ?? ""}`,
    empty: { key: "", label: "", defaultLabel: "", area: "system", description: "", active: true },
  },
  menues: {
    title: "Menüpunkte und Buttons",
    eyebrow: "Oberfläche",
    resource: "menu-configs",
    dataKey: "menuConfigs",
    fields: [
      { key: "key", label: "Schlüssel" },
      { key: "label", label: "Button-Name" },
      { key: "href", label: "Ziel" },
      { key: "icon", label: "Icon" },
      { key: "roleId", label: "Nur für Rolle", type: "select", ref: "roles" },
      { key: "sortOrder", label: "Reihenfolge", type: "number" },
      { key: "visible", label: "Sichtbar", type: "checkbox" },
      { key: "isStartPage", label: "Startbildschirm", type: "checkbox" },
    ],
    summary: (item) => String(item.label ?? "Menüpunkt"),
    detail: (item) => `${item.href ?? ""}`,
    empty: { key: "", label: "", href: "/", icon: "", roleId: "", sortOrder: 0, visible: true, isStartPage: false },
  },
};

function formatRole(item: Record<string, unknown>) {
  const role = item.role as { name?: string; code?: string } | undefined;
  return role?.name ?? role?.code ?? "";
}

function valueForForm(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "object" && item && "value" in item ? String(item.value) : String(item)))
      .join(", ");
  }
  if (value === null || value === undefined) return "";
  return value;
}

function normalizeForSubmit(form: Record<string, unknown>) {
  const next = { ...form };
  if (typeof next.barcodes === "string") {
    next.barcodes = next.barcodes
      .split(/[,\n;]/)
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (next.roleId === "") next.roleId = null;
  if (next.categoryId === "") next.categoryId = null;
  if (next.locationId === "") next.locationId = null;
  if (next.stockKind === "") next.stockKind = null;
  return next;
}

export function AdminSystem({ section }: { section: SectionKey }) {
  if (section === "dashboard") return <AdminDashboard />;
  if (section === "rollen-rechte") return <RolesPanel />;
  if (section === "scanner") return <SettingsPanel kind="scanner" />;
  if (section === "pfand-leergut") return <SettingsPanel kind="deposit" />;
  if (section === "einstellungen") return <SettingsPanel kind="settings" />;
  if (section === "import-export") return <ImportExportPanel />;
  if (section === "protokolle") return <AuditPanel />;

  const config = resourceConfigs[section];
  if (!config) return <div className="status error">Admin-Bereich nicht gefunden.</div>;
  return <ResourcePanel config={config} />;
}

function AdminDashboard() {
  return (
    <div className="admin-dashboard">
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <Link key={section.key} href={section.href} className="admin-tile">
            <Icon size={28} aria-hidden />
            <strong>{section.title}</strong>
            <span>{section.detail}</span>
          </Link>
        );
      })}
    </div>
  );
}

function useReferences() {
  const [refs, setRefs] = useState<ReferenceData>({ categories: [], locations: [], roles: [], permissions: [] });

  useEffect(() => {
    Promise.all([
      apiFetch<{ categories: ReferenceData["categories"] }>("/api/admin/categories").catch(() => ({ categories: [] })),
      apiFetch<{ locations: ReferenceData["locations"] }>("/api/admin/locations").catch(() => ({ locations: [] })),
      apiFetch<{ roles: ReferenceData["roles"] }>("/api/admin/roles").catch(() => ({ roles: [] })),
      apiFetch<{ permissions: ReferenceData["permissions"] }>("/api/admin/permissions").catch(() => ({ permissions: [] })),
    ]).then(([categories, locations, roles, permissions]) => {
      setRefs({
        categories: categories.categories,
        locations: locations.locations,
        roles: roles.roles,
        permissions: permissions.permissions,
      });
    });
  }, []);

  return refs;
}

function ResourcePanel({ config }: { config: ResourceConfig }) {
  const refs = useReferences();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [form, setForm] = useState<Record<string, unknown>>(config.empty);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const data = await apiFetch<Record<string, unknown>>(
      `/api/admin/${config.resource}${config.search && search ? `?search=${encodeURIComponent(search)}` : ""}`,
    );
    setItems((data[config.dataKey] as Record<string, unknown>[]) ?? []);
  }, [config, search]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Admin-Daten konnten nicht geladen werden."));
  }, [load]);

  function edit(item: Record<string, unknown>) {
    const next: Record<string, unknown> = { ...config.empty };
    for (const field of config.fields) {
      if (field.key === "roleCode") {
        next[field.key] = (item.role as { code?: string } | undefined)?.code ?? item.roleCode ?? "";
      } else {
        next[field.key] = valueForForm(item[field.key]);
      }
    }
    setSelectedId(String(item.id ?? ""));
    setForm(next);
    setMessage("");
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const path = selectedId ? `/api/admin/${config.resource}/${selectedId}` : `/api/admin/${config.resource}`;
      await apiFetch(path, {
        method: selectedId ? "PATCH" : "POST",
        body: JSON.stringify(normalizeForSubmit(form)),
      });
      setMessage("Gespeichert.");
      setSelectedId("");
      setForm(config.empty);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  async function remove() {
    if (!selectedId) return;
    setError("");
    setMessage("");
    try {
      await apiFetch(`/api/admin/${config.resource}/${selectedId}`, { method: "DELETE" });
      setMessage("Gelöscht oder deaktiviert.");
      setSelectedId("");
      setForm(config.empty);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aktion fehlgeschlagen.");
    }
  }

  return (
    <div className="admin-workbench">
      <div className="admin-list-pane">
        <div className="screen-header">
          <div>
            <p className="eyebrow">{config.eyebrow}</p>
            <h1>{config.title}</h1>
          </div>
          <button className="secondary-action" onClick={() => { setSelectedId(""); setForm(config.empty); }}>
            <Plus size={18} aria-hidden />
            Neu
          </button>
        </div>
        {config.search ? (
          <label className="field">
            <span>Suche</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
        ) : null}
        <div className="admin-table">
          {items.map((item) => (
            <button key={String(item.id)} className="admin-row" onClick={() => edit(item)}>
              <span>
                <strong>{config.summary(item)}</strong>
                <small>{config.detail(item)}</small>
              </span>
              <em>{item.active === false || item.visible === false ? "inaktiv" : "aktiv"}</em>
            </button>
          ))}
          {items.length === 0 ? <div className="empty-state">Keine Einträge vorhanden.</div> : null}
        </div>
      </div>
      <form className="admin-form-pane" onSubmit={submit}>
        <h2>{selectedId ? "Eintrag bearbeiten" : "Eintrag anlegen"}</h2>
        <div className="form-grid">
          {config.fields.map((field) => (
            <AdminField
              key={field.key}
              field={field}
              value={form[field.key]}
              refs={refs}
              onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
            />
          ))}
        </div>
        {message ? <div className="status success wide">{message}</div> : null}
        {error ? <div className="status error wide">{error}</div> : null}
        <div className="sticky-actions wide">
          <button className="primary-action">
            <Save size={18} aria-hidden />
            Speichern
          </button>
          {selectedId ? (
            <button type="button" className="secondary-action danger-action" onClick={remove}>
              Deaktivieren / Löschen
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function AdminField({
  field,
  value,
  refs,
  onChange,
}: {
  field: Field;
  value: unknown;
  refs: ReferenceData;
  onChange: (value: unknown) => void;
}) {
  const options = useMemo(() => {
    if (field.options) return field.options;
    if (field.ref === "categories") return [{ value: "", label: "Keine Kategorie" }, ...refs.categories.map((item) => ({ value: item.id, label: item.name }))];
    if (field.ref === "locations") return [{ value: "", label: "Kein Standort" }, ...refs.locations.map((item) => ({ value: item.id, label: item.name }))];
    if (field.ref === "roles") return [{ value: "", label: "Alle Rollen" }, ...refs.roles.map((item) => ({ value: field.key === "roleCode" ? item.code : item.id, label: item.name }))];
    return [];
  }, [field, refs]);

  if (field.type === "checkbox") {
    return (
      <label className="toggle">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        {field.label}
      </label>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="field wide">
        <span>{field.label}</span>
        <textarea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder} />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className="field">
        <span>{field.label}</span>
        <select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="field">
      <span>{field.label}</span>
      <input
        type={field.type === "number" ? "number" : "text"}
        value={String(value ?? "")}
        onChange={(event) => onChange(field.type === "number" ? Number(event.target.value) : event.target.value)}
        placeholder={field.placeholder}
      />
    </label>
  );
}

function RolesPanel() {
  const refs = useReferences();
  const [roles, setRoles] = useState<Record<string, unknown>[]>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ name: "", code: "", description: "", active: true, permissionKeys: [] as string[] });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const data = await apiFetch<{ roles: Record<string, unknown>[] }>("/api/admin/roles");
    setRoles(data.roles);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Rollen konnten nicht geladen werden."));
  }, []);

  function edit(role: Record<string, unknown>) {
    const rolePermissions = (role.rolePermissions as { permission?: { key?: string } }[] | undefined) ?? [];
    setSelected(role);
    setForm({
      name: String(role.name ?? ""),
      code: String(role.code ?? ""),
      description: String(role.description ?? ""),
      active: role.active !== false,
      permissionKeys: rolePermissions.map((item) => item.permission?.key).filter(Boolean) as string[],
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiFetch(selected ? `/api/admin/roles/${selected.id}` : "/api/admin/roles", {
        method: selected ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      setMessage("Rolle gespeichert.");
      setSelected(null);
      setForm({ name: "", code: "", description: "", active: true, permissionKeys: [] });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rolle konnte nicht gespeichert werden.");
    }
  }

  return (
    <div className="admin-workbench">
      <div className="admin-list-pane">
        <div className="screen-header">
          <div>
            <p className="eyebrow">Rollen</p>
            <h1>Rollen & Rechte</h1>
          </div>
          <button className="secondary-action" onClick={() => { setSelected(null); setForm({ name: "", code: "", description: "", active: true, permissionKeys: [] }); }}>
            <Plus size={18} aria-hidden />
            Neu
          </button>
        </div>
        <div className="admin-table">
          {roles.map((role) => (
            <button key={String(role.id)} className="admin-row" onClick={() => edit(role)}>
              <span>
                <strong>{String(role.name)}</strong>
                <small>{String(role.code)} · {String((role._count as { users?: number } | undefined)?.users ?? 0)} Benutzer</small>
              </span>
              <em>{role.active === false ? "inaktiv" : "aktiv"}</em>
            </button>
          ))}
        </div>
      </div>
      <form className="admin-form-pane" onSubmit={submit}>
        <h2>{selected ? "Rolle bearbeiten" : "Rolle anlegen"}</h2>
        <div className="form-grid">
          <AdminField field={{ key: "name", label: "Name" }} value={form.name} refs={refs} onChange={(value) => setForm((current) => ({ ...current, name: String(value) }))} />
          <AdminField field={{ key: "code", label: "Code" }} value={form.code} refs={refs} onChange={(value) => setForm((current) => ({ ...current, code: String(value) }))} />
          <AdminField field={{ key: "description", label: "Beschreibung", type: "textarea" }} value={form.description} refs={refs} onChange={(value) => setForm((current) => ({ ...current, description: String(value) }))} />
          <AdminField field={{ key: "active", label: "Aktiv", type: "checkbox" }} value={form.active} refs={refs} onChange={(value) => setForm((current) => ({ ...current, active: Boolean(value) }))} />
        </div>
        <div className="permission-grid wide">
          {refs.permissions.map((permission) => (
            <label key={permission.key} className="toggle">
              <input
                type="checkbox"
                checked={form.permissionKeys.includes(permission.key)}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    permissionKeys: event.target.checked
                      ? [...current.permissionKeys, permission.key]
                      : current.permissionKeys.filter((key) => key !== permission.key),
                  }));
                }}
              />
              {permission.name}
            </label>
          ))}
        </div>
        {message ? <div className="status success wide">{message}</div> : null}
        {error ? <div className="status error wide">{error}</div> : null}
        <div className="sticky-actions wide">
          <button className="primary-action">
            <Save size={18} aria-hidden />
            Speichern
          </button>
        </div>
      </form>
    </div>
  );
}

function SettingsPanel({ kind }: { kind: "scanner" | "deposit" | "settings" }) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [scannerApp, setScannerApp] = useState<ScannerAppInfo | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const title = kind === "scanner" ? "Scanner-Einstellungen" : kind === "deposit" ? "Leergut / Pfand" : "Systemeinstellungen";
  const icon = kind === "scanner" ? <ScanLine size={24} aria-hidden /> : kind === "deposit" ? <Archive size={24} aria-hidden /> : <Settings size={24} aria-hidden />;

  useEffect(() => {
    apiFetch<Record<string, unknown>>(`/api/admin/${kind}`)
      .then((data) => setForm((data.setting as Record<string, unknown>) ?? (data.settings as Record<string, unknown>)?.system ?? {}))
      .catch((err) => setError(err instanceof Error ? err.message : "Einstellungen konnten nicht geladen werden."));
  }, [kind]);

  useEffect(() => {
    if (kind !== "scanner") return;
    apiFetch<ScannerAppInfo>("/api/scanner-app")
      .then(setScannerApp)
      .catch(() => setScannerApp(null));
  }, [kind]);

  const fields = kind === "scanner"
    ? [
        ["mode", "Scanner-Modus"], ["minBarcodeLength", "Mindestlänge"], ["scanTimeoutMs", "Scan-Zeitfenster ms"], ["duplicateWindowMs", "Doppelscan-Sperre ms"], ["defaultQuantity", "Standardmenge"],
      ]
    : kind === "deposit"
      ? [["defaultEmptiesWarehouseCode", "Standard-Leergutlager"], ["enabled", "Pfand aktiv"], ["emptiesEnabled", "Leergut aktiv"], ["separateFullAndEmpty", "Vollgut/Leergut getrennt"], ["autoCalculateDeposit", "Pfand automatisch berechnen"]]
      : [["companyName", "Firmenname"], ["language", "Sprache"], ["currency", "Währung"], ["dateFormat", "Datumsformat"], ["numberFormat", "Zahlenformat"], ["theme", "Darstellung"], ["sessionDays", "Session-Dauer Tage"], ["maintenanceMode", "Wartungsmodus"]];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      await apiFetch(`/api/admin/${kind}/${kind === "settings" ? "system" : kind}`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setMessage("Einstellungen gespeichert.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Einstellungen konnten nicht gespeichert werden.");
    }
  }

  return (
    <form className="admin-panel" onSubmit={save}>
      <div className="screen-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>{title}</h1>
        </div>
        {icon}
      </div>
      <div className="form-grid">
        {fields.map(([key, label]) => {
          const value = form[key];
          const isBool = typeof value === "boolean" || ["enabled", "emptiesEnabled", "separateFullAndEmpty", "autoCalculateDeposit", "maintenanceMode"].includes(key);
          return (
            <AdminField
              key={key}
              field={{ key, label, type: isBool ? "checkbox" : typeof value === "number" ? "number" : "text" }}
              value={value ?? (isBool ? false : "")}
              refs={{ categories: [], locations: [], roles: [], permissions: [] }}
              onChange={(next) => setForm((current) => ({ ...current, [key]: next }))}
            />
          );
        })}
      </div>
      {kind === "scanner" ? (
        <div className="scanner-app-card wide">
          <div>
            <p className="eyebrow">Scanner-App</p>
            <h2>Android-App herunterladen</h2>
            <p>
              Die APK öffnet die Warenwirtschaft unter {scannerApp?.targetUrl ?? "der aktuellen Subdomain"} und lädt
              die Web-Oberfläche bei jedem Deploy automatisch neu.
            </p>
            {scannerApp ? (
              <p className="scanner-app-meta">
                Version {scannerApp.version} · Web {scannerApp.webVersion} · {Math.ceil(scannerApp.sizeBytes / 1024)} KB
              </p>
            ) : null}
          </div>
          <a className="secondary-action" href={scannerApp?.downloadUrl ?? "/api/scanner-app/download"}>
            <Download size={18} aria-hidden />
            APK herunterladen
          </a>
        </div>
      ) : null}
      {kind === "scanner" ? (
        <div className="status info wide">
          MUNBYN IPDA082P: HID/Keyboard Wedge aktivieren, Suffix auf Enter setzen und die installierte KiJu-App starten.
        </div>
      ) : null}
      {message ? <div className="status success wide">{message}</div> : null}
      {error ? <div className="status error wide">{error}</div> : null}
      <div className="sticky-actions wide">
        <button className="primary-action">
          <Save size={18} aria-hidden />
          Speichern
        </button>
      </div>
    </form>
  );
}

function ImportExportPanel() {
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState("");

  async function importCsv() {
    const data = await apiFetch<{ imported: number; errors: { row: number; message: string }[] }>("/api/import/articles", {
      method: "POST",
      body: JSON.stringify({ csv }),
    });
    setResult(`${data.imported} Artikel importiert, ${data.errors.length} Fehler.`);
  }

  async function exportAuditLogs() {
    const data = await apiFetch<{ logs: Record<string, unknown>[] }>("/api/admin/audit-logs?take=1000");
    const blob = new Blob([JSON.stringify(data.logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "protokolle.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setResult("Protokolle wurden als JSON vorbereitet.");
  }

  return (
    <div className="admin-panel">
      <div className="screen-header">
        <div>
          <p className="eyebrow">Import / Export</p>
          <h1>Daten übernehmen und exportieren</h1>
        </div>
        <Database size={24} aria-hidden />
      </div>
      <div className="export-grid">
        <a className="secondary-action" href="/api/export/articles.csv"><Download size={18} aria-hidden />Artikel</a>
        <a className="secondary-action" href="/api/export/stock.csv"><Download size={18} aria-hidden />Bestand</a>
        <a className="secondary-action" href="/api/export/movements.csv"><Download size={18} aria-hidden />Buchungen</a>
        <button type="button" className="secondary-action" onClick={exportAuditLogs}><Download size={18} aria-hidden />Protokolle JSON</button>
      </div>
      <label className="field">
        <span>Artikel-CSV einfügen</span>
        <textarea rows={10} value={csv} onChange={(event) => setCsv(event.target.value)} placeholder="Artikelnummer;Name;Barcode;Kategorie;Einkaufspreis;Verkaufspreis" />
      </label>
      <button className="primary-action" onClick={importCsv}>
        <Upload size={18} aria-hidden />
        CSV importieren
      </button>
      {result ? <div className="status info">{result}</div> : null}
    </div>
  );
}

function AuditPanel() {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<{ logs: Record<string, unknown>[] }>("/api/admin/audit-logs?take=150")
      .then((data) => setLogs(data.logs))
      .catch((err) => setError(err instanceof Error ? err.message : "Protokolle konnten nicht geladen werden."));
  }, []);

  return (
    <div className="admin-panel">
      <div className="screen-header">
        <div>
          <p className="eyebrow">Protokolle</p>
          <h1>Audit-Log</h1>
        </div>
        <ClipboardList size={24} aria-hidden />
      </div>
      {error ? <div className="status error">{error}</div> : null}
      <div className="admin-table">
        {logs.map((log) => (
          <article key={String(log.id)} className="admin-row">
            <span>
              <strong>{String(log.action)} · {String(log.entityType)}</strong>
              <small>{String(log.area)} · {new Date(String(log.createdAt)).toLocaleString("de-DE")}</small>
            </span>
            <em>{String((log.user as { name?: string } | undefined)?.name ?? "System")}</em>
          </article>
        ))}
      </div>
    </div>
  );
}
