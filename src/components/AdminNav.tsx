import Link from "next/link";

const links = [
  ["/admin/artikel", "Artikel"],
  ["/admin/lager", "Lager"],
  ["/admin/kategorien", "Kategorien"],
  ["/admin/benutzer", "Benutzer"],
  ["/admin/einstellungen", "Einstellungen"],
  ["/admin/import-export", "Import/Export"],
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
