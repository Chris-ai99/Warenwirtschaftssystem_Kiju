import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { MovementType, Prisma, PrismaClient, StockKind, WarehouseType } from "../src/generated/prisma/client";
import {
  ADMIN_ROLE,
  EMPLOYEE_ROLE,
  READONLY_ROLE,
  SCANNER_ROLE,
  WAREHOUSE_ROLE,
  permissionCatalog,
  permissionsForRole,
} from "../src/lib/permissions";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const adminEmail = process.env.ADMIN_EMAIL ?? "admin@kiju.local";
const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123!";
const adminName = process.env.ADMIN_NAME ?? "KiJu Admin";

const roles = [
  { code: ADMIN_ROLE, name: "Admin", description: "Voller Zugriff auf alle Bereiche." },
  { code: EMPLOYEE_ROLE, name: "Mitarbeiter", description: "Scanner- und Buchungsfunktionen." },
  { code: WAREHOUSE_ROLE, name: "Lagerarbeiter", description: "Erweiterte Lager- und Scannerfunktionen." },
  { code: READONLY_ROLE, name: "Nur Lesen", description: "Nur Anzeige und Exporte." },
  { code: SCANNER_ROLE, name: "Scanner-Benutzer", description: "Reduzierter Scanner-Zugriff." },
];

const uiLabels = [
  ["action.stockIn", "Einbuchen", "Einbuchen", "scanner"],
  ["action.stockOut", "Ausbuchen", "Ausbuchen", "scanner"],
  ["action.transfer", "Umbuchen", "Umbuchen", "scanner"],
  ["action.empties", "Leergut", "Leergut", "scanner"],
  ["entity.article", "Artikel", "Artikel", "system"],
  ["entity.product", "Produkt", "Produkt", "system"],
  ["entity.warehouse", "Lager", "Lager", "system"],
  ["entity.location", "Standort", "Standort", "system"],
  ["admin.dashboard", "Admin-Dashboard", "Admin-Dashboard", "admin"],
] as const;

const menuItems = [
  ["suchen", "Artikel suchen", "/scan/suchen", "PackageSearch", 10],
  ["artikel-neu", "Artikel anlegen", "/artikel/neu", "PackagePlus", 20],
  ["einbuchen", "Einbuchen", "/scan/einbuchen", "ArrowDownToLine", 30],
  ["ausbuchen", "Ausbuchen", "/scan/ausbuchen", "ArrowUpFromLine", 40],
  ["umbuchen", "Umbuchen", "/scan/umbuchen", "ArrowLeftRight", 50],
  ["leergut", "Leergut", "/scan/leergut", "Recycle", 60],
  ["bestand", "Bestand", "/bestand", "ClipboardList", 70],
  ["buchungen", "Verlauf", "/buchungen", "History", 80],
] as const;

const bookingReasons = [
  ["STOCK_IN_DEFAULT", "Einbuchung", MovementType.STOCK_IN, StockKind.FULL, true, false, 10],
  ["VERKAUF", "Verkauf", MovementType.STOCK_OUT, StockKind.FULL, true, false, 20],
  ["BRUCH", "Bruch", MovementType.STOCK_OUT, StockKind.FULL, false, true, 30],
  ["VERLUST", "Verlust", MovementType.STOCK_OUT, StockKind.FULL, false, true, 40],
  ["KORREKTUR", "Korrektur", MovementType.CORRECTION, null, true, true, 50],
  ["EIGENVERBRAUCH", "Eigenverbrauch", MovementType.STOCK_OUT, StockKind.FULL, false, false, 60],
  ["TRANSFER_DEFAULT", "Umbuchung", MovementType.TRANSFER, StockKind.FULL, true, false, 70],
  ["EMPTY_IN", "Leergut zurück", MovementType.EMPTY_IN, StockKind.EMPTY, true, false, 80],
  ["EMPTY_OUT", "Leergut raus", MovementType.EMPTY_OUT, StockKind.EMPTY, true, false, 90],
] as const;

const packagingUnits = [
  ["STUECK", "Stück", 1, 10],
  ["FLASCHE", "Flasche", 1, 20],
  ["3ER", "3er Pack", 3, 30],
  ["6ER", "6er Pack", 6, 40],
  ["12ER", "12er Pack", 12, 50],
  ["KISTE", "Kiste", 24, 60],
  ["PALETTE", "Palette", 1, 70],
] as const;

async function upsertSetting(key: string, value: Prisma.InputJsonValue, updatedById?: string) {
  await prisma.settings.upsert({
    where: { key },
    update: { value, updatedById },
    create: { key, value, updatedById },
  });
}

