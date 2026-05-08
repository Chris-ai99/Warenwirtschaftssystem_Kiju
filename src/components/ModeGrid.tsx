"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ClipboardList,
  History,
  PackagePlus,
  PackageSearch,
  Recycle,
  Settings,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { apiFetch } from "@/lib/client-api";

const iconByName = {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ClipboardList,
  History,
  PackagePlus,
  PackageSearch,
  Recycle,
};

const fallbackModes = [
  { key: "suchen", href: "/scan/suchen", label: "Artikel suchen", detail: "Barcode scannen oder manuell suchen", icon: "PackageSearch" },
  { key: "artikel-neu", href: "/artikel/neu", label: "Artikel anlegen", detail: "Neuen Artikel mit Barcode erfassen", icon: "PackagePlus" },
  { key: "einbuchen", href: "/scan/einbuchen", label: "Einbuchen", detail: "Vollgut in ein Lager buchen", icon: "ArrowDownToLine" },
  { key: "ausbuchen", href: "/scan/ausbuchen", label: "Ausbuchen", detail: "Verkauf, Bruch oder Korrektur", icon: "ArrowUpFromLine" },
  { key: "umbuchen", href: "/scan/umbuchen", label: "Umbuchen", detail: "Bestand zwischen Lagern bewegen", icon: "ArrowLeftRight" },
  { key: "leergut", href: "/scan/leergut", label: "Leergut", detail: "Pfandbestand separat erfassen", icon: "Recycle" },
  { key: "bestand", href: "/bestand", label: "Bestand", detail: "Vollgut, Leergut und Lager anzeigen", icon: "ClipboardList" },
  { key: "buchungen", href: "/buchungen", label: "Verlauf", detail: "Alle Buchungen nachvollziehen", icon: "History" },
];

type MenuItem = {
  key: string;
  href: string;
  label: string;
  icon?: string | null;
};

export function ModeGrid({ user }: { user: CurrentUser }) {
  const [menu, setMenu] = useState<MenuItem[]>([]);

  useEffect(() => {
    apiFetch<{ menu: MenuItem[] }>("/api/app-config")
      .then((config) => setMenu(config.menu))
      .catch(() => setMenu([]));
  }, []);

  const modes = useMemo(() => {
    if (menu.length === 0) return fallbackModes;
    return menu.map((item) => {
      const fallback = fallbackModes.find((mode) => mode.key === item.key);
      return {
        key: item.key,
        href: item.href,
        label: item.label,
        detail: fallback?.detail ?? item.href,
        icon: item.icon ?? fallback?.icon ?? "PackageSearch",
      };
    });
  }, [menu]);

  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <p className="eyebrow">Scanner-Modus</p>
          <h1>Was möchtest du tun?</h1>
        </div>
        {hasPermission(user, "admin:access") ? (
          <Link href="/admin" className="secondary-action">
            <Settings size={18} aria-hidden />
            Admin
          </Link>
        ) : null}
      </div>

      <div className="mode-grid">
        {modes.map((mode) => {
          const Icon = iconByName[mode.icon as keyof typeof iconByName] ?? PackageSearch;
          return (
            <Link key={mode.key} href={mode.href} className="mode-card">
              <Icon size={28} aria-hidden />
              <span>{mode.label}</span>
              <small>{mode.detail}</small>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
