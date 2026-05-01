import { requirePermission, requireUser } from "@/lib/auth";
import { normalizeBarcode } from "@/lib/barcode";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ok, route } from "@/lib/route";

export function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "article:read");
    const { code } = await context.params;
    const value = normalizeBarcode(decodeURIComponent(code));

    const barcode = await prisma.barcode.findUnique({
      where: { value },
      include: {
        article: {
          include: {
            category: true,
            barcodes: true,
            stocks: { include: { warehouse: true } },
            movements: {
              include: { user: true, fromWarehouse: true, toWarehouse: true },
              orderBy: { createdAt: "desc" },
              take: 5,
            },
          },
        },
      },
    });

    if (!barcode || !barcode.article.active) {
      throw new AppError(404, "ARTICLE_NOT_FOUND", "Artikel wurde nicht gefunden.", {
        barcode: value,
      });
    }

    return ok({ article: barcode.article, barcode: value });
  });
}
