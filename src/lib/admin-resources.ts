import { MovementType, Prisma, StockKind, WarehouseType } from "@/generated/prisma/client";
import { hashPassword, type CurrentUser } from "./auth";
import { AppError, assertCondition } from "./errors";
import { normalizeBarcode } from "./barcode";
import { prisma } from "./prisma";
import { writeAuditLog } from "./audit";
import { permissionCatalog, type Permission } from "./permissions";

type JsonMap = Record<string, unknown>;
type ResourceAction = "read" | "write" | "delete";

const policies: Record<string, { read: Permission; write?: Permission; delete?: Permission }> = {
  articles: { read: "article:read", write: "article:write", delete: "article:delete" },
  warehouses: { read: "warehouse:read", write: "warehouse:write", delete: "warehouse:write" },
  locations: { read: "warehouse:read", write: "location:write", delete: "location:write" },
  categories: { read: "article:read", write: "category:write", delete: "category:write" },
  "packaging-units": { read: "article:read", write: "packaging:write", delete: "packaging:write" },
  users: { read: "user:write", write: "user:write", delete: "user:write" },
  roles: { read: "role:write", write: "role:write", delete: "role:write" },
  permissions: { read: "role:write", write: "role:write", delete: "role:write" },
  "booking-reasons": { read: "movement:read", write: "booking-reason:write", delete: "booking-reason:write" },
  "ui-labels": { read: "settings:read", write: "ui:write", delete: "ui:write" },
  "menu-configs": { read: "settings:read", write: "menu:write", delete: "menu:write" },
  settings: { read: "settings:read", write: "settings:write", delete: "settings:write" },
  scanner: { read: "settings:read", write: "scanner:write", delete: "scanner:write" },
  deposit: { read: "settings:read", write: "deposit:write", delete: "deposit:write" },
  "audit-logs": { read: "audit:read" },
  "system-status": { read: "system:status" },
};

const aliases: Record<string, string> = {
  artikel: "articles",
  produkte: "articles",
  lager: "warehouses",
  standorte: "locations",
  kategorien: "categories",
  verpackungseinheiten: "packaging-units",
  benutzer: "users",
  rollen: "roles",
  rechte: "permissions",
  buchungsgruende: "booking-reasons",
  systemtexte: "ui-labels",
  menues: "menu-configs",
  einstellungen: "settings",
  protokolle: "audit-logs",
};

export function normalizeAdminResource(resource: string) {
  return aliases[resource] ?? resource;
}

