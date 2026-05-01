import { RoleCode } from "@/generated/prisma/client";
import { requirePermission, requireUser, verifyCsrf } from "@/lib/auth";
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

    const article = await prisma.article.update({
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
      include: { category: true, barcodes: true, stocks: true },
    });

    return ok({ article });
  });
}
