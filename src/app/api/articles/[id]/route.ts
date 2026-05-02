import { RoleCode } from "@/generated/prisma/client";
import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
import {
  assertBarcodesAvailable,
  collectArticleBarcodes,
  syncArticleUnits,
  syncPrimaryBarcode,
} from "@/lib/article-units";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ok, parseJson, route } from "@/lib/route";
import { articleUpdateSchema } from "@/lib/validation";

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    requirePermission(user, "article:read");
    const { id } = await context.params;

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        category: true,
        barcodes: true,
        units: { include: { barcodes: true }, orderBy: { sortOrder: "asc" } },
        stocks: { include: { warehouse: true } },
        movements: {
          include: { user: true, fromWarehouse: true, toWarehouse: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!article) {
      throw new AppError(404, "ARTICLE_NOT_FOUND", "Artikel wurde nicht gefunden.");
    }

    return ok({ article });
  });
}

export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const user = await requireUser();
    await verifyCsrf(request);
    requirePermission(user, "article:write");
    const { id } = await context.params;
    const input = await parseJson(request, articleUpdateSchema);

    const article = await prisma.$transaction(async (tx) => {
      const existing = await tx.article.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError(404, "ARTICLE_NOT_FOUND", "Artikel wurde nicht gefunden.");
      }

      await assertBarcodesAvailable(tx, collectArticleBarcodes(input.barcode, input.units ?? []), id);

      const updated = await tx.article.update({
        where: { id },
        data: {
          articleNumber: input.articleNumber,
          name: input.name,
          categoryId: input.categoryId,
          purchasePrice: user.role === RoleCode.ADMIN ? input.purchasePrice : undefined,
          salePrice: user.role === RoleCode.ADMIN ? input.salePrice : undefined,
          depositAmount: user.role === RoleCode.ADMIN ? input.depositAmount : undefined,
          unit: input.unit,
          description: input.description,
          imageUrl: input.imageUrl || undefined,
          active: input.active,
          supportsEmpties: input.supportsEmpties,
          lowStockThreshold: input.lowStockThreshold,
        },
      });

      if (input.units) {
        await syncArticleUnits(tx, updated.id, input.units);
      }
      await syncPrimaryBarcode(tx, updated.id, input.barcode);

      return tx.article.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
          category: true,
          barcodes: true,
          units: { include: { barcodes: true }, orderBy: { sortOrder: "asc" } },
          stocks: true,
        },
      });
    });

    return ok({ article });
  });
}