export function permissionForAdminResource(resource: string, action: ResourceAction) {
  const normalized = normalizeAdminResource(resource);
  const policy = policies[normalized];
  if (!policy) {
    throw new AppError(404, "ADMIN_RESOURCE_NOT_FOUND", "Admin-Bereich wurde nicht gefunden.");
  }
  return policy[action] ?? policy.write ?? policy.read;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullableString(value: unknown) {
  const next = text(value);
  return next ? next : null;
}

function decimalString(value: unknown, fallback = "0") {
  const next = String(value ?? fallback).replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(next) ? next : fallback;
}

function barcodeValues(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(String).map(normalizeBarcode).filter(Boolean);
}

function codeFrom(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function take(url: URL) {
  return Math.min(250, Math.max(10, Number(url.searchParams.get("take") ?? 100)));
}

function search(url: URL) {
  return url.searchParams.get("search")?.trim();
}

async function setRolePermissions(tx: Prisma.TransactionClient, roleId: string, permissionKeys?: unknown) {
  if (!Array.isArray(permissionKeys)) return;
  const keys = permissionKeys.map(String);
  const permissions = await tx.permission.findMany({ where: { key: { in: keys } } });
  await tx.rolePermission.deleteMany({ where: { roleId } });
  for (const permission of permissions) {
    await tx.rolePermission.create({
      data: { roleId, permissionId: permission.id, enabled: true },
    });
  }
}

function settingKeyFor(resource: string) {
  if (resource === "scanner") return "scanner";
  if (resource === "deposit") return "deposit";
  return "system";
}

export async function listAdminResource(resourceName: string, requestUrl: string) {
  const resource = normalizeAdminResource(resourceName);
  const url = new URL(requestUrl);
  const term = search(url);

  if (resource === "system-status") {
    const [articles, warehouses, users, movements, auditLogs] = await Promise.all([
      prisma.article.count(),
      prisma.warehouse.count(),
      prisma.user.count(),
      prisma.stockMovement.count(),
      prisma.auditLog.count(),
    ]);
    return {
      status: {
        ok: true,
        appVersion: process.env.npm_package_version ?? "0.1.0",
        time: new Date().toISOString(),
        counts: { articles, warehouses, users, movements, auditLogs },
      },
    };
  }

  if (resource === "settings" || resource === "scanner" || resource === "deposit") {
    const settings = await prisma.settings.findMany({ orderBy: { key: "asc" } });
    const settingsMap = Object.fromEntries(settings.map((item) => [item.key, item.value]));
    return resource === "settings"
      ? { settings: settingsMap }
      : { setting: settingsMap[settingKeyFor(resource)] ?? {} };
  }

  if (resource === "audit-logs") {
    const logs = await prisma.auditLog.findMany({
      where: {
        area: url.searchParams.get("area") ?? undefined,
        action: url.searchParams.get("action") ?? undefined,
        userId: url.searchParams.get("userId") ?? undefined,
        articleId: url.searchParams.get("articleId") ?? undefined,
        warehouseId: url.searchParams.get("warehouseId") ?? undefined,
        locationId: url.searchParams.get("locationId") ?? undefined,
      },
      include: { user: true, warehouse: true, location: true },
      orderBy: { createdAt: "desc" },
      take: take(url),
    });
    return { logs };
  }

  if (resource === "articles") {
    const active = url.searchParams.get("active");
    const articles = await prisma.article.findMany({
      where: {
        active: active === null ? undefined : active === "true",
        categoryId: url.searchParams.get("categoryId") ?? undefined,
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: "insensitive" } },
                { articleNumber: { contains: term, mode: "insensitive" } },
                { barcodes: { some: { value: { contains: normalizeBarcode(term) } } } },
              ],
            }
          : {}),
      },
      include: {
        category: true,
        barcodes: { orderBy: [{ primary: "desc" }, { createdAt: "asc" }] },
        units: { orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }] },
        stocks: { include: { warehouse: true } },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      take: take(url),
    });
    return { articles };
  }

  if (resource === "warehouses") {
    const warehouses = await prisma.warehouse.findMany({
      where: term ? { name: { contains: term, mode: "insensitive" } } : undefined,
      include: { location: true, stocks: true },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      take: take(url),
    });
    return { warehouses };
  }

  if (resource === "locations") {
    const locations = await prisma.location.findMany({
      where: term ? { name: { contains: term, mode: "insensitive" } } : undefined,
      include: { warehouses: true },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      take: take(url),
    });
    return { locations };
  }

  if (resource === "categories") {
    const categories = await prisma.category.findMany({
      where: term ? { name: { contains: term, mode: "insensitive" } } : undefined,
      include: { parent: true, _count: { select: { articles: true } } },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      take: take(url),
    });
    return { categories };
  }

  if (resource === "packaging-units") {
    const packagingUnits = await prisma.packagingUnit.findMany({
      where: term ? { name: { contains: term, mode: "insensitive" } } : undefined,
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      take: take(url),
    });
    return { packagingUnits };
  }

  if (resource === "users") {
    const users = await prisma.user.findMany({
      where: term
        ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } }] }
        : undefined,
      include: { role: true, warehouseAccess: true, locationAccess: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      take: take(url),
    });
    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        role: user.role,
        active: user.active,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        warehouseAccess: user.warehouseAccess,
        locationAccess: user.locationAccess,
      })),
    };
  }

  if (resource === "roles") {
    const roles = await prisma.role.findMany({
      include: { rolePermissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    return { roles };
  }

  if (resource === "permissions") {
    const permissions = await prisma.permission.findMany({ orderBy: [{ group: "asc" }, { sortOrder: "asc" }] });
    return { permissions, catalog: permissionCatalog };
  }

  if (resource === "booking-reasons") {
    const bookingReasons = await prisma.bookingReason.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
    return { bookingReasons };
  }

  if (resource === "ui-labels") {
    const uiLabels = await prisma.uiLabel.findMany({
      where: term ? { label: { contains: term, mode: "insensitive" } } : undefined,
      orderBy: [{ area: "asc" }, { key: "asc" }],
      take: take(url),
    });
    return { uiLabels };
  }

  if (resource === "menu-configs") {
    const menuConfigs = await prisma.menuConfig.findMany({
      include: { role: true },
      orderBy: [{ roleId: "asc" }, { sortOrder: "asc" }],
      take: take(url),
    });
    return { menuConfigs };
  }

  throw new AppError(404, "ADMIN_RESOURCE_NOT_FOUND", "Admin-Bereich wurde nicht gefunden.");
}

export async function createAdminResource(resourceName: string, body: JsonMap, user: CurrentUser) {
  const resource = normalizeAdminResource(resourceName);
  return prisma.$transaction(async (tx) => {
    let result: unknown;

    if (resource === "articles") {
      const barcodes = barcodeValues(body.barcodes);
      const articleNumber = text(body.articleNumber) || barcodes[0];
      assertCondition(articleNumber, 400, "ARTICLE_NUMBER_REQUIRED", "Artikelnummer oder Barcode ist erforderlich.");
      assertCondition(text(body.name), 400, "ARTICLE_NAME_REQUIRED", "Artikelname ist erforderlich.");
      result = await tx.article.create({
        data: {
          articleNumber,
          name: text(body.name),
          categoryId: nullableString(body.categoryId),
          purchasePrice: decimalString(body.purchasePrice),
          salePrice: decimalString(body.salePrice),
          depositAmount: decimalString(body.depositAmount),
          unit: text(body.unit, "Stück"),
          description: nullableString(body.description),
          imageUrl: nullableString(body.imageUrl),
          active: bool(body.active, true),
          supportsEmpties: bool(body.supportsEmpties),
          lowStockThreshold: numberValue(body.lowStockThreshold),
          barcodes: barcodes.length
            ? { create: barcodes.map((value, index) => ({ value, primary: index === 0 })) }
            : undefined,
        },
        include: { category: true, barcodes: true, units: true, stocks: true },
      });
    }

    if (resource === "warehouses") {
      const name = text(body.name);
      assertCondition(name, 400, "WAREHOUSE_NAME_REQUIRED", "Lagername ist erforderlich.");
      result = await tx.warehouse.create({
        data: {
          name,
          code: text(body.code, codeFrom(name)),
          type: (text(body.type, "MAIN") as WarehouseType) || WarehouseType.MAIN,
          active: bool(body.active, true),
          locationId: nullableString(body.locationId),
          visibleToEmployees: bool(body.visibleToEmployees, true),
          isDefault: bool(body.isDefault),
          sortOrder: numberValue(body.sortOrder),
        },
        include: { location: true, stocks: true },
      });
    }

    if (resource === "locations") {
      const name = text(body.name);
      assertCondition(name, 400, "LOCATION_NAME_REQUIRED", "Standortname ist erforderlich.");
      result = await tx.location.create({
        data: {
          name,
          code: text(body.code, codeFrom(name)),
          active: bool(body.active, true),
          isDefault: bool(body.isDefault),
          sortOrder: numberValue(body.sortOrder),
        },
        include: { warehouses: true },
      });
    }

    if (resource === "categories") {
      const name = text(body.name);
      assertCondition(name, 400, "CATEGORY_NAME_REQUIRED", "Kategoriename ist erforderlich.");
      result = await tx.category.create({
        data: {
          name,
          slug: text(body.slug, slugify(name)),
          active: bool(body.active, true),
          parentId: nullableString(body.parentId),
          color: nullableString(body.color),
          icon: nullableString(body.icon),
          sortOrder: numberValue(body.sortOrder),
          isDefault: bool(body.isDefault),
          depositEnabled: bool(body.depositEnabled),
          emptiesEnabled: bool(body.emptiesEnabled),
          defaultUnit: nullableString(body.defaultUnit),
          defaultDepositAmount: body.defaultDepositAmount ? decimalString(body.defaultDepositAmount) : undefined,
        },
      });
    }

    if (resource === "packaging-units") {
      const name = text(body.name);
      assertCondition(name, 400, "PACKAGING_NAME_REQUIRED", "Einheitenname ist erforderlich.");
      result = await tx.packagingUnit.create({
        data: {
          code: text(body.code, codeFrom(name)),
          name,
          quantity: Math.max(1, numberValue(body.quantity, 1)),
          active: bool(body.active, true),
          sortOrder: numberValue(body.sortOrder),
          categoryName: nullableString(body.categoryName),
          depositAmount: body.depositAmount ? decimalString(body.depositAmount) : undefined,
        },
      });
    }

    if (resource === "users") {
      const role = await tx.role.findUniqueOrThrow({ where: { code: text(body.roleCode, "MITARBEITER") } });
      result = await tx.user.create({
        data: {
          email: text(body.email).toLowerCase(),
          name: text(body.name),
          passwordHash: await hashPassword(text(body.password, "Start123!")),
          active: bool(body.active, true),
          roleId: role.id,
        },
        include: { role: true },
      });
    }

    if (resource === "roles") {
      const name = text(body.name);
      assertCondition(name, 400, "ROLE_NAME_REQUIRED", "Rollenname ist erforderlich.");
      const role = await tx.role.create({
        data: {
          code: text(body.code, codeFrom(name)),
          name,
          description: nullableString(body.description),
          active: bool(body.active, true),
          system: false,
        },
        include: { rolePermissions: { include: { permission: true } } },
      });
      await setRolePermissions(tx, role.id, body.permissionKeys);
      result = role;
    }

    if (resource === "booking-reasons") {
      const name = text(body.name);
      result = await tx.bookingReason.create({
        data: {
          code: text(body.code, codeFrom(name)),
          name,
          movementType: (text(body.movementType, "STOCK_OUT") as MovementType) || MovementType.STOCK_OUT,
          stockKind: body.stockKind ? (text(body.stockKind) as StockKind) : null,
          active: bool(body.active, true),
          isDefault: bool(body.isDefault),
          noteRequired: bool(body.noteRequired),
          sortOrder: numberValue(body.sortOrder),
          permissionKey: nullableString(body.permissionKey),
        },
      });
    }

    if (resource === "ui-labels") {
      const key = text(body.key);
      result = await tx.uiLabel.create({
        data: {
          key,
          defaultLabel: text(body.defaultLabel, text(body.label)),
          label: text(body.label),
          description: nullableString(body.description),
          area: text(body.area, "system"),
          active: bool(body.active, true),
        },
      });
    }

    if (resource === "menu-configs") {
      result = await tx.menuConfig.create({
        data: {
          key: text(body.key),
          label: text(body.label),
          href: text(body.href),
          icon: nullableString(body.icon),
          visible: bool(body.visible, true),
          sortOrder: numberValue(body.sortOrder),
          roleId: nullableString(body.roleId),
          isStartPage: bool(body.isStartPage),
        },
        include: { role: true },
      });
    }

    if (resource === "settings" || resource === "scanner" || resource === "deposit") {
      const key = resource === "settings" ? text(body.key, "system") : settingKeyFor(resource);
      const value = resource === "settings" ? body.value ?? body : body;
      result = await tx.settings.upsert({
        where: { key },
        update: { value: value as Prisma.InputJsonValue, updatedById: user.id },
        create: { key, value: value as Prisma.InputJsonValue, updatedById: user.id },
      });
    }

    assertCondition(result, 400, "ADMIN_CREATE_UNSUPPORTED", "Dieser Admin-Bereich kann nicht angelegt werden.");
    await writeAuditLog(tx, {
      user,
      area: resource,
      action: "create",
      entityType: resource,
      entityId: typeof result === "object" && result && "id" in result ? String(result.id) : null,
      entityLabel: typeof result === "object" && result && "name" in result ? String(result.name) : undefined,
      metadata: { resource, body: { ...body, password: body.password ? "***" : undefined } },
    });
    return result;
  });
}

export async function updateAdminResource(resourceName: string, id: string, body: JsonMap, user: CurrentUser) {
  const resource = normalizeAdminResource(resourceName);
  return prisma.$transaction(async (tx) => {
    let result: unknown;

    if (resource === "articles") {
      const barcodes = barcodeValues(body.barcodes);
      const articleNumber =
        body.articleNumber === undefined ? undefined : text(body.articleNumber) || barcodes[0];
      if (body.articleNumber !== undefined) {
        assertCondition(articleNumber, 400, "ARTICLE_NUMBER_REQUIRED", "Artikelnummer oder Barcode ist erforderlich.");
      }
      result = await tx.article.update({
        where: { id },
        data: {
          articleNumber,
          name: body.name === undefined ? undefined : text(body.name),
          categoryId: body.categoryId === undefined ? undefined : nullableString(body.categoryId),
          purchasePrice: body.purchasePrice === undefined ? undefined : decimalString(body.purchasePrice),
          salePrice: body.salePrice === undefined ? undefined : decimalString(body.salePrice),
          depositAmount: body.depositAmount === undefined ? undefined : decimalString(body.depositAmount),
          unit: body.unit === undefined ? undefined : text(body.unit, "Stück"),
          description: body.description === undefined ? undefined : nullableString(body.description),
          imageUrl: body.imageUrl === undefined ? undefined : nullableString(body.imageUrl),
          active: body.active === undefined ? undefined : bool(body.active),
          supportsEmpties: body.supportsEmpties === undefined ? undefined : bool(body.supportsEmpties),
          lowStockThreshold: body.lowStockThreshold === undefined ? undefined : numberValue(body.lowStockThreshold),
        },
        include: { category: true, barcodes: true, units: true, stocks: true },
      });
      if (Array.isArray(body.barcodes)) {
        await tx.barcode.deleteMany({ where: { articleId: id } });
        for (const [index, value] of barcodes.entries()) {
          await tx.barcode.create({ data: { articleId: id, value, primary: index === 0 } });
        }
      }
    }

    if (resource === "warehouses") {
      result = await tx.warehouse.update({
        where: { id },
        data: {
          name: body.name === undefined ? undefined : text(body.name),
          code: body.code === undefined ? undefined : text(body.code).toUpperCase(),
          type: body.type === undefined ? undefined : (text(body.type) as WarehouseType),
          active: body.active === undefined ? undefined : bool(body.active),
          locationId: body.locationId === undefined ? undefined : nullableString(body.locationId),
          visibleToEmployees: body.visibleToEmployees === undefined ? undefined : bool(body.visibleToEmployees),
          isDefault: body.isDefault === undefined ? undefined : bool(body.isDefault),
          sortOrder: body.sortOrder === undefined ? undefined : numberValue(body.sortOrder),
        },
        include: { location: true, stocks: true },
      });
    }

    if (resource === "locations") {
      result = await tx.location.update({
        where: { id },
        data: {
          name: body.name === undefined ? undefined : text(body.name),
          code: body.code === undefined ? undefined : text(body.code).toUpperCase(),
          active: body.active === undefined ? undefined : bool(body.active),
          isDefault: body.isDefault === undefined ? undefined : bool(body.isDefault),
          sortOrder: body.sortOrder === undefined ? undefined : numberValue(body.sortOrder),
        },
        include: { warehouses: true },
      });
    }

    if (resource === "categories") {
      result = await tx.category.update({
        where: { id },
        data: {
          name: body.name === undefined ? undefined : text(body.name),
          slug: body.slug === undefined ? undefined : text(body.slug),
          active: body.active === undefined ? undefined : bool(body.active),
          parentId: body.parentId === undefined ? undefined : nullableString(body.parentId),
          color: body.color === undefined ? undefined : nullableString(body.color),
          icon: body.icon === undefined ? undefined : nullableString(body.icon),
          sortOrder: body.sortOrder === undefined ? undefined : numberValue(body.sortOrder),
          isDefault: body.isDefault === undefined ? undefined : bool(body.isDefault),
          depositEnabled: body.depositEnabled === undefined ? undefined : bool(body.depositEnabled),
          emptiesEnabled: body.emptiesEnabled === undefined ? undefined : bool(body.emptiesEnabled),
          defaultUnit: body.defaultUnit === undefined ? undefined : nullableString(body.defaultUnit),
          defaultDepositAmount:
            body.defaultDepositAmount === undefined ? undefined : decimalString(body.defaultDepositAmount),
        },
      });
    }

    if (resource === "packaging-units") {
      result = await tx.packagingUnit.update({
        where: { id },
        data: {
          code: body.code === undefined ? undefined : text(body.code).toUpperCase(),
          name: body.name === undefined ? undefined : text(body.name),
          quantity: body.quantity === undefined ? undefined : Math.max(1, numberValue(body.quantity, 1)),
          active: body.active === undefined ? undefined : bool(body.active),
          sortOrder: body.sortOrder === undefined ? undefined : numberValue(body.sortOrder),
          categoryName: body.categoryName === undefined ? undefined : nullableString(body.categoryName),
          depositAmount: body.depositAmount === undefined ? undefined : decimalString(body.depositAmount),
        },
      });
    }

    if (resource === "users") {
      const role = body.roleCode ? await tx.role.findUniqueOrThrow({ where: { code: text(body.roleCode) } }) : null;
      result = await tx.user.update({
        where: { id },
        data: {
          email: body.email === undefined ? undefined : text(body.email).toLowerCase(),
          name: body.name === undefined ? undefined : text(body.name),
          active: body.active === undefined ? undefined : bool(body.active),
          roleId: role?.id,
          passwordHash: body.password ? await hashPassword(text(body.password)) : undefined,
        },
        include: { role: true },
      });
    }

    if (resource === "roles") {
      result = await tx.role.update({
        where: { id },
        data: {
          code: body.code === undefined ? undefined : text(body.code).toUpperCase(),
          name: body.name === undefined ? undefined : text(body.name),
          description: body.description === undefined ? undefined : nullableString(body.description),
          active: body.active === undefined ? undefined : bool(body.active),
        },
        include: { rolePermissions: { include: { permission: true } } },
      });
      await setRolePermissions(tx, id, body.permissionKeys);
    }

    if (resource === "permissions") {
      result = await tx.permission.update({
        where: { id },
        data: {
          name: body.name === undefined ? undefined : text(body.name),
          description: body.description === undefined ? undefined : nullableString(body.description),
          group: body.group === undefined ? undefined : text(body.group),
          sortOrder: body.sortOrder === undefined ? undefined : numberValue(body.sortOrder),
        },
      });
    }

    if (resource === "booking-reasons") {
      result = await tx.bookingReason.update({
        where: { id },
        data: {
          code: body.code === undefined ? undefined : text(body.code).toUpperCase(),
          name: body.name === undefined ? undefined : text(body.name),
          movementType: body.movementType === undefined ? undefined : (text(body.movementType) as MovementType),
          stockKind: body.stockKind === undefined ? undefined : (body.stockKind ? (text(body.stockKind) as StockKind) : null),
          active: body.active === undefined ? undefined : bool(body.active),
          isDefault: body.isDefault === undefined ? undefined : bool(body.isDefault),
          noteRequired: body.noteRequired === undefined ? undefined : bool(body.noteRequired),
          sortOrder: body.sortOrder === undefined ? undefined : numberValue(body.sortOrder),
          permissionKey: body.permissionKey === undefined ? undefined : nullableString(body.permissionKey),
        },
      });
    }

    if (resource === "ui-labels") {
      result = await tx.uiLabel.update({
        where: { id },
        data: {
          key: body.key === undefined ? undefined : text(body.key),
          defaultLabel: body.defaultLabel === undefined ? undefined : text(body.defaultLabel),
          label: body.label === undefined ? undefined : text(body.label),
          description: body.description === undefined ? undefined : nullableString(body.description),
          area: body.area === undefined ? undefined : text(body.area),
          active: body.active === undefined ? undefined : bool(body.active),
        },
      });
    }

    if (resource === "menu-configs") {
      result = await tx.menuConfig.update({
        where: { id },
        data: {
          key: body.key === undefined ? undefined : text(body.key),
          label: body.label === undefined ? undefined : text(body.label),
          href: body.href === undefined ? undefined : text(body.href),
          icon: body.icon === undefined ? undefined : nullableString(body.icon),
          visible: body.visible === undefined ? undefined : bool(body.visible),
          sortOrder: body.sortOrder === undefined ? undefined : numberValue(body.sortOrder),
          roleId: body.roleId === undefined ? undefined : nullableString(body.roleId),
          isStartPage: body.isStartPage === undefined ? undefined : bool(body.isStartPage),
        },
        include: { role: true },
      });
    }

    if (resource === "settings" || resource === "scanner" || resource === "deposit") {
      const key = resource === "settings" ? id : settingKeyFor(resource);
      result = await tx.settings.upsert({
        where: { key },
        update: { value: body as Prisma.InputJsonValue, updatedById: user.id },
        create: { key, value: body as Prisma.InputJsonValue, updatedById: user.id },
      });
    }

    assertCondition(result, 400, "ADMIN_UPDATE_UNSUPPORTED", "Dieser Admin-Bereich kann nicht geändert werden.");
    await writeAuditLog(tx, {
      user,
      area: resource,
      action: "update",
      entityType: resource,
      entityId: id,
      metadata: { resource, body: { ...body, password: body.password ? "***" : undefined } },
    });
    return result;
  });
}

export async function deleteAdminResource(resourceName: string, id: string, user: CurrentUser) {
  const resource = normalizeAdminResource(resourceName);
  return prisma.$transaction(async (tx) => {
    let result: unknown;
    let action = "delete";

    if (resource === "articles") {
      const [movements, stocks, auditLogs] = await Promise.all([
        tx.stockMovement.count({ where: { articleId: id } }),
        tx.stock.count({
          where: { articleId: id, OR: [{ fullQuantity: { not: 0 } }, { emptyQuantity: { not: 0 } }, { reservedQuantity: { not: 0 } }] },
        }),
        tx.auditLog.count({ where: { articleId: id } }),
      ]);
      if (movements || stocks || auditLogs) {
        action = "deactivate";
        result = await tx.article.update({ where: { id }, data: { active: false } });
      } else {
        await tx.stock.deleteMany({ where: { articleId: id } });
        result = await tx.article.delete({ where: { id } });
      }
    }

    if (resource === "warehouses") {
      const [stocks, movements, batches, auditLogs] = await Promise.all([
        tx.stock.count({
          where: { warehouseId: id, OR: [{ fullQuantity: { not: 0 } }, { emptyQuantity: { not: 0 } }, { reservedQuantity: { not: 0 } }] },
        }),
        tx.stockMovement.count({ where: { OR: [{ fromWarehouseId: id }, { toWarehouseId: id }] } }),
        tx.stockMovementBatch.count({ where: { warehouseId: id } }),
        tx.auditLog.count({ where: { warehouseId: id } }),
      ]);
      if (stocks || movements || batches || auditLogs) {
        action = "deactivate";
        result = await tx.warehouse.update({ where: { id }, data: { active: false } });
      } else {
        await tx.stock.deleteMany({ where: { warehouseId: id } });
        result = await tx.warehouse.delete({ where: { id } });
      }
    }

    if (resource === "locations") {
      const [warehouses, auditLogs] = await Promise.all([
        tx.warehouse.count({ where: { locationId: id } }),
        tx.auditLog.count({ where: { locationId: id } }),
      ]);
      if (warehouses || auditLogs) {
        action = "deactivate";
        result = await tx.location.update({ where: { id }, data: { active: false } });
      } else {
        result = await tx.location.delete({ where: { id } });
      }
    }

    if (resource === "categories") {
      const [articles, packagingUnits] = await Promise.all([
        tx.article.count({ where: { categoryId: id } }),
        tx.packagingUnit.count({ where: { categoryId: id } }),
      ]);
      if (articles || packagingUnits) {
        action = "deactivate";
        result = await tx.category.update({ where: { id }, data: { active: false } });
      } else {
        result = await tx.category.delete({ where: { id } });
      }
    }

    if (resource === "packaging-units") {
      const used = await tx.productPackagingUnit.count({ where: { packagingUnitId: id } });
      if (used) {
        action = "deactivate";
        result = await tx.packagingUnit.update({ where: { id }, data: { active: false } });
      } else {
        result = await tx.packagingUnit.delete({ where: { id } });
      }
    }

    if (resource === "users") {
      assertCondition(id !== user.id, 409, "SELF_DELETE_BLOCKED", "Der eigene Benutzer kann nicht gelöscht werden.");
      const [movements, batches, settings, auditLogs] = await Promise.all([
        tx.stockMovement.count({ where: { userId: id } }),
        tx.stockMovementBatch.count({ where: { userId: id } }),
        tx.settings.count({ where: { updatedById: id } }),
        tx.auditLog.count({ where: { userId: id } }),
      ]);
      const used = movements || batches || settings || auditLogs;
      if (used) {
        action = "deactivate";
        result = await tx.user.update({ where: { id }, data: { active: false } });
      } else {
        await tx.session.deleteMany({ where: { userId: id } });
        result = await tx.user.delete({ where: { id } });
      }
    }

    if (resource === "roles") {
      assertCondition(id !== user.roleId, 409, "SELF_ROLE_DELETE_BLOCKED", "Die eigene Rolle kann nicht gelöscht werden.");
      const [role, used, menus] = await Promise.all([
        tx.role.findUnique({ where: { id } }),
        tx.user.count({ where: { roleId: id } }),
        tx.menuConfig.count({ where: { roleId: id } }),
      ]);
      if (role?.system || used || menus) {
        action = "deactivate";
        result = await tx.role.update({ where: { id }, data: { active: false } });
      } else {
        result = await tx.role.delete({ where: { id } });
      }
    }

    if (resource === "booking-reasons") {
      const used = await tx.stockMovement.count({ where: { bookingReasonId: id } });
      if (used) {
        action = "deactivate";
        result = await tx.bookingReason.update({ where: { id }, data: { active: false } });
      } else {
        result = await tx.bookingReason.delete({ where: { id } });
      }
    }

    if (resource === "ui-labels") {
      result = await tx.uiLabel.update({ where: { id }, data: { active: false } });
      action = "deactivate";
    }

    if (resource === "menu-configs") {
      result = await tx.menuConfig.update({ where: { id }, data: { visible: false } });
      action = "hide";
    }

    assertCondition(result, 400, "ADMIN_DELETE_UNSUPPORTED", "Dieser Admin-Bereich kann nicht gelöscht werden.");
    await writeAuditLog(tx, { user, area: resource, action, entityType: resource, entityId: id });
    return result;
  });
}
