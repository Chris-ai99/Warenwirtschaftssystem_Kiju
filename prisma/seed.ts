import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleCode, WarehouseType } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const adminEmail = process.env.ADMIN_EMAIL ?? "admin@kiju.local";
const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123!";
const adminName = process.env.ADMIN_NAME ?? "KiJu Admin";

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { code: RoleCode.ADMIN },
    update: { name: "Admin" },
    create: { code: RoleCode.ADMIN, name: "Admin" },
  });

  await prisma.role.upsert({
    where: { code: RoleCode.MITARBEITER },
    update: { name: "Mitarbeiter" },
    create: { code: RoleCode.MITARBEITER, name: "Mitarbeiter" },
  });

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

  const warehouses = [
    { code: "HAUPT", name: "Hauptlager", type: WarehouseType.MAIN },
    { code: "VERKAUF", name: "Verkaufsfläche", type: WarehouseType.SALES },
    { code: "FAHRZEUG", name: "Fahrzeug", type: WarehouseType.VEHICLE },
    { code: "AUSSEN", name: "Außenlager", type: WarehouseType.EXTERNAL },
    { code: "LEERGUT", name: "Leergutlager", type: WarehouseType.EMPTIES },
  ];

  for (const warehouse of warehouses) {
    await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      update: { name: warehouse.name, type: warehouse.type, active: true },
      create: warehouse,
    });
  }

  await prisma.category.upsert({
    where: { slug: "getraenke" },
    update: { name: "Getränke", active: true },
    create: { slug: "getraenke", name: "Getränke" },
  });

  await prisma.settings.upsert({
    where: { key: "allowNegativeStock" },
    update: { value: process.env.ALLOW_NEGATIVE_STOCK === "true", updatedById: admin.id },
    create: {
      key: "allowNegativeStock",
      value: process.env.ALLOW_NEGATIVE_STOCK === "true",
      updatedById: admin.id,
    },
  });

  await prisma.settings.upsert({
    where: { key: "lowStockThresholdDefault" },
    update: { value: Number(process.env.LOW_STOCK_THRESHOLD_DEFAULT ?? 5), updatedById: admin.id },
    create: {
      key: "lowStockThresholdDefault",
      value: Number(process.env.LOW_STOCK_THRESHOLD_DEFAULT ?? 5),
      updatedById: admin.id,
    },
  });

  if (process.env.SEED_DEMO_DATA === "true") {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: "getraenke" } });
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
