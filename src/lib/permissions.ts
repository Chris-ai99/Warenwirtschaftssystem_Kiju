import { RoleCode } from "@/generated/prisma/client";

export type Permission =
  | "article:read"
  | "article:write"
  | "price:write"
  | "warehouse:write"
  | "stock:book"
  | "movement:read"
  | "user:write"
  | "settings:write"
  | "import:write"
  | "export:read";

const adminPermissions: Permission[] = [
  "article:read",
  "article:write",
  "price:write",
  "warehouse:write",
  "stock:book",
  "movement:read",
  "user:write",
  "settings:write",
  "import:write",
  "export:read",
];

const employeePermissions: Permission[] = [
  "article:read",
  "stock:book",
  "movement:read",
  "export:read",
];

export function permissionsForRole(role: RoleCode): Permission[] {
  return role === RoleCode.ADMIN ? adminPermissions : employeePermissions;
}

export function hasPermission(role: RoleCode, permission: Permission) {
  return permissionsForRole(role).includes(permission);
}

export function roleLabel(role: RoleCode) {
  return role === RoleCode.ADMIN ? "Admin" : "Mitarbeiter";
}
