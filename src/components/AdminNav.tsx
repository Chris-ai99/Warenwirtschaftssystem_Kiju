import Link from "next/link";

const links = [
  ["/admin", "Dashboard"],
  ["/admin/artikel", "Artikel"],
  ["/admin/lager", "Lager"],
  ["/admin/standorte", "Standorte"],
  ["/admin/kategorien", "Kategorien"],
  ["/admin/verpackungseinheiten", "Einheiten"],
  ["/admin/benutzer", "Benutzer"],
  ["/admin/rollen-rechte", "Rollen & Rechte"],
  ["/admin/buchungsgruende", "Buchungsgründe"],
  ["/admin/scanner", "Scanner"],
  ["/admin/pfand-leergut", "Pfand"],
  ["/admin/systemtexte", "Texte"],
  ["/admin/menues", "Menüs"],
  ["/admin/import-export", "Import/Export"],
  ["/admin/protokolle", "Protokolle"],
  ["/admin/einstellungen", "Einstellungen"],
];

export function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="Adminbereich">
      {links.map(([href, label]) => (
        <Link key={href} href={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
