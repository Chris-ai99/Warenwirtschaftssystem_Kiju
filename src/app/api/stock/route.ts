import { requirePermission, requireUser } from "@/lib/auth";
import { warehouseAccessWhere } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ok, route } from "@/lib/route";

export function GET(request: Request) {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "stock:read");
    const url = new URL(request.url);
    const articleId = url.searchParams.get("articleId") ?? undefined;
    const warehouseId = url.searchParams.get("warehouseId") ?? undefined;
    const warehouseScope = await warehouseAccessWhere(prisma, user);

    const stocks = await prisma.stock.findMany({
      where: { articleId, warehouseId, warehouse: warehouseScope },
      include: {
        article: { include: { barcodes: true, category: true } },
        warehouse: true,
      },
      orderBy: [{ article: { name: "asc" } }, { warehouse: { name: "asc" } }],
      take: 250,
    });

    return ok({ stocks });
  });
}
