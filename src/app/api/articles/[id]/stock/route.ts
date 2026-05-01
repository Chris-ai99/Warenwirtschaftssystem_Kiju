import { requirePermission, requireUser } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ok, route } from "@/lib/route";

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "article:read");
    const { id } = await context.params;

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        barcodes: true,
        category: true,
        stocks: { include: { warehouse: true }, orderBy: { warehouse: { name: "asc" } } },
        movements: {
          include: { user: true, fromWarehouse: true, toWarehouse: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!article) {
      throw new AppError(404, "ARTICLE_NOT_FOUND", "Artikel wurde nicht gefunden.");
    }

    const fullTotal = article.stocks.reduce((sum, stock) => sum + stock.fullQuantity, 0);
    const emptyTotal = article.stocks.reduce((sum, stock) => sum + stock.emptyQuantity, 0);

    return ok({
      article,
      totals: {
        fullQuantity: fullTotal,
        emptyQuantity: emptyTotal,
        availableQuantity: fullTotal,
        depositValue: article.depositAmount.mul(emptyTotal).toFixed(2),
      },
    });
  });
}
