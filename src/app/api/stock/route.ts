import { requirePermission, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, route } from "@/lib/route";

export function GET(request: Request) {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "article:read");
    const url = new URL(request.url);
    const articleId = url.searchParams.get("articleId") ?? undefined;
    const warehouseId = url.searchParams.get("warehouseId") ?? undefined;

    const stocks = await prisma.stock.findMany({
      where: { articleId, warehouseId },
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
