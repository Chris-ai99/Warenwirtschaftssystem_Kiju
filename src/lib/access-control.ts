import { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "./auth";
import { assertCondition } from "./errors";
import { hasPermission } from "./permissions";

type AccessClient = Prisma.TransactionClient;

function canUseAllWarehouses(user: CurrentUser) {
  return hasPermission(user, "admin:access") || hasPermission(user, "warehouse:write");
}

async function assignedWarehouseIds(db: AccessClient, userId: string) {
  const rows = await db.userWarehouseAccess.findMany({
    where: { userId },
    select: { warehouseId: true },
  });
  return rows.map((row) => row.warehouseId);
}

async function assignedLocationIds(db: AccessClient, userId: string) {
  const rows = await db.userLocationAccess.findMany({
    where: { userId },
    select: { locationId: true },
  });
  return rows.map((row) => row.locationId);
}

export async function warehouseAccessWhere(db: AccessClient, user: CurrentUser): Promise<Prisma.WarehouseWhereInput> {
  if (canUseAllWarehouses(user)) return {};

  const [warehouseIds, locationIds] = await Promise.all([
    assignedWarehouseIds(db, user.id),
    assignedLocationIds(db, user.id),
  ]);

  const filters: Prisma.WarehouseWhereInput[] = [{ active: true }, { visibleToEmployees: true }];

  if (warehouseIds.length) {
    filters.push({ id: { in: warehouseIds } });
  }

  if (locationIds.length) {
    filters.push({ locationId: { in: locationIds } });
  }

  return { AND: filters };
}

export async function assertWarehouseAccess(
  db: AccessClient,
  user: CurrentUser,
  warehouse: { id: string; visibleToEmployees: boolean; locationId: string | null },
) {
  if (canUseAllWarehouses(user)) return;

  assertCondition(
    warehouse.visibleToEmployees,
    403,
    "WAREHOUSE_NOT_VISIBLE",
    "Dieses Lager ist für deinen Benutzer nicht sichtbar.",
  );

  const [warehouseIds, locationIds] = await Promise.all([
    assignedWarehouseIds(db, user.id),
    assignedLocationIds(db, user.id),
  ]);

  if (warehouseIds.length) {
    assertCondition(
      warehouseIds.includes(warehouse.id),
      403,
      "WAREHOUSE_ACCESS_DENIED",
      "Für dieses Lager fehlt dir die Berechtigung.",
    );
  }

  if (locationIds.length) {
    assertCondition(
      warehouse.locationId ? locationIds.includes(warehouse.locationId) : false,
      403,
      "LOCATION_ACCESS_DENIED",
      "Für diesen Standort fehlt dir die Berechtigung.",
    );
  }
}
