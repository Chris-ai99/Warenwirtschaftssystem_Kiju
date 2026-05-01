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
import { RoleCode } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/auth";

const modes = [
  { href: "/scan/suchen", label: "Artikel suchen", detail: "Barcode scannen oder manuell suchen", icon: PackageSearch },
  { href: "/artikel/neu", label: "Artikel anlegen", detail: "Neuen Artikel mit Barcode erfassen", icon: PackagePlus },
  { href: "/scan/einbuchen", label: "Einbuchen", detail: "Vollgut in ein Lager buchen", icon: ArrowDownToLine },
  { href: "/scan/ausbuchen", label: "Ausbuchen", detail: "Verkauf, Bruch oder Korrektur", icon: ArrowUpFromLine },
  { href: "/scan/umbuchen", label: "Umbuchen", detail: "Bestand zwischen Lagern bewegen", icon: ArrowLeftRight },
  { href: "/scan/leergut", label: "Leergut", detail: "Pfandbestand separat erfassen", icon: Recycle },
  { href: "/bestand", label: "Bestand", detail: "Vollgut, Leergut und Lager anzeigen", icon: ClipboardList },
  { href: "/buchungen", label: "Verlauf", detail: "Alle Buchungen nachvollziehen", icon: History },
];

export function ModeGrid({ user }: { user: CurrentUser }) {
  return (
    <section className="screen">
      <div className="screen-header">
        <div>
          <p className="eyebrow">Scanner-Modus</p>
          <h1>Was möchtest du tun?</h1>
        </div>
        {user.role === RoleCode.ADMIN ? (
          <Link href="/admin/artikel" className="secondary-action">
            <Settings size={18} aria-hidden />
            Admin
          </Link>
        ) : null}
      </div>

      <div className="mode-grid">
        {modes.map((mode) => {
          const Icon = mode.icon;
          return (
            <Link key={mode.href} href={mode.href} className="mode-card">
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