async function main() {
  for (const permission of permissionCatalog) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        name: permission.name,
        group: permission.group,
        sortOrder: permission.sortOrder,
      },
      create: {
        key: permission.key,
        name: permission.name,
        group: permission.group,
        sortOrder: permission.sortOrder,
      },
    });
  }

  const roleByCode = new Map<string, { id: string; code: string }>();
  for (const role of roles) {
    const saved = await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description, active: true, system: true },
      create: { code: role.code, name: role.name, description: role.description, active: true, system: true },
    });
    roleByCode.set(role.code, saved);

    for (const permissionKey of permissionsForRole(role.code)) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permissionKey } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: saved.id, permissionId: permission.id } },
        update: { enabled: true },
        create: { roleId: saved.id, permissionId: permission.id, enabled: true },
      });
    }
  }

  const adminRole = roleByCode.get(ADMIN_ROLE);
  if (!adminRole) throw new Error("Admin role missing");

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: { name: adminName, roleId: adminRole.id, active: true },
    create: {
      email: adminEmail.toLowerCase(),
      name: adminName,
      passwordHash,
      roleId: adminRole.id,
    },
  });

  const companyLocation = await prisma.location.upsert({
    where: { code: "FIRMA" },
    update: { name: "Firma", active: true, isDefault: true, sortOrder: 10 },
    create: { code: "FIRMA", name: "Firma", active: true, isDefault: true, sortOrder: 10 },
  });

  const vehicleLocation = await prisma.location.upsert({
    where: { code: "FAHRZEUG" },
    update: { name: "Fahrzeug", active: true, sortOrder: 20 },
    create: { code: "FAHRZEUG", name: "Fahrzeug", active: true, sortOrder: 20 },
  });

  const warehouses = [
    { code: "HAUPT", name: "Hauptlager", type: WarehouseType.MAIN, locationId: companyLocation.id, isDefault: true, sortOrder: 10 },
    { code: "VERKAUF", name: "Verkaufsfläche", type: WarehouseType.SALES, locationId: companyLocation.id, sortOrder: 20 },
    { code: "FAHRZEUG", name: "Fahrzeug", type: WarehouseType.VEHICLE, locationId: vehicleLocation.id, sortOrder: 30 },
    { code: "AUSSEN", name: "Außenlager", type: WarehouseType.EXTERNAL, locationId: companyLocation.id, sortOrder: 40 },
    { code: "LEERGUT", name: "Leergutlager", type: WarehouseType.EMPTIES, locationId: companyLocation.id, sortOrder: 50 },
  ];

  for (const warehouse of warehouses) {
    await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      update: { ...warehouse, active: true, visibleToEmployees: true },
      create: { ...warehouse, active: true, visibleToEmployees: true },
    });
  }

  const category = await prisma.category.upsert({
    where: { slug: "getraenke" },
    update: {
      name: "Getränke",
      active: true,
      color: "#0f766e",
      icon: "GlassWater",
      depositEnabled: true,
      emptiesEnabled: true,
      defaultUnit: "Flasche",
      defaultDepositAmount: "0.25",
      sortOrder: 10,
    },
    create: {
      slug: "getraenke",
      name: "Getränke",
      color: "#0f766e",
      icon: "GlassWater",
      depositEnabled: true,
      emptiesEnabled: true,
      defaultUnit: "Flasche",
      defaultDepositAmount: "0.25",
      sortOrder: 10,
    },
  });

  for (const [code, name, quantity, sortOrder] of packagingUnits) {
    await prisma.packagingUnit.upsert({
      where: { code },
      update: { name, quantity, sortOrder, active: true },
      create: { code, name, quantity, sortOrder, active: true },
    });
  }

  for (const [code, name, movementType, stockKind, isDefault, noteRequired, sortOrder] of bookingReasons) {
    await prisma.bookingReason.upsert({
      where: { code },
      update: { name, movementType, stockKind, isDefault, noteRequired, sortOrder, active: true },
      create: { code, name, movementType, stockKind, isDefault, noteRequired, sortOrder, active: true },
    });
  }

  for (const [key, defaultLabel, label, area] of uiLabels) {
    await prisma.uiLabel.upsert({
      where: { key },
      update: { defaultLabel, label, area, active: true },
      create: { key, defaultLabel, label, area, active: true },
    });
  }

  for (const [key, label, href, icon, sortOrder] of menuItems) {
    const existing = await prisma.menuConfig.findFirst({ where: { key, roleId: null } });
    if (existing) {
      await prisma.menuConfig.update({
        where: { id: existing.id },
        data: { label, href, icon, sortOrder, visible: true, isStartPage: key === "suchen" },
      });
    } else {
      await prisma.menuConfig.create({
        data: { key, label, href, icon, sortOrder, visible: true, isStartPage: key === "suchen" },
      });
    }
  }

  await upsertSetting("allowNegativeStock", process.env.ALLOW_NEGATIVE_STOCK === "true", admin.id);
  await upsertSetting("lowStockThresholdDefault", Number(process.env.LOW_STOCK_THRESHOLD_DEFAULT ?? 5), admin.id);
  await upsertSetting(
    "scanner",
    {
      mode: "HID",
      hidKeyboardInput: true,
      enterSuffix: true,
      minBarcodeLength: 3,
      scanTimeoutMs: 90,
      duplicateWindowMs: 600,
      numpadQuantity: true,
      defaultQuantity: 1,
      sound: true,
      vibration: true,
      unknownBarcodeAction: "create",
      knownBarcodeAction: "actionMenu",
    },
    admin.id,
  );
  await upsertSetting(
    "system",
    {
      companyName: "KiJu Lager",
      language: "de",
      currency: "EUR",
      dateFormat: "dd.MM.yyyy",
      numberFormat: "de-DE",
      theme: "system",
      sessionDays: 14,
      maintenanceMode: false,
    },
    admin.id,
  );
  await upsertSetting(
    "deposit",
    {
      enabled: true,
      emptiesEnabled: true,
      defaultEmptiesWarehouseCode: "LEERGUT",
      separateFullAndEmpty: true,
      autoCalculateDeposit: true,
    },
    admin.id,
  );

  if (process.env.SEED_DEMO_DATA === "true") {
    await prisma.article.upsert({
      where: { articleNumber: "DEMO-COCA-1L" },
      update: {},
      create: {
        articleNumber: "DEMO-COCA-1L",
        name: "Coca-Cola 1L",
        categoryId: category.id,
        purchasePrice: "0.90",
        salePrice: "1.79",
        depositAmount: "0.25",
        unit: "Flasche",
        supportsEmpties: true,
        barcodes: { create: { value: "4000000000017", primary: true } },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
