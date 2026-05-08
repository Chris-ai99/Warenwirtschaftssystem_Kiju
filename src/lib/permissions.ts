export const ADMIN_ROLE = "ADMIN";
export const EMPLOYEE_ROLE = "MITARBEITER";
export const WAREHOUSE_ROLE = "LAGERARBEITER";
export const READONLY_ROLE = "NUR_LESEN";
export const SCANNER_ROLE = "SCANNER_BENUTZER";

export const permissionCatalog = [
  { key: "admin:access", name: "Adminbereich öffnen", group: "Admin", sortOrder: 1 },
  { key: "article:read", name: "Artikel sehen", group: "Artikel", sortOrder: 10 },
  { key: "article:write", name: "Artikel verwalten", group: "Artikel", sortOrder: 11 },
  { key: "article:delete", name: "Artikel löschen/deaktivieren", group: "Artikel", sortOrder: 12 },
  { key: "price:read", name: "Preise sehen", group: "Preise", sortOrder: 20 },
  { key: "price:write", name: "Preise ändern", group: "Preise", sortOrder: 21 },
  { key: "warehouse:read", name: "Lager sehen", group: "Lager", sortOrder: 30 },
  { key: "warehouse:write", name: "Lager verwalten", group: "Lager", sortOrder: 31 },
  { key: "location:write", name: "Standorte verwalten", group: "Lager", sortOrder: 32 },
  { key: "category:write", name: "Kategorien verwalten", group: "Artikel", sortOrder: 40 },
  { key: "packaging:write", name: "Verpackungseinheiten verwalten", group: "Artikel", sortOrder: 41 },
  { key: "stock:read", name: "Bestand sehen", group: "Buchungen", sortOrder: 50 },
  { key: "stock:book", name: "Bestand buchen", group: "Buchungen", sortOrder: 51 },
  { key: "stock:transfer", name: "Umbuchen", group: "Buchungen", sortOrder: 52 },
  { key: "stock:empty", name: "Leergut buchen", group: "Buchungen", sortOrder: 53 },
  { key: "stock:correct", name: "Bestand korrigieren", group: "Buchungen", sortOrder: 54 },
  { key: "stock:negative", name: "Negative Bestände erlauben", group: "Buchungen", sortOrder: 55 },
  { key: "movement:read", name: "Buchungsverlauf sehen", group: "Historie", sortOrder: 60 },
  { key: "movement:void", name: "Buchungen stornieren", group: "Historie", sortOrder: 61 },
  { key: "booking-reason:write", name: "Buchungsgründe verwalten", group: "Buchungen", sortOrder: 62 },
  { key: "deposit:write", name: "Pfand/Leergut verwalten", group: "Pfand", sortOrder: 70 },
  { key: "user:write", name: "Benutzer verwalten", group: "Benutzer", sortOrder: 80 },
  { key: "role:write", name: "Rollen und Rechte verwalten", group: "Benutzer", sortOrder: 81 },
  { key: "settings:read", name: "Einstellungen sehen", group: "System", sortOrder: 90 },
  { key: "settings:write", name: "Einstellungen ändern", group: "System", sortOrder: 91 },
  { key: "scanner:write", name: "Scanner-Einstellungen ändern", group: "Scanner", sortOrder: 100 },
  { key: "ui:write", name: "Texte und Bezeichnungen ändern", group: "Oberfläche", sortOrder: 110 },
  { key: "menu:write", name: "Menüpunkte und Buttons ändern", group: "Oberfläche", sortOrder: 111 },
  { key: "import:write", name: "Importe durchführen", group: "Import/Export", sortOrder: 120 },
  { key: "export:read", name: "Exporte durchführen", group: "Import/Export", sortOrder: 121 },
  { key: "audit:read", name: "Protokolle sehen", group: "Historie", sortOrder: 130 },
  { key: "system:status", name: "Systemstatus sehen", group: "System", sortOrder: 140 },
] as const;

export type Permission = (typeof permissionCatalog)[number]["key"];

export type PermissionUser = {
  role: string;
  permissions?: string[];
};

const allPermissions = permissionCatalog.map((permission) => permission.key);

const defaultsByRole: Record<string, Permission[]> = {
  [ADMIN_ROLE]: allPermissions,
  [EMPLOYEE_ROLE]: [
    "article:read",
    "warehouse:read",
    "stock:read",
    "stock:book",
    "stock:transfer",
    "stock:empty",
    "movement:read",
  ],
  [WAREHOUSE_ROLE]: [
    "article:read",
    "warehouse:read",
    "stock:read",
    "stock:book",
    "stock:transfer",
    "stock:empty",
    "movement:read",
    "export:read",
  ],
  [READONLY_ROLE]: ["article:read", "warehouse:read", "stock:read", "movement:read", "export:read"],
  [SCANNER_ROLE]: ["article:read", "warehouse:read", "stock:book", "stock:transfer", "stock:empty"],
};

export function permissionsForRole(role: string, assigned?: string[] | null): Permission[] {
  if (assigned) {
    return assigned.filter((permission): permission is Permission =>
      allPermissions.includes(permission as Permission),
    );
  }
  return defaultsByRole[role] ?? [];
}

export function hasPermission(userOrRole: PermissionUser | string, permission: Permission) {
  if (typeof userOrRole === "string") {
    return permissionsForRole(userOrRole).includes(permission);
  }
  return permissionsForRole(userOrRole.role, userOrRole.permissions).includes(permission);
}

export function roleLabel(role: string) {
  const labels: Record<string, string> = {
    [ADMIN_ROLE]: "Admin",
    [EMPLOYEE_ROLE]: "Mitarbeiter",
    [WAREHOUSE_ROLE]: "Lagerarbeiter",
    [READONLY_ROLE]: "Nur Lesen",
    [SCANNER_ROLE]: "Scanner-Benutzer",
  };
  return labels[role] ?? role;
}
