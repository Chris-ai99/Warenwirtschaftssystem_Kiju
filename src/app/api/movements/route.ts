import { requirePermission, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, route } from "@/lib/route";

export function GET(request: Request) {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "movement:read");
    const url = new URL(request.url);
    const articleId = url.searchParams.get("articleId") ?? undefined;
    const warehouseId = url.searchParams.get("warehouseId") ?? undefined;
    const type = url.searchParams.get("type") ?? undefined;
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const take = Math.min(100, Math.max(10, Number(url.searchParams.get("take") ?? 50)));

    const movements = await prisma.stockMovement.findMany({
      where: {
        articleId,
        type: type ? { equals: type as never } : undefined,
        ...(warehouseId
          ? { OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }] }
          : {}),
      },
      include: {
        article: { include: { barcodes: true } },
        user: true,
        fromWarehouse: true,
        toWarehouse: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    });

    return ok({ movements, page, take });
  });
}
