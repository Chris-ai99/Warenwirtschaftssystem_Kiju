import { MovementType, Prisma, StockKind } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { hasPermission, type Permission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ok, route } from "@/lib/route";

function enumValue<T extends Record<string, string>>(values: T, value: string | null): T[keyof T] | undefined {
  return value && Object.values(values).includes(value) ? (value as T[keyof T]) : undefined;
}

export function GET(request: Request) {
  return route(async () => {
    const user = await requireUser();
    if (!hasPermission(user, "stock:book") && !hasPermission(user, "stock:empty") && !hasPermission(user, "movement:read")) {
      throw new AppError(403, "FORBIDDEN", "Dafür fehlen die Berechtigungen.");
    }

    const url = new URL(request.url);
    const movementType = enumValue(MovementType, url.searchParams.get("movementType"));
    const stockKind = enumValue(StockKind, url.searchParams.get("stockKind"));
    const where: Prisma.BookingReasonWhereInput = {
      active: true,
      movementType,
      OR: stockKind ? [{ stockKind }, { stockKind: null }] : undefined,
    };

    const bookingReasons = await prisma.bookingReason.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return ok({
      bookingReasons: bookingReasons.filter(
        (item) => !item.permissionKey || hasPermission(user, item.permissionKey as Permission),
      ),
    });
  });
}
